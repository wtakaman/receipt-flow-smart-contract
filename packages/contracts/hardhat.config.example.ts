require('@nomiclabs/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
require('solidity-coverage');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {},
        sepolia: {
            url: '',
            accounts: [''],
        },
    },
    solidity: {
        version: '0.8.9',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
    },
    mocha: {
        timeout: 40000,
    },
};
