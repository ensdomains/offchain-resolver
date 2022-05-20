const { ethers } = require("hardhat");

module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer, signer} = await getNamedAccounts();
    if(!network.config.gatewayurl){
        throw("gatewayurl is missing on hardhat.config.js");
    }
    await deploy('OffchainResolver', {
        from: deployer,
        args: [network.config.gatewayurl, [signer]],
        log: true,
    });
};
module.exports.tags = ['test', 'demo'];
