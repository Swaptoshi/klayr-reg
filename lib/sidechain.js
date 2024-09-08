import { cryptography } from "klayr-sdk";
import { createSidechainClient, createMainchainClient } from "./client.js";

const registerSidechainHandler = async (logger, options) => {
  const sidechainClient = await createSidechainClient(logger, options);
  const mainchainClient = await createMainchainClient(logger, options);

  const sidechainNodeInfo = await sidechainClient.invoke("system_getNodeInfo");

  logger.verbose(`Connected to sidechain node:`);
  logger.verbose(JSON.stringify(sidechainNodeInfo));

  logger.verbose(`Getting BFT parameters from sidechain node`);
  const { validators: sidechainActiveValidators, certificateThreshold } =
    await sidechainClient.invoke("consensus_getBFTParameters", {
      height: sidechainNodeInfo.height,
    });

  logger.verbose(`Sorting sidechain validators according to BLS key`);

  sidechainActiveValidators.sort((a, b) =>
    Buffer.from(a.blsKey, "hex").compare(Buffer.from(b.blsKey, "hex"))
  );

  logger.verbose(`Constructing registerSidechain transaction...`);

  const unsignedTransaction = {
    module: "interoperability",
    command: "registerSidechain",
    fee: BigInt(1010000000),
    params: {
      sidechainCertificateThreshold: certificateThreshold,
      sidechainValidators: sidechainActiveValidators,
      chainID: sidechainNodeInfo.chainID,
      name: options.sideName,
    },
  };

  const privateKey = await cryptography.ed.getPrivateKeyFromPhraseAndPath(
    options.mainRelayerPhrase,
    options.mainPhrasePath
  );

  logger.verbose(
    `Using Mainchain Relayer account: ${cryptography.address.getKlayr32AddressFromPublicKey(
      cryptography.ed.getPublicKeyFromPrivateKey(privateKey)
    )}`
  );

  let signedTransaction = await mainchainClient.transaction.create(
    unsignedTransaction,
    privateKey.toString("hex")
  );

  const minFee = mainchainClient.transaction.computeMinFee(signedTransaction);
  unsignedTransaction.fee = minFee + BigInt(1000000000);

  signedTransaction = await mainchainClient.transaction.create(
    unsignedTransaction,
    privateKey.toString("hex")
  );

  logger.verbose(
    `Sidechain registration transaction fee: ${signedTransaction.fee}`
  );

  const receipt = await mainchainClient.transaction.send(signedTransaction);

  logger.verbose(
    `Sent sidechain '${options.sideName}' registration transaction on mainchain node 'klayr_mainchain'. Tx ID: ${receipt.transactionId}`
  );

  if (options.authorizeCc) {
    try {
      logger.verbose(`Authorizing Sidechain CC Plugin...`);

      const authorizeSideChainResult = await sidechainClient.invoke(
        "chainConnector_authorize",
        {
          enable: true,
          password: options.sideCcPass,
        }
      );

      logger.verbose(
        `Authorize Sidechain CC Plugin completed, response: ${JSON.stringify(
          authorizeSideChainResult
        )}`
      );
    } catch (err) {
      logger.warn(
        `Error at Authorizing Sidechain chain connector plugin: ${err.message}`
      );
    }
  }
};

export const registerSidechain = async (logger, options) => {
  try {
    await registerSidechainHandler(logger, options);
  } catch (err) {
    logger.error(`Register sidechain error: ${err.message}`);
    process.exit(1);
  }
};
