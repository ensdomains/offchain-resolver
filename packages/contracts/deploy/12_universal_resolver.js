const { ethers } = require("hardhat");

module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer, signer} = await getNamedAccounts();
    const registry = await ethers.getContract('ENSRegistry');
    await deploy('UniversalResolver', {
        from: deployer,
        args: [registry.address],
        log: true,
    });
};
module.exports.tags = ['test', 'demo'];
