const { ethers } = require('ethers');
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const crypto = require('crypto');
const logger = require('../config/logger');

const ECPair = ECPairFactory(ecc);

/**
 * CryptoWalletService
 *
 * Handles HD wallet generation and management for the CEX platform.
 * Uses BIP39 (mnemonic) and BIP44 (hierarchical deterministic) standards.
 *
 * SECURITY WARNING:
 * - Master seed must be stored encrypted
 * - Never expose private keys to users
 * - Use HSM or KMS in production
 */
class CryptoWalletService {
  constructor() {
    // Master seed - MUST be set via environment variable
    // In production, this should be encrypted with KMS
    this.masterSeed = process.env.MASTER_SEED_MNEMONIC;

    if (!this.masterSeed) {
      logger.warn('MASTER_SEED_MNEMONIC not set. Wallet generation will fail.');
    }

    // BIP44 coin type constants
    this.COIN_TYPES = {
      BTC: 0,
      LTC: 2,
      ETH: 60,
      USDT: 60, // USDT (ERC-20) uses Ethereum
      USDC: 60, // USDC (ERC-20) uses Ethereum
      ADA: 1815,
      BNB: 714,
      SOL: 501,
      XRP: 144,
      DOGE: 3,
      DOT: 354
    };

    // Network configurations
    this.networks = {
      BTC: bitcoin.networks.bitcoin,
      LTC: {
        messagePrefix: '\x19Litecoin Signed Message:\n',
        bech32: 'ltc',
        bip32: {
          public: 0x019da462,
          private: 0x019d9cfe
        },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0
      },
      BTC_TESTNET: bitcoin.networks.testnet,
      LTC_TESTNET: {
        messagePrefix: '\x19Litecoin Signed Message:\n',
        bech32: 'tltc',
        bip32: {
          public: 0x0436f6e1,
          private: 0x0436ef7d
        },
        pubKeyHash: 0x6f,
        scriptHash: 0x3a,
        wif: 0xef
      }
    };
  }

  /**
   * Generate a new master seed (24 words)
   * ONLY USE ONCE during initial platform setup
   *
   * @returns {string} 24-word mnemonic phrase
   */
  generateMasterSeed() {
    const mnemonic = bip39.generateMnemonic(256); // 24 words
    logger.info('Master seed generated. STORE THIS SECURELY!');
    return mnemonic;
  }

  /**
   * Validate a mnemonic phrase
   *
   * @param {string} mnemonic - Mnemonic phrase to validate
   * @returns {boolean} True if valid
   */
  validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive a user's wallet for a specific cryptocurrency
   * Uses BIP44 derivation path: m/44'/coin_type'/0'/0/user_id
   *
   * @param {number} userId - User ID for derivation
   * @param {string} currency - Currency symbol (BTC, ETH, etc.)
   * @param {boolean} testnet - Use testnet (default: false)
   * @returns {Object} Wallet object with address, path, and private key
   */
  deriveUserWallet(userId, currency, testnet = false) {
    if (!this.masterSeed) {
      throw new Error('Master seed not configured');
    }

    const coinType = this.COIN_TYPES[currency];
    if (coinType === undefined) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    // BIP44 derivation path
    const path = `m/44'/${coinType}'/0'/0/${userId}`;

    // Handle Ethereum and ERC-20 tokens
    if (['ETH', 'USDT', 'USDC', 'BNB'].includes(currency)) {
      return this._deriveEthereumWallet(path, currency, userId);
    }

    // Handle Bitcoin and Bitcoin-like coins
    if (['BTC', 'LTC'].includes(currency)) {
      return this._deriveBitcoinWallet(path, currency, userId, testnet);
    }

    // Handle other coins (to be implemented)
    throw new Error(`Derivation not implemented for ${currency}`);
  }

  /**
   * Derive Ethereum wallet
   * Also used for ERC-20 tokens (USDT, USDC, etc.)
   *
   * @private
   */
  _deriveEthereumWallet(path, currency, userId) {
    try {
      const hdNode = ethers.HDNodeWallet.fromPhrase(this.masterSeed, undefined, path);

      // Ethereum addresses work on both mainnet and testnet
      // The network field is just informational - monitoring uses the configured RPC URL
      const isTestnet = process.env.ETHEREUM_RPC_URL && process.env.ETHEREUM_RPC_URL.includes('sepolia');
      const network = isTestnet ? 'ETH Testnet' : 'Ethereum Mainnet';

      return {
        userId,
        currency,
        address: hdNode.address,
        privateKey: hdNode.privateKey,
        derivationPath: path,
        network,
        provider: 'ethereum'
      };
    } catch (error) {
      logger.error('Error deriving Ethereum wallet:', error);
      throw new Error(`Failed to derive ${currency} wallet`);
    }
  }

  /**
   * Derive Bitcoin wallet
   * Also used for Bitcoin-like coins (LTC, etc.)
   *
   * @private
   */
  _deriveBitcoinWallet(path, currency, userId, testnet = false) {
    try {
      const seed = bip39.mnemonicToSeedSync(this.masterSeed);

      const network = testnet
        ? this.networks[`${currency}_TESTNET`]
        : this.networks[currency];

      // IMPORTANT: Pass network to fromSeed so WIF encoding uses correct prefix
      // Bitcoin WIF: starts with K, L, or 5 (prefix 0x80)
      // Litecoin WIF: starts with T or 6 (prefix 0xb0)
      const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
      const child = root.derivePath(path);

      // P2WPKH address (Native SegWit - bech32 format)
      // BTC: bc1..., LTC: ltc1...
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network
      });

      // Get network name based on currency
      const networkNames = {
        'BTC': 'Bitcoin Mainnet',
        'LTC': 'Litecoin Mainnet'
      };
      const networkName = testnet ? `${currency} Testnet` : (networkNames[currency] || `${currency} Mainnet`);

      return {
        userId,
        currency,
        address,
        privateKey: child.toWIF(),
        publicKey: child.publicKey.toString('hex'),
        derivationPath: path,
        network: networkName,
        provider: 'bitcoin'
      };
    } catch (error) {
      logger.error('Error deriving Bitcoin wallet:', error);
      throw new Error(`Failed to derive ${currency} wallet`);
    }
  }

  /**
   * Generate deposit address for a user
   * This is the PUBLIC address users deposit to
   *
   * @param {number} userId - User ID
   * @param {string} currency - Currency symbol
   * @returns {Object} Public address info
   */
  generateDepositAddress(userId, currency) {
    const wallet = this.deriveUserWallet(userId, currency);

    // Return only public information
    return {
      userId,
      currency,
      address: wallet.address,
      derivationPath: wallet.derivationPath,
      network: wallet.network,
      qrCode: this._generateQRData(currency, wallet.address)
    };
  }

  /**
   * Generate QR code data for deposit
   *
   * @private
   */
  _generateQRData(currency, address) {
    switch (currency) {
      case 'BTC':
        return `bitcoin:${address}`;
      case 'ETH':
        return `ethereum:${address}`;
      case 'LTC':
        return `litecoin:${address}`;
      default:
        return address;
    }
  }

  /**
   * Sign and broadcast withdrawal transaction
   *
   * @param {number} userId - User ID
   * @param {string} currency - Currency symbol
   * @param {string} toAddress - Destination address
   * @param {number} amount - Amount to send
   * @param {Object} provider - Blockchain provider (ethers.js provider, etc.)
   * @returns {Object} Transaction details
   */
  async signAndBroadcastTransaction(userId, currency, toAddress, amount, provider) {
    const wallet = this.deriveUserWallet(userId, currency);

    if (['ETH', 'USDT', 'USDC', 'BNB'].includes(currency)) {
      return await this._sendEthereumTransaction(wallet, toAddress, amount, provider, currency);
    }

    if (['BTC', 'LTC'].includes(currency)) {
      return await this._sendBitcoinTransaction(wallet, toAddress, amount, provider, currency);
    }

    throw new Error(`Transaction signing not implemented for ${currency}`);
  }

  /**
   * Send Ethereum transaction
   *
   * @private
   */
  async _sendEthereumTransaction(wallet, toAddress, amount, provider, currency) {
    try {
      // Connect wallet to provider
      const signer = new ethers.Wallet(wallet.privateKey, provider);

      let tx;

      if (currency === 'ETH') {
        // Native ETH transfer
        tx = await signer.sendTransaction({
          to: toAddress,
          value: ethers.parseEther(amount.toString())
        });
      } else {
        // ERC-20 token transfer (USDT, USDC)
        const tokenAddress = this._getTokenContractAddress(currency);
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer
        );

        // USDT/USDC have 6 decimals
        const decimals = 6;
        const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

        tx = await tokenContract.transfer(toAddress, tokenAmount);
      }

      await tx.wait(); // Wait for confirmation

      return {
        success: true,
        txHash: tx.hash,
        from: wallet.address,
        to: toAddress,
        amount,
        currency
      };
    } catch (error) {
      logger.error('Ethereum transaction error:', error);
      throw error;
    }
  }

  /**
   * Send Bitcoin transaction
   *
   * @private
   */
  async _sendBitcoinTransaction(wallet, toAddress, amount, provider, currency) {
    // Note: Bitcoin transaction signing requires UTXO management
    // This is a simplified implementation - production needs proper UTXO handling
    throw new Error('Bitcoin transaction signing requires UTXO management - implement based on your Bitcoin node');
  }

  /**
   * Get ERC-20 token contract addresses
   *
   * @private
   */
  _getTokenContractAddress(currency) {
    const addresses = {
      // Mainnet addresses
      USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',

      // Add more tokens as needed
    };

    return addresses[currency];
  }

  /**
   * Encrypt master seed with AES-256
   * For secure storage in database/file
   *
   * @param {string} mnemonic - Master seed to encrypt
   * @param {string} encryptionKey - 32-byte encryption key
   * @returns {string} Encrypted seed (base64)
   */
  encryptMasterSeed(mnemonic, encryptionKey) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(encryptionKey, 'hex'),
      iv
    );

    let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return IV + authTag + encrypted data
    return Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]).toString('base64');
  }

  /**
   * Decrypt master seed
   *
   * @param {string} encryptedSeed - Encrypted seed (base64)
   * @param {string} encryptionKey - 32-byte encryption key
   * @returns {string} Decrypted mnemonic
   */
  decryptMasterSeed(encryptedSeed, encryptionKey) {
    const algorithm = 'aes-256-gcm';
    const buffer = Buffer.from(encryptedSeed, 'base64');

    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32).toString('hex');

    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(encryptionKey, 'hex'),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Validate a blockchain address
   *
   * @param {string} address - Address to validate
   * @param {string} currency - Currency symbol
   * @returns {boolean} True if valid
   */
  validateAddress(address, currency) {
    try {
      if (['ETH', 'USDT', 'USDC', 'BNB'].includes(currency)) {
        return ethers.isAddress(address);
      }

      if (['BTC', 'LTC'].includes(currency)) {
        const network = this.networks[currency];
        bitcoin.address.toOutputScript(address, network);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get private key from derivation path
   * ⚠️ CRITICAL: This should ONLY be used in emergency situations by admins!
   *
   * @param {string} derivationPath - BIP44 derivation path (e.g., m/44'/60'/0'/0/123)
   * @returns {string} Private key in appropriate format
   */
  getPrivateKey(derivationPath) {
    if (!this.masterSeed) {
      throw new Error('Master seed not configured');
    }

    logger.warn('⚠️ CRITICAL: Private key retrieval requested', {
      derivationPath,
      WARNING: 'This is a sensitive operation that should only be performed by authorized admins in emergency situations'
    });

    try {
      // Parse the derivation path to determine currency
      const pathMatch = derivationPath.match(/m\/44'\/(\d+)'/);
      if (!pathMatch) {
        throw new Error('Invalid derivation path format');
      }

      const coinType = parseInt(pathMatch[1]);

      // Determine currency from coin type
      let currency = null;
      for (const [curr, type] of Object.entries(this.COIN_TYPES)) {
        if (type === coinType) {
          currency = curr;
          break;
        }
      }

      if (!currency) {
        throw new Error(`Unknown coin type: ${coinType}`);
      }

      // Handle Ethereum and ERC-20 tokens
      if (['ETH', 'USDT', 'USDC', 'BNB'].includes(currency)) {
        // Use fromPhrase with the full derivation path
        const wallet = ethers.HDNodeWallet.fromPhrase(this.masterSeed, undefined, derivationPath);

        return {
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          address: wallet.address,
          format: 'hex',
          currency
        };
      }

      // Handle Bitcoin and Bitcoin-like coins
      if (['BTC', 'LTC'].includes(currency)) {
        const seed = bip39.mnemonicToSeedSync(this.masterSeed);

        // IMPORTANT: Pass network parameter to fromSeed for correct WIF encoding
        const network = this.networks[currency];
        const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
        const child = root.derivePath(derivationPath);
        const { address } = bitcoin.payments.p2pkh({
          pubkey: child.publicKey,
          network
        });

        return {
          privateKey: child.toWIF(), // WIF format for Bitcoin
          privateKeyHex: child.privateKey.toString('hex'),
          publicKey: child.publicKey.toString('hex'),
          address,
          format: 'WIF',
          currency
        };
      }

      throw new Error(`Private key retrieval not implemented for ${currency}`);

    } catch (error) {
      logger.error('Failed to retrieve private key:', {
        derivationPath,
        error: error.message
      });
      throw new Error(`Failed to retrieve private key: ${error.message}`);
    }
  }

  /**
   * Get private key by user ID and currency
   * Helper method that derives the path and retrieves the key
   *
   * @param {number} userId - User ID
   * @param {string} currency - Currency symbol
   * @returns {Object} Private key details
   */
  getPrivateKeyForUser(userId, currency) {
    const coinType = this.COIN_TYPES[currency];
    if (coinType === undefined) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const derivationPath = `m/44'/${coinType}'/0'/0/${userId}`;

    logger.warn('⚠️ CRITICAL: Private key requested for user', {
      userId,
      currency,
      derivationPath
    });

    return this.getPrivateKey(derivationPath);
  }
}

module.exports = new CryptoWalletService();
