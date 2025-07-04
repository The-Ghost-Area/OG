require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');
const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const theme = {
  reset: "\x1b[0m",
  orange: "\x1b[38;5;208m",
  gold: "\x1b[38;5;220m",
  amber: "\x1b[38;5;214m",
  crimson: "\x1b[38;5;196m",
  silver: "\x1b[38;5;250m",
  coal: "\x1b[38;5;240m",
  flame: "\x1b[38;5;202m",
  bright: "\x1b[1m",
  purple: "\x1b[35m",
  teal: "\x1b[96m"
};

const console_output = {
  success: (msg) => console.log(`${theme.gold}[🔥] ${msg}${theme.reset}`),
  alert: (msg) => console.log(`${theme.amber}[⚡] ${msg}${theme.reset}`),
  fail: (msg) => console.log(`${theme.crimson}[💀] ${msg}${theme.reset}`),
  complete: (msg) => console.log(`${theme.gold}[🎯] ${msg}${theme.reset}`),
  progress: (msg) => console.log(`${theme.orange}[🚀] ${msg}${theme.reset}`),
  action: (msg) => console.log(`\n${theme.silver}[⚡] ${msg}${theme.reset}`),
  trace: (msg) => console.log(`${theme.coal}[◦] ${msg}${theme.reset}`),
  farewell: (msg) => console.log(`${theme.purple}[✨] ${msg}${theme.reset}`),
  fatal: (msg) => console.log(`${theme.crimson}${theme.bright}[💥] ${msg}${theme.reset}`),
  report: (msg) => console.log(`${theme.silver}[📊] ${msg}${theme.reset}`),
  divider: (msg) => {
    const separator = '▬'.repeat(55);
    console.log(`\n${theme.orange}${separator}${theme.reset}`);
    if (msg) console.log(`${theme.orange}${msg}${theme.reset}`);
    console.log(`${theme.orange}${separator}${theme.reset}\n`);
  },
  header: () => {
    console.log(`${theme.silver}${theme.bright}`);
    console.log(`╔──────────────────────────────────────╗`);
    console.log(`│ ██████╗ ███████╗██╗   ██╗██╗██╗      │`);
    console.log(`│ ██╔══██╗██╔════╝██║   ██║██║██║      │`);
    console.log(`│ ██║  ██║█████╗  ██║   ██║██║██║      │`);
    console.log(`│ ██║  ██║██╔══╝  ╚██╗ ██╔╝██║██║      │`);
    console.log(`│ ██████╔╝███████╗ ╚████╔╝ ██║███████╗ │`);
    console.log(`│ ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝╚══════╝ │`);
    console.log(`╚──────────────────────────────────────╝${theme.reset}`);
    console.log(`${theme.flame}${theme.bright}  0G Storage File Auto Uploader - DEVIL${theme.reset}\n`);
}
};

const NETWORK_ID = 16601;
const ENDPOINT_URL = 'https://evmrpc-testnet.0g.ai';
const SMART_CONTRACT = '0x5f1d96895e442fc0168fa2f9fb1ebef93cb5035e';
const FUNCTION_SIG = '0xef3e12dc';
const PROXY_CONFIG = 'proxies.txt';
const STORAGE_API = 'https://indexer-storage-testnet-turbo.0g.ai';
const CHAIN_EXPLORER = 'https://chainscan-galileo.0g.ai/tx/';

const MEDIA_SOURCES = [
  { url: 'https://picsum.photos/800/600', responseType: 'arraybuffer' },
  { url: 'https://loremflickr.com/800/600', responseType: 'arraybuffer' }
];

let walletKeys = [];
let activeKeyIndex = 0;

const ethersCompatible = ethers.version.startsWith('6');
const unitParser = ethersCompatible ? ethers.parseUnits : ethers.utils.parseUnits;
const etherParser = ethersCompatible ? ethers.parseEther : ethers.utils.parseEther;
const etherFormatter = ethersCompatible ? ethers.formatEther : ethers.utils.formatEther;

const rpcProvider = ethersCompatible
  ? new ethers.JsonRpcProvider(ENDPOINT_URL)
  : new ethers.providers.JsonRpcProvider(ENDPOINT_URL);

function loadWalletKeys() {
  try {
    let counter = 1;
    let keyValue = process.env[`PRIVATE_KEY_${counter}`];

    if (!keyValue && counter === 1 && process.env.PRIVATE_KEY) {
      keyValue = process.env.PRIVATE_KEY;
    }

    while (keyValue) {
      if (validatePrivateKey(keyValue)) {
        walletKeys.push(keyValue);
      } else {
        console_output.fail(`Invalid private key at PRIVATE_KEY_${counter}`);
      }
      counter++;
      keyValue = process.env[`PRIVATE_KEY_${counter}`];
    }

    if (walletKeys.length === 0) {
      console_output.fatal('No valid private keys found in .env file');
      process.exit(1);
    }

    console_output.complete(`Loaded ${walletKeys.length} wallet key(s)`);
  } catch (error) {
    console_output.fatal(`Failed to load wallet keys: ${error.message}`);
    process.exit(1);
  }
}

function validatePrivateKey(key) {
  key = key.trim();
  if (!key.startsWith('0x')) key = '0x' + key;
  try {
    const bytes = Buffer.from(key.replace('0x', ''), 'hex');
    return key.length === 66 && bytes.length === 32;
  } catch (error) {
    return false;
  }
}

function getCurrentPrivateKey() {
  return walletKeys[activeKeyIndex];
}

function switchToNextKey() {
  activeKeyIndex = (activeKeyIndex + 1) % walletKeys.length;
  return walletKeys[activeKeyIndex];
}

function generateRandomUA() {
  const userAgentList = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36'
  ];
  return userAgentList[Math.floor(Math.random() * userAgentList.length)];
}

let proxyList = [];
let currentProxyIdx = 0;

function loadProxyConfiguration() {
  try {
    if (fs.existsSync(PROXY_CONFIG)) {
      const fileContent = fs.readFileSync(PROXY_CONFIG, 'utf8');
      proxyList = fileContent.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      if (proxyList.length > 0) {
        console_output.success(`Loaded ${proxyList.length} proxies from ${PROXY_CONFIG}`);
      } else {
        console_output.alert(`No proxies found in ${PROXY_CONFIG}`);
      }
    } else {
      console_output.alert(`Proxy file ${PROXY_CONFIG} not found`);
    }
  } catch (error) {
    console_output.fail(`Failed to load proxies: ${error.message}`);
  }
}

function getAvailableProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[currentProxyIdx];
  currentProxyIdx = (currentProxyIdx + 1) % proxyList.length;
  return proxy;
}

function parseProxyAddress(proxy) {
  try {
    let cleanProxy = proxy.replace(/^https?:\/\//, '').replace(/.*@/, '');
    const ip = cleanProxy.split(':')[0];
    return ip || cleanProxy;
  } catch (error) {
    return proxy; 
  }
}

function buildHttpClient() {
  const config = {
    headers: {
      'User-Agent': generateRandomUA(),
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.8',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'sec-gpc': '1',
      'Referer': 'https://storagescan-galileo.0g.ai/',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  };

  const proxy = getAvailableProxy();
  if (proxy) {
    const proxyIP = parseProxyAddress(proxy);
    console_output.trace(`Using proxy IP: ${proxyIP}`);
    config.httpsAgent = new HttpsProxyAgent(proxy);
  }

  return axios.create(config);
}

const inputReader = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function createWalletInstance() {
  const privateKey = getCurrentPrivateKey();
  return new ethers.Wallet(privateKey, rpcProvider);
}

async function verifyNetworkConnection() {
  try {
    console_output.progress('Verifying network connection...');
    const blockNumber = await rpcProvider.getBlockNumber();
    console_output.complete(`Network synchronized at block ${blockNumber}`);
    return true;
  } catch (error) {
    console_output.fail(`Network connection failed: ${error.message}`);
    return false;
  }
}

async function downloadRandomMedia() {
  try {
    console_output.progress('Downloading random media...');
    const httpClient = buildHttpClient();
    const mediaSource = MEDIA_SOURCES[Math.floor(Math.random() * MEDIA_SOURCES.length)];
    const response = await httpClient.get(mediaSource.url, {
      responseType: mediaSource.responseType,
      maxRedirects: 5
    });
    console_output.complete('Media downloaded successfully');
    return response.data;
  } catch (error) {
    console_output.fail(`Error downloading media: ${error.message}`);
    throw error;
  }
}

async function verifyFileHash(fileHash) {
  try {
    console_output.progress(`Verifying file hash ${fileHash}...`);
    const httpClient = buildHttpClient();
    const response = await httpClient.get(`${STORAGE_API}/file/info/${fileHash}`);
    return response.data.exists || false;
  } catch (error) {
    console_output.alert(`Failed to verify file hash: ${error.message}`);
    return false;
  }
}

async function processMediaData(mediaBuffer) {
  const MAX_HASH_RETRIES = 5;
  let retry = 1;

  while (retry <= MAX_HASH_RETRIES) {
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString();
      const hashInput = Buffer.concat([
        Buffer.from(mediaBuffer),
        Buffer.from(salt),
        Buffer.from(timestamp)
      ]);
      const hash = '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');
      const fileExists = await verifyFileHash(hash);
      if (fileExists) {
        console_output.alert(`Hash ${hash} already exists, retrying...`);
        retry++;
        continue;
      }
      const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');
      console_output.complete(`Generated unique file hash: ${hash}`);
      return {
        root: hash,
        data: mediaBase64
      };
    } catch (error) {
      console_output.fail(`Error generating hash (attempt ${retry}): ${error.message}`);
      retry++;
      if (retry > MAX_HASH_RETRIES) {
        throw new Error(`Failed to generate unique hash after ${MAX_HASH_RETRIES} attempts`);
      }
    }
  }
}

async function uploadToNetwork(mediaData, wallet, walletIndex) {
  const MAX_UPLOAD_RETRIES = 3;
  const TIMEOUT_DURATION = 300;
  let attempt = 1;

  console_output.progress(`Checking wallet balance for ${wallet.address}...`);
  const balance = await rpcProvider.getBalance(wallet.address);
  const minBalance = etherParser('0.0015');
  if (BigInt(balance) < BigInt(minBalance)) {
    throw new Error(`Insufficient balance: ${etherFormatter(balance)} OG`);
  }
  console_output.complete(`Wallet balance: ${etherFormatter(balance)} OG`);

  while (attempt <= MAX_UPLOAD_RETRIES) {
    try {
      console_output.progress(`Uploading file for wallet #${walletIndex + 1} [${wallet.address}] (Attempt ${attempt}/${MAX_UPLOAD_RETRIES})...`);
      const httpClient = buildHttpClient();
      await httpClient.post(`${STORAGE_API}/file/segment`, {
        root: mediaData.root,
        index: 0,
        data: mediaData.data,
        proof: {
          siblings: [mediaData.root],
          path: []
        }
      }, {
        headers: {
          'content-type': 'application/json'
        }
      });
      console_output.complete('File segment uploaded');

      const contentHash = crypto.randomBytes(32);
      const data = ethers.concat([
        Buffer.from(FUNCTION_SIG.slice(2), 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000020', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000014', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000060', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000080', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'),
        contentHash,
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ]);

      const value = etherParser('0.000839233398436224');
      const gasPrice = unitParser('1.029599997', 'gwei');

      console_output.progress('Estimating gas requirements...');
      let gasLimit;
      try {
        const gasEstimate = await rpcProvider.estimateGas({
          to: SMART_CONTRACT,
          data,
          from: wallet.address,
          value
        });
        gasLimit = BigInt(gasEstimate) * 15n / 10n;
        console_output.complete(`Gas limit set: ${gasLimit}`);
      } catch (error) {
        gasLimit = 300000n;
        console_output.alert(`Gas estimation failed, using default: ${gasLimit}`);
      }

      const gasCost = BigInt(gasPrice) * gasLimit;
      const requiredBalance = gasCost + BigInt(value);
      if (BigInt(balance) < requiredBalance) {
        throw new Error(`Insufficient balance for transaction: ${etherFormatter(balance)} OG`);
      }

      console_output.progress('Broadcasting transaction...');
      const nonce = await rpcProvider.getTransactionCount(wallet.address, 'latest');
      const txParams = {
        to: SMART_CONTRACT,
        data,
        value,
        nonce,
        chainId: NETWORK_ID,
        gasPrice,
        gasLimit
      };

      const tx = await wallet.sendTransaction(txParams);
      const txLink = `${CHAIN_EXPLORER}${tx.hash}`;
      console_output.success(`Transaction broadcast: ${tx.hash}`);
      console_output.success(`Explorer: ${txLink}`);

      console_output.progress(`Waiting for confirmation (${TIMEOUT_DURATION}s)...`);
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_DURATION} seconds`)), TIMEOUT_DURATION * 1000))
        ]);
      } catch (error) {
        if (error.message.includes('Timeout')) {
          console_output.alert(`Transaction timeout after ${TIMEOUT_DURATION}s`);
          receipt = await rpcProvider.getTransactionReceipt(tx.hash);
          if (receipt && receipt.status === 1) {
            console_output.complete(`Late confirmation in block ${receipt.blockNumber}`);
          } else {
            throw new Error(`Transaction failed or pending: ${txLink}`);
          }
        } else {
          throw error;
        }
      }

      if (receipt.status === 1) {
        console_output.complete(`Transaction confirmed in block ${receipt.blockNumber}`);
        console_output.complete(`File uploaded, root hash: ${mediaData.root}`);
        return receipt;
      } else {
        throw new Error(`Transaction failed: ${txLink}`);
      }
    } catch (error) {
      console_output.fail(`Upload attempt ${attempt} failed: ${error.message}`);
      if (attempt < MAX_UPLOAD_RETRIES) {
        const delay = 10 + Math.random() * 20;
        console_output.alert(`Retrying after ${delay.toFixed(2)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        attempt++;
        continue;
      }
      throw error;
    }
  }
}

async function initialize() {
  try {
    console_output.header();
    loadWalletKeys();
    loadProxyConfiguration();

    console_output.progress('Checking network status...');
    const network = await rpcProvider.getNetwork();
    if (BigInt(network.chainId) !== BigInt(NETWORK_ID)) {
      throw new Error(`Invalid chainId: expected ${NETWORK_ID}, got ${network.chainId}`);
    }
    console_output.complete(`Connected to network: chainId ${network.chainId}`);

    const isNetworkSynced = await verifyNetworkConnection();
    if (!isNetworkSynced) {
      throw new Error('Network is not synchronized');
    }

    console.log(theme.orange + "Available wallets:" + theme.reset);
    walletKeys.forEach((key, index) => {
      const wallet = new ethers.Wallet(key);
      console.log(`${theme.gold}[${index + 1}]${theme.reset} ${wallet.address}`);
    });
    console.log();

    inputReader.question('How many files to upload per wallet? ', async (count) => {
      count = parseInt(count);
      if (isNaN(count) || count <= 0) {
        console_output.fail('Invalid number. Please enter a number greater than 0.');
        inputReader.close();
        process.exit(1);
        return;
      }

      const totalUploads = count * walletKeys.length;
      console_output.success(`Starting ${totalUploads} uploads (${count} per wallet)`);

      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      let successful = 0;
      let failed = 0;

      for (let walletIndex = 0; walletIndex < walletKeys.length; walletIndex++) {
        activeKeyIndex = walletIndex;
        const wallet = createWalletInstance();
        console_output.divider(`Processing Wallet #${walletIndex + 1} [${wallet.address}]`);

        for (let i = 1; i <= count; i++) {
          const uploadNumber = (walletIndex * count) + i;
          console_output.action(`Upload ${uploadNumber}/${totalUploads} (Wallet #${walletIndex + 1}, File #${i})`);

          try {
            const mediaBuffer = await downloadRandomMedia();
            const mediaData = await processMediaData(mediaBuffer);
            await uploadToNetwork(mediaData, wallet, walletIndex);
            successful++;
            console_output.complete(`Upload ${uploadNumber} completed`);

            if (uploadNumber < totalUploads) {
              console_output.progress('Waiting for next upload...');
              await delay(3000);
            }
          } catch (error) {
            failed++;
            console_output.fail(`Upload ${uploadNumber} failed: ${error.message}`);
            await delay(5000);
          }
        }

        if (walletIndex < walletKeys.length - 1) {
          console_output.progress('Switching to next wallet...');
          await delay(10000);
        }
      }

      console_output.divider('Upload Summary');
      console_output.report(`Total wallets: ${walletKeys.length}`);
      console_output.report(`Uploads per wallet: ${count}`);
      console_output.report(`Total attempted: ${totalUploads}`);
      if (successful > 0) console_output.complete(`Successful: ${successful}`);
      if (failed > 0) console_output.fail(`Failed: ${failed}`);
      console_output.complete('All operations completed');
      
      // Thanks message to Phoenix Team
      console.log(`\n${theme.flame}${theme.bright}Thanks to Phoenix Team for this incredible tool!${theme.reset}`);

      inputReader.close();
      process.exit(0);
    });

    inputReader.on('close', () => {
      console.log(`${theme.purple}Process completed ~ DEVIL KO THANKS BOLO!${theme.reset}`);
    });

  } catch (error) {
    console_output.fatal(`Main process error: ${error.message}`);
    inputReader.close();
    process.exit(1);
  }
}

initialize();
