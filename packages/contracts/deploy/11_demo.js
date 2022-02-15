const { ethers } = require("hardhat");  
const arguments = require('../arguments')
module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer, owner} = await getNamedAccounts();
    var gatewayUrl = arguments[0]
    await deploy('OffchainResolver', {
        from: deployer,
        args: [gatewayUrl, [owner]],
        log: true,
    });
    // etherscan verification command
    // INFURA_ID=$INFURA_ID ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY npx hardhat verify --constructor-args arguments.js --network ropsten $OFFCHAIN_RESOLVER_ADDRESS
};
module.exports.tags = ['demo'];
