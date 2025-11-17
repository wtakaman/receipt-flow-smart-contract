require('dotenv').config();
require('@nomiclabs/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
require('solidity-coverage');

const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, MUMBAI_RPC_URL, MUMBAI_PRIVATE_KEY } = process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL || '',
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : []
    },
    mumbai: {
      url: MUMBAI_RPC_URL || '',
      accounts: MUMBAI_PRIVATE_KEY ? [MUMBAI_PRIVATE_KEY] : []
    }
  },
  solidity: {
    version: '0.8.9',
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
  }
};
