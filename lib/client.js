import { apiClient } from "klayr-sdk";

export const createMainchainClient = async (logger, options) => {
  if (options.mainIpc) {
    logger.verbose(`Connecting to mainchain using ipc: ${options.mainIpc}`);
    return apiClient.createIPCClient(options.mainIpc);
  }

  if (options.mainWs) {
    logger.verbose(`Connecting to mainchain using ws: ${options.mainWs}`);
    return apiClient.createWSClient(options.mainWs);
  }

  throw new Error("mainIpc and mainWs option is not available");
};

export const createSidechainClient = async (logger, options) => {
  if (options.sideIpc) {
    logger.verbose(`Connecting to sidechain using ipc: ${options.sideIpc}`);
    return apiClient.createIPCClient(options.sideIpc);
  }

  if (options.sideWs) {
    logger.verbose(`Connecting to sidechain using ws: ${options.sideWs}`);
    return apiClient.createWSClient(options.sideWs);
  }

  throw new Error("sideIpc and sideWs option is not available");
};
