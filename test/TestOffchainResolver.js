const { CCIPReadProvider } = require("@chainlink/ethers-ccip-read-provider");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const namehash = require('eth-ens-namehash');

describe('OffchainResolver', function (accounts) {
    let provider, signer, address, verifier, resolver, snapshot;

    async function fetcher(url, json) {
        console.log({url, json});
        return {
            jobRunId: "1",
            statusCode: 200,
            data: {
                result: "0x"
            }
        };
    }

    before(async () => {
        provider = new CCIPReadProvider(ethers.provider, fetcher);
        signer = await provider.getSigner();
        address = await signer.getAddress();
        const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
        verifier = await SignatureVerifier.deploy([address]);
        const OffchainResolver = await ethers.getContractFactory("OffchainResolver");
        resolver = await OffchainResolver.deploy("http://localhost:8000/", verifier.address);
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('supportsInterface()', async () => {
        it('supports known interfaces', async () => {
            expect(await resolver.supportsInterface("0x9061b923")).to.equal(true); // IExtendedResolver
        });

        it('does not support a random interface', async () => {
            expect(await resolver.supportsInterface("0x3b3b57df")).to.equal(false);
        });
    });

    describe('resolve()', async () => {
        it.only('returns a CCIP-read error', async () => {
            await resolver.connect(provider).resolve(dnsName('test.eth'), '0x');
        });
    });

    describe('resolveWithSig()', async () => {
        it('resolves an address given a valid signature', async () => {
            const iface = new ethers.utils.Interface(["function addr(bytes32) returns(address)"]);
            console.log(iface.encodeFunctionData("addr", [namehash.hash('test.eth')]));
        });
    });
});

function dnsName(name) {
    // strip leading and trailing .
    const n = name.replace(/^\.|\.$/gm, '');

    var bufLen = (n === '') ? 1 : n.length + 2;
    var buf = Buffer.allocUnsafe(bufLen);

    offset = 0;
    if (n.length) {
        const list = n.split('.');
        for (let i = 0; i < list.length; i++) {
            const len = buf.write(list[i], offset + 1)
            buf[offset] = len;
            offset += len + 1;
        }
    }
    buf[offset++] = 0;
    return '0x' + buf.reduce((output, elem) => (output + ('0' + elem.toString(16)).slice(-2)), '');
}
