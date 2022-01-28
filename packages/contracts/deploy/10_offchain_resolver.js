const { ethers } = require("hardhat");

module.exports = async ({deployments}) => {
    const {deploy} = deployments;
    const signers = await ethers.getSigners();
    const owner = signers[0].address;
    const resolver = await deploy('OffchainResolver', {
        from: owner,
        args: ['http://localhost:8000/{sender}/{data}.json', ['0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266']],
        log: true,
    });
    
    const registry = await ethers.getContract('ENSRegistry');
    await registry.setSubnodeOwner("0x0000000000000000000000000000000000000000000000000000000000000000", ethers.utils.id('eth'), owner, {from: owner});
    await registry.setSubnodeOwner(ethers.utils.namehash('eth'), ethers.utils.id('test'), owner, {from: owner});
    await registry.setResolver(ethers.utils.namehash('test.eth'), resolver.address, {from: owner});
};
module.exports.tags = ['ens'];
