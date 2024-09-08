import { apiClient } from "klayr-sdk";

export const createMainchainClient = async (options) => {
  if (options.mainIpc) {
    return apiClient.createIPCClient(options.mainIpc);
  }

  if (options.mainWs) {
    return apiClient.createWSClient(options.mainWs);
  }

  throw new Error("mainIpc and mainWs option is not available");
};

export const createSidechainClient = async (options) => {
  if (options.sideIpc) {
    return apiClient.createIPCClient(options.sideIpc);
  }

  if (options.sideWs) {
    return apiClient.createWSClient(options.sideWs);
  }

  throw new Error("sideIpc and sideWs option is not available");
};
