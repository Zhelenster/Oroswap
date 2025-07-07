const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { assertIsBroadcastTxSuccess, GasPrice } = require("@cosmjs/stargate");
const { SigningCosmWasmClient } = require("@cosmjs/cosmwasm-stargate");
const { fromMnemonic } = require("@cosmjs/launchpad");
const { readFileSync } = require("fs");
const colors = require("colors");
const ora = require("ora");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();
const pairs = JSON.parse(readFileSync("pairs.json", "utf8"));
const proxyList = readFileSync("proxy.txt", "utf8").split("\n").filter(Boolean);
const RPC = process.env.RPC;
const CHAIN_ID = process.env.CHAIN_ID;
const TOTAL_SWAP = 150;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getBalance(client, addr, denom) {
  const balance = await client.getBalance(addr, denom);
  return Number(balance.amount);
}

async function runSwap(mnemonic, index) {
  const spinner = ora(`🔑 Wallet ${index} loading...`).start();
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "zig" });
  const [account] = await wallet.getAccounts();
  const client = await SigningCosmWasmClient.connectWithSigner(RPC, wallet, {
    gasPrice: GasPrice.fromString("0.025uzig"),
  });

  spinner.succeed(`🔑 Wallet ${index}: ${account.address}`);

  let count = 0;
  while (count < TOTAL_SWAP) {
    for (let i = 0; i < 10 && count < TOTAL_SWAP; i++) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const balance = await getBalance(client, account.address, pair.denom);
      const amount = Math.floor(balance * (Math.random() * (0.10 - 0.05) + 0.05));
      if (amount <= 0) {
        console.log(colors.yellow(`[${index}] 💸 Skip: saldo kurang di ${pair.denom}`));
        continue;
      }

      const tx = {
        swap: {
          belief_price: pair.belief_price,
          max_spread: pair.max_spread,
          offer_asset: {
            amount: String(amount),
            info: {
              native_token: { denom: pair.denom },
            },
          },
        },
      };

      try {
        const res = await client.execute(account.address, pair.contract, tx, "auto", "Swap (Native)", [
          { denom: pair.denom, amount: String(amount) },
        ]);

        console.log(colors.green(`[${index}] ✅ ${pair.pair_name} | Amount: ${amount} | TX: https://zigscan.org/tx/${res.transactionHash}`));
      } catch (e) {
        console.log(colors.red(`[${index}] ❌  TX Failed: ${e.message}`));
      }

      count++;
      await sleep(Math.floor(Math.random() * 3000) + 10000); // 10-13 detik
    }

    console.log(colors.cyan(`🛑 Wallet ${index} istirahat 30 detik...`));
    await sleep(30000);
  }

  console.log(colors.green(`🎉 Wallet ${index} selesai 150x swap!`));
}

async function main() {
  const mnemonics = Object.keys(process.env)
    .filter(k => k.startsWith("MNEMONIC_"))
    .map(k => process.env[k]);

  for (let i = 0; i < mnemonics.length; i++) {
    runSwap(mnemonics[i], i + 1);
    await sleep(5000); // jeda antar wallet agar tidak parallel langsung
  }
}

main();
