import { cryptography } from "klayr-sdk";
import { createSidechainClient, createMainchainClient } from "./client.js";

const registerSidechainHandler = async (logger, options) => {
  const sidechainClient = await createSidechainClient(options);
  const mainchainClient = await createMainchainClient(options);

  const sidechainNodeInfo = await sidechainClient.invoke("system_getNodeInfo");

  const { validators: sidechainActiveValidators, certificateThreshold } =
    await sidechainClient.invoke("consensus_getBFTParameters", {
      height: sidechainNodeInfo.height,
    });

  sidechainActiveValidators.sort((a, b) =>
    Buffer.from(a.blsKey, "hex").compare(Buffer.from(b.blsKey, "hex"))
  );

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

  let signedTransaction = await mainchainClient.transaction.create(
    unsignedTransaction,
    privateKey.toString("hex")
  );

  const minFee = mainchainClient.transaction.computeMinFee(signedTransaction);
  unsignedTransaction.fee = minFee + BigInt(1000000000);
  //   unsignedTransaction.fee = BigInt(1010000000);

  signedTransaction = await mainchainClient.transaction.create(
    unsignedTransaction,
    privateKey.toString("hex")
  );

  logger.verbose(
    `Sidechain Registration Transaction on Mainchain Fee: ${signedTransaction.fee}`
  );

  const receipt = await mainchainClient.transaction.send(signedTransaction);

  logger.verbose(
    `Sent sidechain '${options.sideName}' registration transaction on mainchain node 'klayr_mainchain'. Tx ID: ${receipt.transactionId}`
  );

  if (options.authorizeCc) {
    try {
      const authorizeSideChainResult = await sidechainClient.invoke(
        "chainConnector_authorize",
        {
          enable: true,
          password: options.sideCcPass,
        }
      );

      logger.verbose(
        `Authorize Sidechain completed, result: ${authorizeSideChainResult}`
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
