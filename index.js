#!/usr/bin/env node
import { Command } from "commander";
import figlet from "figlet";
import inquirer from "inquirer";
import { createSpinner } from "nanospinner";
import dotenv from "dotenv";
import * as winston from "winston";
import { registerSidechain, registerMainchain, loadJson } from "./lib/index.js";

const pJson = loadJson("./package.json");

// Load environment variables from .env file
dotenv.config();

const program = new Command();

// CLI Option Definitions
program
  .name("klayr-reg")
  .version(pJson.version)
  .description("CLI for Klayr Registration")
  .option("-v, --verbose", "Verbose mode")
  .option("-c, --config <path>", "Config file path")
  .option("--side-name <name>", "Sidechain name for registration")
  .option("--keys <path>", "Sidechain validators keys lists")
  .option("--main-ipc <path>", "Mainchain IPC path")
  .option("--main-ws <url>", "Mainchain WebSocket URL")
  .option("--side-ipc <path>", "Sidechain IPC path")
  .option("--side-ws <url>", "Sidechain WebSocket URL")
  .option(
    "--authorize-cc",
    "Use Klayr-REG CLI to authorize chain-connector plugin"
  )
  .option(
    "--cc-pass <password>",
    "CC password for both mainchain and sidechain"
  )
  .option("--main-cc-pass <password>", "CC password for mainchain")
  .option("--side-cc-pass <password>", "CC password for sidechain")
  .option("--relayer-phrase <phrase>", "Relayer phrase for both chains")
  .option("--main-relayer-phrase <phrase>", "Relayer phrase for mainchain")
  .option("--side-relayer-phrase <phrase>", "Relayer phrase for sidechain")
  .option("--prompt-path", "Prompt to set phrase path")
  .option("--phrase-path <path>", "Phrase path for both chains")
  .option("--main-phrase-path <path>", "Phrase path for mainchain")
  .option("--side-phrase-path <path>", "Phrase path for sidechain")
  .option(
    "--register-mainchain-fee <fee>",
    "Custom registerMainchain transaction fee"
  )
  .option(
    "--register-sidechain-fee <fee>",
    "Custom registerSidechain transaction fee"
  );

// Helper function to load the config file
function loadConfig(configPath) {
  return loadJson(configPath);
}

// Retrieve config, environment variables, or prompt user
async function getOptions() {
  console.log("\n");
  console.log(figlet.textSync("Klayr-REG"));
  console.log("\n");

  // Parse command-line options
  program.parse(process.argv);
  const options = program.opts();

  // Load config file if provided or .env
  const configFile = options.config || process.env.KLAYR_REG_CONFIG;
  const config = configFile ? loadConfig(configFile) : {};

  // Check if we have IPC or WS paths
  let sideIpc =
    options.sideIpc || config.sideIpc || process.env.KLAYR_REG_SIDECHAIN_IPC;
  let mainIpc =
    options.mainIpc || config.mainIpc || process.env.KLAYR_REG_MAINCHAIN_IPC;
  let sideWs =
    options.sideWs || config.sideWs || process.env.KLAYR_REG_SIDECHAIN_WS;
  let mainWs =
    options.mainWs || config.mainWs || process.env.KLAYR_REG_MAINCHAIN_WS;

  if (!(mainIpc || mainWs)) {
    const mainIpcWsAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "mainIpcOrWs",
        message: "Enter mainchain IPC path or WS URL",
      },
    ]);

    mainIpc = mainIpcWsAnswer.mainIpcOrWs.startsWith("ws")
      ? null
      : mainIpcWsAnswer.mainIpcOrWs;
    mainWs = mainIpcWsAnswer.mainIpcOrWs.startsWith("ws")
      ? mainIpcWsAnswer.mainIpcOrWs
      : null;
  }

  // If neither IPC nor WS are provided, ask for them
  if (!(sideIpc || sideWs)) {
    const sideIpcWsAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "sideIpcOrWs",
        message: "Enter sidechain IPC path or WS URL",
      },
    ]);

    sideIpc = sideIpcWsAnswer.sideIpcOrWs.startsWith("ws")
      ? null
      : sideIpcWsAnswer.sideIpcOrWs;
    sideWs = sideIpcWsAnswer.sideIpcOrWs.startsWith("ws")
      ? sideIpcWsAnswer.sideIpcOrWs
      : null;
  }

  // Get sidechain name
  let sideName =
    options.sideName || config.sideName || process.env.KLAYR_REG_SIDECHAIN_NAME;
  if (!sideName) {
    const sidechainNameAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "sideName",
        message: "Enter sidechain name:",
      },
    ]);
    sideName = sidechainNameAnswers.sideName;
  }

  // Get sidechain validator keys
  let keys =
    options.keys || config.keys || process.env.KLAYR_REG_SIDECHAIN_KEYS;
  if (!keys) {
    const sidechainKeysAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "keys",
        message: "Enter sidechain validator keys path:",
      },
    ]);
    keys = sidechainKeysAnswers.keys;
  }

  // Get phrase path
  let promptPath =
    options.promptPath ||
    config.promptPath ||
    process.env.KLAYR_REG_PROMPT_PATH ||
    false;
  let phrasePath =
    options.phrasePath ||
    config.phrasePath ||
    process.env.KLAYR_REG_PHRASE_PATH;
  let sidePhrasePath =
    phrasePath ||
    options.sidePhrasePath ||
    config.sidePhrasePath ||
    process.env.KLAYR_REG_SIDECHAIN_PHRASE_PATH;
  let mainPhrasePath =
    phrasePath ||
    options.mainPhrasePath ||
    config.mainPhrasePath ||
    process.env.KLAYR_REG_MAINCHAIN_PHRASE_PATH;

  if (!phrasePath && (!sidePhrasePath || !mainPhrasePath)) {
    let phrasePathAnswers = {};
    if (promptPath) {
      phrasePathAnswers = await inquirer.prompt([
        {
          type: "list",
          name: "phrasePathChoice",
          message: "Choose phrase path option:",
          choices: [
            {
              name: "Use default path for both chains (\"m/44'/134'/0'\")",
              value: "default",
            },
            { name: "Specify path for both chains", value: "both" },
            { name: "Specify path for each chain", value: "each" },
          ],
        },
        {
          type: "input",
          name: "phrasePath",
          message: "Enter phrase path for both chains",
          when: (answers) => answers.phrasePathChoice === "both",
        },
        {
          type: "input",
          name: "mainPhrasePath",
          message: "Enter phrase path for mainchain",
          when: (answers) => answers.phrasePathChoice === "each",
        },
        {
          type: "input",
          name: "sidePhrasePath",
          message: "Enter phrase path for sidechain",
          when: (answers) => answers.phrasePathChoice === "each",
        },
      ]);
    }
    phrasePath = phrasePathAnswers.phrasePath || "m/44'/134'/0'";
    mainPhrasePath = phrasePathAnswers.mainPhrasePath || phrasePath;
    sidePhrasePath = phrasePathAnswers.sidePhrasePath || phrasePath;
  }

  // Get relayer phrase
  let relayerPhrase =
    options.relayerPhrase ||
    config.relayerPhrase ||
    process.env.KLAYR_REG_RELAYER_PHRASE;
  let sideRelayerPhrase =
    relayerPhrase ||
    options.sideRelayerPhrase ||
    config.sideRelayerPhrase ||
    process.env.KLAYR_REG_SIDECHAIN_RELAYER_PHRASE;
  let mainRelayerPhrase =
    relayerPhrase ||
    options.mainRelayerPhrase ||
    config.mainRelayerPhrase ||
    process.env.KLAYR_REG_MAINCHAIN_RELAYER_PHRASE;

  if (!relayerPhrase && (!sideRelayerPhrase || !mainRelayerPhrase)) {
    const relayerAnswers = await inquirer.prompt([
      {
        type: "confirm",
        name: "sameRelayer",
        message: "Use the same relayer passphrase for both chains?",
        default: true,
      },
      {
        type: "password",
        name: "relayerPhrase",
        message: "Enter relayer passphrase for both chains",
        when: (answers) => answers.sameRelayer,
      },
    ]);
    relayerPhrase = relayerAnswers.relayerPhrase;

    const mainRelayerAnswers = await inquirer.prompt([
      {
        type: "password",
        name: "mainRelayerPhrase",
        message: "Enter relayer passphrase for mainchain",
        when: () => !mainRelayerPhrase && !relayerAnswers.sameRelayer,
      },
    ]);
    mainRelayerPhrase =
      relayerAnswers.relayerPhrase ||
      mainRelayerAnswers.mainRelayerPhrase ||
      mainRelayerPhrase;

    const sideRelayerAnswers = await inquirer.prompt([
      {
        type: "password",
        name: "sideRelayerPhrase",
        message: "Enter relayer passphrase for sidechain",
        when: () => !sideRelayerPhrase && !relayerAnswers.sameRelayer,
      },
    ]);
    sideRelayerPhrase =
      relayerAnswers.relayerPhrase ||
      sideRelayerAnswers.sideRelayerPhrase ||
      sideRelayerPhrase;
  }

  // Get CC Password
  let authorizeCc =
    options.authorizeCc ||
    config.authorizeCc ||
    process.env.KLAYR_REG_AUTHORIZE_CC ||
    false;
  let ccPass =
    options.ccPass || config.ccPass || process.env.KLAYR_REG_CC_PASSWORD;
  let sideCcPass =
    ccPass ||
    options.sideCcPass ||
    config.sideCcPass ||
    process.env.KLAYR_REG_SIDECHAIN_CC_PASSWORD;
  let mainCcPass =
    ccPass ||
    options.mainCcPass ||
    config.mainCcPass ||
    process.env.KLAYR_REG_MAINCHAIN_CC_PASSWORD;

  if (authorizeCc && !ccPass && (!sideCcPass || !mainCcPass)) {
    const ccAnswers = await inquirer.prompt([
      {
        type: "confirm",
        name: "samePass",
        message: "Use the same CC password for both chains?",
        default: true,
      },
      {
        type: "password",
        name: "ccPass",
        message: "Enter CC password for both chains",
        when: (answers) => answers.samePass,
      },
      {
        type: "password",
        name: "mainCcPass",
        message: "Enter CC password for mainchain",
        when: (answers) => !mainCcPass && !answers.samePass,
      },
      {
        type: "password",
        name: "sideCcPass",
        message: "Enter CC password for sidechain",
        when: (answers) => !sideCcPass && !answers.samePass,
      },
    ]);
    ccPass = ccAnswers.ccPass;
    mainCcPass = ccAnswers.ccPass || ccAnswers.mainCcPass || mainCcPass;
    sideCcPass = ccAnswers.ccPass || ccAnswers.sideCcPass || sideCcPass;
  }

  // Get transaction fee
  let registerMainchainFee =
    options.registerMainchainFee ||
    config.registerMainchainFee ||
    process.env.KLAYR_REG_REGISTER_MAINCHAIN_FEE;
  let registerSidechainFee =
    options.registerSidechainFee ||
    config.registerSidechainFee ||
    process.env.KLAYR_REG_REGISTER_SIDECHAIN_FEE;

  return {
    verbose: options.verbose,
    sideIpc,
    mainIpc,
    sideWs,
    mainWs,
    sideName,
    keys,
    phrasePath,
    mainPhrasePath,
    sidePhrasePath,
    relayerPhrase,
    mainRelayerPhrase,
    sideRelayerPhrase,
    authorizeCc: !!authorizeCc,
    ccPass,
    mainCcPass,
    sideCcPass,
    registerMainchainFee,
    registerSidechainFee,
  };
}

async function run() {
  const options = await getOptions();
  const logger = winston.createLogger({
    level: options.verbose ? "verbose" : "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });

  logger.verbose("Options used for run command:");
  logger.verbose(JSON.stringify(options));

  let registerSidechainSpinner;

  if (!options.verbose) {
    registerSidechainSpinner = createSpinner("Registering sidechain...");
    registerSidechainSpinner.start();
  }

  await registerSidechain(logger, options);

  if (!options.verbose) {
    registerSidechainSpinner.success({
      text: "Sidechain registration completed!",
    });
  }

  let registerMainchainSpinner;

  if (!options.verbose) {
    registerMainchainSpinner = createSpinner("Registering mainchain...");
    registerMainchainSpinner.start();
  }

  await registerMainchain(logger, options);

  if (!options.verbose) {
    registerMainchainSpinner.success({
      text: "Mainchain registration completed!",
    });
  }

  console.log("\n");
  console.log("Klayr-REG Executed Successfully! 🚀");

  process.exit(0);
}

run();
