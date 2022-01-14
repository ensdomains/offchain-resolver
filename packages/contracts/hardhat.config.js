require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.10",
  networks: {
    hardhat: {
      throwOnCallFailures: false,
    }
  }
};
