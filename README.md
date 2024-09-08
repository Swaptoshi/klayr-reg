# Klayr-REG CLI

Klayr-REG is a command-line tool designed to make sidechain registration on Klayr fun again!

## Features

- Load configuration from command-line options, config file, or environment variables.
- Prompt the user for missing options interactively.
- Optionally authorize chain-connector plugin (CC).
- Verbose mode for detailed logs.

## Prerequisites

Ensure that you have the following installed:

- Node.js (>= 14.x)
- NPM (Node Package Manager)

## Usage

Use Klayr-REG easily using `npx`:

```bash
npx klayr-reg [options]
```

Example:

```bash
npx klayr-reg --prompt-path --authorize-cc
```

## Install Globally

To install Klayr-REG globally, execute following command:

```bash
npm install -g klayr-reg
```

Once installed globally, you can use the `klayr-reg` command without `npx`.

## Options

Below is a list of all available options and their corresponding environment variables:

| Option                           | Description                                  | Environment Variable                 |
| -------------------------------- | -------------------------------------------- | ------------------------------------ |
| `-v, --verbose`                  | Verbose mode for more detailed logs          | `KLAYR_REG_VERBOSE`                  |
| `-c, --config <path>`            | Config file path                             | `KLAYR_REG_CONFIG`                   |
| `--side-name <name>`             | Sidechain name for registration              | `KLAYR_REG_SIDECHAIN_NAME`           |
| `--keys <path>`                  | Path to sidechain validators keys            | `KLAYR_REG_SIDECHAIN_KEYS`           |
| `--main-ipc <path>`              | Mainchain IPC path                           | `KLAYR_REG_MAINCHAIN_IPC`            |
| `--main-ws <url>`                | Mainchain WebSocket URL                      | `KLAYR_REG_MAINCHAIN_WS`             |
| `--side-ipc <path>`              | Sidechain IPC path                           | `KLAYR_REG_SIDECHAIN_IPC`            |
| `--side-ws <url>`                | Sidechain WebSocket URL                      | `KLAYR_REG_SIDECHAIN_WS`             |
| `--authorize-cc`                 | Authorize chain-connector plugin             | `KLAYR_REG_AUTHORIZE_CC`             |
| `--cc-pass <password>`           | CC password for both mainchain and sidechain | `KLAYR_REG_CC_PASSWORD`              |
| `--main-cc-pass <password>`      | CC password for mainchain                    | `KLAYR_REG_MAINCHAIN_CC_PASSWORD`    |
| `--side-cc-pass <password>`      | CC password for sidechain                    | `KLAYR_REG_SIDECHAIN_CC_PASSWORD`    |
| `--relayer-phrase <phrase>`      | Relayer phrase for both chains               | `KLAYR_REG_RELAYER_PHRASE`           |
| `--main-relayer-phrase <phrase>` | Relayer phrase for mainchain                 | `KLAYR_REG_MAINCHAIN_RELAYER_PHRASE` |
| `--side-relayer-phrase <phrase>` | Relayer phrase for sidechain                 | `KLAYR_REG_SIDECHAIN_RELAYER_PHRASE` |
| `--prompt-path`                  | Prompt to set phrase path                    | `KLAYR_REG_PROMPT_PATH`              |
| `--phrase-path <path>`           | Phrase path for both chains                  | `KLAYR_REG_PHRASE_PATH`              |
| `--main-phrase-path <path>`      | Phrase path for mainchain                    | `KLAYR_REG_MAINCHAIN_PHRASE_PATH`    |
| `--side-phrase-path <path>`      | Phrase path for sidechain                    | `KLAYR_REG_SIDECHAIN_PHRASE_PATH`    |

## Configuration with `.env`

You can also use a `.env` file to store the options. For example:

```
KLAYR_REG_SIDECHAIN_NAME=mySidechain
KLAYR_REG_MAINCHAIN_IPC=/path/to/mainchain/folder
KLAYR_REG_SIDECHAIN_IPC=/path/to/sidechain/folder
KLAYR_REG_SIDECHAIN_KEYS=/path/to/validators_keys.json
KLAYR_REG_AUTHORIZE_CC=true
KLAYR_REG_CC_PASSWORD=myCCPassword
```

## Interactive Mode

If any of the required options are missing, the CLI will prompt you for input interactively. For example, if no sidechain name is provided, it will ask for one.

## Verbose Mode

For more detailed logs, use the `--verbose` flag:

```bash
npx klayr-reg --verbose
```

## Build From Source

To build Klayr-REG CLI from source, clone the repository, install dependencies, and install globally:

```bash
git clone https://github.com/swaptoshi/klayr-reg
cd klayr-reg
npm install
npm install -g .
```

Once installed globally, you can use the `klayr-reg` command.

## License

This project is licensed under the Apache 2.0 License.
