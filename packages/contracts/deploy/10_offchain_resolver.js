const { ethers } = require("hardhat");

module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer, owner} = await getNamedAccounts();
    if(network.name === 'hardhat'){
        signer = deployer
    }else{
        signer = owner
    }
    if(!network.config.gatewayurl) throw("gatewayurl is missing on hardhat.config.js")
    await deploy('OffchainResolver', {
        from: deployer,
        args: [network.config.gatewayurl, [signer]],
        log: true,
    });
};
module.exports.tags = ['ens', 'demo'];
