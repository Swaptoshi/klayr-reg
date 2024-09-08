import {
  codec,
  cryptography,
  Transaction,
  registrationSignatureMessageSchema,
  mainchainRegParams as mainchainRegParamsSchema,
  MESSAGE_TAG_CHAIN_REG,
} from "klayr-sdk";
import { createMainchainClient, createSidechainClient } from "./client.js";
import { loadJson } from "./json.js";

const registerMainchainHanlder = async (logger, options) => {
  const { bls, address } = cryptography;

  const mainchainClient = await createMainchainClient(options);
  const sidechainClient = await createSidechainClient(options);

  const mainchainNodeInfo = await mainchainClient.invoke("system_getNodeInfo");
  const sidechainNodeInfo = await sidechainClient.invoke("system_getNodeInfo");

  const {
    validators: mainchainActiveValidators,
    certificateThreshold: mainchainCertificateThreshold,
  } = await mainchainClient.invoke("consensus_getBFTParameters", {
    height: mainchainNodeInfo.height,
  });

  const paramsJSON = {
    ownChainID: sidechainNodeInfo.chainID,
    ownName: options.sideName,
    mainchainValidators: mainchainActiveValidators
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
    mainchainCertificateThreshold: paramsJSON.mainchainCertificateThreshold,
  };

  const message = codec.encode(registrationSignatureMessageSchema, params);

  const { validators: sidechainActiveValidators } =
    await sidechainClient.invoke("consensus_getBFTParameters", {
      height: sidechainNodeInfo.height,
    });

  const activeValidatorsBLSKeys = [];

  for (const activeValidator of sidechainActiveValidators) {
    const sidechainKeys = loadJson(options.keys);
    const sidechainDevValidator = sidechainKeys.keys.find(
      (devValidator) => devValidator.plain.blsKey === activeValidator.blsKey
    );
    if (sidechainDevValidator) {
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

  activeValidatorsBLSKeys.sort((a, b) =>
    a.blsPublicKey.compare(b.blsPublicKey)
  );

  const sidechainValidatorsSignatures = [];

  for (const validator of activeValidatorsBLSKeys) {
    const signature = bls.signData(
      MESSAGE_TAG_CHAIN_REG,
      params.ownChainID,
      message,
      validator.blsPrivateKey
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

  const { aggregationBits, signature } = bls.createAggSig(
    publicBLSKeys,
    sidechainValidatorsSignatures
  );

  const relayerPrivateKey =
    await cryptography.ed.getPrivateKeyFromPhraseAndPath(
      options.sideRelayerPhrase,
      options.sidePhrasePath
    );
  const relayerPublicKey =
    cryptography.ed.getPublicKeyFromPrivateKey(relayerPrivateKey);

  const { nonce } = await sidechainClient.invoke("auth_getAuthAccount", {
    address: address.getKlayr32AddressFromPublicKey(relayerPublicKey),
  });

  const mainchainRegParams = {
    ...paramsJSON,
    signature: signature.toString("hex"),
    aggregationBits: aggregationBits.toString("hex"),
  };

  let tx = new Transaction({
    module: "interoperability",
    command: "registerMainchain",
    fee: BigInt(2000000000),
    params: codec.encodeJSON(mainchainRegParamsSchema, mainchainRegParams),
    nonce: BigInt(nonce),
    senderPublicKey: relayerPublicKey,
    signatures: [],
  });

  // Sign the transaction
  tx.sign(Buffer.from(sidechainNodeInfo.chainID, "hex"), relayerPrivateKey);

  const minFee = sidechainClient.transaction.computeMinFee(tx.toJSON());
  tx.fee = minFee;
  tx.signatures = [];
  tx.sign(Buffer.from(sidechainNodeInfo.chainID, "hex"), relayerPrivateKey);

  logger.verbose(
    `Mainchain Registration Transaction on Sidechain Fee: ${tx.fee}`
  );

  const result = await sidechainClient.invoke("txpool_postTransaction", {
    transaction: tx.getBytes().toString("hex"),
  });

  logger.verbose(
    `Sent mainchain registration transaction on sidechain node. Tx ID: ${result.transactionId}`
  );

  if (options.authorizeCc) {
    try {
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
