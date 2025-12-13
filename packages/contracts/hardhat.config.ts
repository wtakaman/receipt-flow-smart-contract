const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('@nomiclabs/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');
require('@nomicfoundation/hardhat-chai-matchers');
require('solidity-coverage');

const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, MUMBAI_RPC_URL, MUMBAI_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL || '',
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111
    },
    mumbai: {
      url: MUMBAI_RPC_URL || '',
      accounts: MUMBAI_PRIVATE_KEY ? [MUMBAI_PRIVATE_KEY] : []
    }
  },
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || 'DC1AZF1HQ3KKPYUGGNWE45N99EDCM12SA7'
  }
};
