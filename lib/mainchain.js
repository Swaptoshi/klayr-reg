import { codec, cryptography, Transaction, Modules } from "klayr-sdk";
import { createMainchainClient, createSidechainClient } from "./client.js";
import { loadJson } from "./json.js";

const registerMainchainHanlder = async (logger, options) => {
  const { bls, address } = cryptography;

  const mainchainClient = await createMainchainClient(logger, options);
  const sidechainClient = await createSidechainClient(logger, options);

  const mainchainNodeInfo = await mainchainClient.invoke("system_getNodeInfo");
  logger.verbose(`Connected to mainchain node:`);
  logger.verbose(JSON.stringify(mainchainNodeInfo));

  const sidechainNodeInfo = await sidechainClient.invoke("system_getNodeInfo");
  logger.verbose(`Connected to sidechain node:`);
  logger.verbose(JSON.stringify(sidechainNodeInfo));

  logger.verbose(`Getting BFT parameters from mainchain node`);
  const {
    validators: mainchainActiveValidators,
    certificateThreshold: mainchainCertificateThreshold,
  } = await mainchainClient.invoke("consensus_getBFTParameters", {
    height: mainchainNodeInfo.height,
  });

  logger.verbose(`Constructing registration signature message parameters...`);
  const paramsJSON = {
    ownChainID: sidechainNodeInfo.chainID,
    ownName: options.sideName,
    mainchainValidators: mainchainActiveValidators
      .filter((t) => Number(t.bftWeight) > 0)
      .map((v) => ({ blsKey: v.blsKey, bftWeight: v.bftWeight }))
      .sort((a, b) =>
        Buffer.from(a.blsKey, "hex").compare(Buffer.from(b.blsKey, "hex"))
      ),
    mainchainCertificateThreshold,
  };

  const params = {
    ownChainID: Buffer.from(paramsJSON.ownChainID, "hex"),
    ownName: paramsJSON.ownName,
    mainchainValidators: paramsJSON.mainchainValidators.map((v) => ({
      blsKey: Buffer.from(v.blsKey, "hex"),
      bftWeight: BigInt(v.bftWeight),
    })),
    mainchainCertificateThreshold: BigInt(
      paramsJSON.mainchainCertificateThreshold
    ),
  };

  const message = codec.encode(
    Modules.Interoperability.registrationSignatureMessageSchema,
    params
  );

  logger.verbose(`Getting BFT parameters from sidechain node`);
  const { validators: sidechainActiveValidators } =
    await sidechainClient.invoke("consensus_getBFTParameters", {
      height: sidechainNodeInfo.height,
    });

  const activeValidatorsBLSKeys = [];

  logger.verbose(
    `Start filtering active sidechain validator according to keys from ${options.keys}`
  );
  for (const activeValidator of sidechainActiveValidators) {
    const sidechainKeys = loadJson(options.keys);
    const sidechainDevValidator = sidechainKeys.keys.find(
      (devValidator) => devValidator.plain.blsKey === activeValidator.blsKey
    );
    if (sidechainDevValidator) {
      logger.verbose(`Found validator BLS key for: ${activeValidator.address}`);

      activeValidatorsBLSKeys.push({
        blsPublicKey: Buffer.from(activeValidator.blsKey, "hex"),
        blsPrivateKey: Buffer.from(
          sidechainDevValidator.plain.blsPrivateKey,
          "hex"
        ),
      });
    }
  }

  logger.verbose(
    `Total activeValidatorsBLSKeys: ${activeValidatorsBLSKeys.length}`
  );

  logger.verbose(`Sorting sidechain validator BLS keys...`);

  activeValidatorsBLSKeys.sort((a, b) =>
    a.blsPublicKey.compare(b.blsPublicKey)
  );

  const sidechainValidatorsSignatures = [];

  logger.verbose(`Start creating signature for each validator...`);

  for (const validator of activeValidatorsBLSKeys) {
    const signature = bls.signData(
      Modules.Interoperability.MESSAGE_TAG_CHAIN_REG,
      params.ownChainID,
      message,
      validator.blsPrivateKey
    );

    logger.verbose(
      `Signed successfully using public key: ${validator.blsPublicKey.toString(
        "hex"
      )}`
    );
    sidechainValidatorsSignatures.push({
      publicKey: validator.blsPublicKey,
      signature,
    });
  }

  const publicBLSKeys = activeValidatorsBLSKeys.map((v) => v.blsPublicKey);

  logger.verbose(
    `Total active sidechain validators: ${sidechainValidatorsSignatures.length}`
  );

  logger.verbose(`Start creating aggregation signature signature...`);

  const { aggregationBits, signature } = bls.createAggSig(
    publicBLSKeys,
    sidechainValidatorsSignatures
  );

  const relayerPrivateKey =
    await cryptography.ed.getPrivateKeyFromPhraseAndPath(
      options.sideRelayerPhrase,
      options.sidePhrasePath
    );

  logger.verbose(
    `Using Sidechain Relayer account: ${cryptography.address.getKlayr32AddressFromPublicKey(
      cryptography.ed.getPublicKeyFromPrivateKey(relayerPrivateKey)
    )}`
  );

  const relayerPublicKey =
    cryptography.ed.getPublicKeyFromPrivateKey(relayerPrivateKey);

  const { nonce } = await sidechainClient.invoke("auth_getAuthAccount", {
    address: address.getKlayr32AddressFromPublicKey(relayerPublicKey),
  });

  logger.verbose(`Constructing registerMainchain transaction...`);

  const mainchainRegParams = {
    ...paramsJSON,
    signature: signature.toString("hex"),
    aggregationBits: aggregationBits.toString("hex"),
  };

  let tx = new Transaction({
    module: "interoperability",
    command: "registerMainchain",
    fee: BigInt(2000000000),
    params: codec.encodeJSON(
      Modules.Interoperability.mainchainRegParams,
      mainchainRegParams
    ),
    nonce: BigInt(nonce),
    senderPublicKey: relayerPublicKey,
    signatures: [],
  });

  // Sign the transaction
  tx.sign(Buffer.from(sidechainNodeInfo.chainID, "hex"), relayerPrivateKey);

  if (!!options.registerMainchainFee) {
    tx.fee = BigInt(options.registerMainchainFee);
  } else {
    const minFee = sidechainClient.transaction.computeMinFee(tx.toJSON());
    tx.fee = minFee;
  }

  tx.signatures = [];
  tx.sign(Buffer.from(sidechainNodeInfo.chainID, "hex"), relayerPrivateKey);

  logger.verbose(`Mainchain registration transaction fee: ${tx.fee}`);

  const result = await sidechainClient.invoke("txpool_postTransaction", {
    transaction: tx.getBytes().toString("hex"),
  });

  logger.verbose(
    `Sent mainchain registration transaction on sidechain node. Tx ID: ${result.transactionId}`
  );

  if (options.authorizeCc) {
    try {
      logger.verbose(`Authorizing Mainchain CC Plugin...`);

      const authorizeMainchainResult = await mainchainClient.invoke(
        "chainConnector_authorize",
        {
          enable: true,
          password: options.mainCcPass,
        }
      );

      logger.verbose(
        `Authorize Mainchain CC Plugin completed, response: ${JSON.stringify(
          authorizeMainchainResult
        )}`
      );
    } catch (err) {
      logger.warn(
        `Error at Authorizing Mainchain chain connector plugin: ${err.message}`
      );
    }
  }
};

export const registerMainchain = async (logger, options) => {
  try {
    await registerMainchainHanlder(logger, options);
  } catch (err) {
    logger.error(`Register mainchain error: ${err.message}`);
    process.exit(1);
  }
};
