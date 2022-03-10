const { ethers } = require("hardhat");

module.exports = async ({deployments}) => {
    const {deploy} = deployments;
    const signers = await ethers.getSigners();
    const owner = signers[0].address;
    await deploy('ENSRegistry', {
        from: owner,
        args: [],
        log: true,
    });
};
module.exports.tags = ['test'];
