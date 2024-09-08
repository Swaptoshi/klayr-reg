const { createSidechainClient, createMainchainClient } = require("./client");
const { cryptography } = require("klayr-sdk");

const registerSidechainHandler = async (logger, options) => {
  const sidechainClient = await createSidechainClient();
  const mainchainClient = await createMainchainClient();

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
    config.MAINCHAIN_PASSPHRASE,
    config.MAINCHAIN_KEY_PATH
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
    `Sent sidechain '${config.SIDECHAIN_NAME}' registration transaction on mainchain node 'klayr_mainchain'. Tx ID: ${receipt.transactionId}`
  );

  if (options.authorizeCc) {
    try {
      const authorizeSideChainResult = await sidechainClient.invoke(
        "chainConnector_authorize",
        {
          enable: true,
          password: config.SIDECHAIN_CC_PLUGIN_PASSWORD,
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

const registerSidechain = async (logger, options) => {
  try {
    await registerSidechainHandler(logger, options);
  } catch (err) {
    logger.error(`Register sidechain error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = { registerSidechain };
