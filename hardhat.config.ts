require('@nomiclabs/hardhat-waffle');
require('solidity-coverage');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {},
        goerli: {
            url: 'https://eth-goerli.g.alchemy.com/v2/C40OtX699QKn5p0K7Vo9I7NR0-mHZvSy',
            accounts: ['7f6ef89ce0fa37d96c254209dd478dd0146bfc9bf33aa0b644b9cc6942ec0731'],
        },
        mumbai: {
            url: 'https://polygon-mumbai.g.alchemy.com/v2/WKPf3DBJuYP7P53XXe8SlGmpARpK10IL',
            accounts: ['7f6ef89ce0fa37d96c254209dd478dd0146bfc9bf33aa0b644b9cc6942ec0731'],
        }
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
