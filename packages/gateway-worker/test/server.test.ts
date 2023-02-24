import { makeServer } from '../src/server';
import { ethers } from 'ethers';
import { JSONDatabase } from '../src/json';
import { abi as IResolverService_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json';
import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
import { ETH_COIN_TYPE } from '../src/utils';

const IResolverService = new ethers.utils.Interface(IResolverService_abi);
const Resolver = new ethers.utils.Interface(Resolver_abi);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_ADDRESS = '0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe';
const TEST_DB = {
  '*.eth': {
    addresses: {
      [ETH_COIN_TYPE]: '0x2345234523452345234523452345234523452345',
    },
    text: { email: 'wildcard@example.com' },
    contenthash:
      '0xe301017012204edd2984eeaf3ddf50bac238ec95c5713fb40b5e428b508fdbe55d3b9f155ffe',
  },
  'test.eth': {
    addresses: {
      [ETH_COIN_TYPE]: '0x3456345634563456345634563456345634563456',
    },
    text: { email: 'test@example.com' },
    contenthash:
      '0xe40101fa011b20d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162',
  },
};

function dnsName(name: string) {
  // strip leading and trailing .
  const n = name.replace(/^\.|\.$/gm, '');

  var bufLen = n === '' ? 1 : n.length + 2;
  var buf = Buffer.allocUnsafe(bufLen);

  let offset = 0;
  if (n.length) {
    const list = n.split('.');
    for (let i = 0; i < list.length; i++) {
      const len = buf.write(list[i], offset + 1);
      buf[offset] = len;
      offset += len + 1;
    }
  }
  buf[offset++] = 0;
  return (
    '0x' +
    buf.reduce(
      (output, elem) => output + ('0' + elem.toString(16)).slice(-2),
      ''
    )
  );
}

function expandSignature(sig: string) {
  return {
    r: ethers.utils.hexDataSlice(sig, 0, 32),
    _vs: ethers.utils.hexDataSlice(sig, 32),
  };
}

describe('makeServer', () => {
  const key = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
  const signingAddress = ethers.utils.computeAddress(key.privateKey);
  const db = new JSONDatabase(TEST_DB, 300);
  const server = makeServer(key, db);

  async function makeCall(fragment: string, name: string, ...args: any[]) {
    // Hash the name
    const node = ethers.utils.namehash(name);
    // Encode the inner call (eg, addr(namehash))
    const innerData = Resolver.encodeFunctionData(fragment, [node, ...args]);
    // Encode the outer call (eg, resolve(name, inner))
    const outerData = IResolverService.encodeFunctionData('resolve', [
      dnsName(name),
      innerData,
    ]);
    // Call the server with address and data
    const { status, body } = await server.call({
      to: TEST_ADDRESS,
      data: outerData,
    });
    // Decode the response from 'resolve'
    const [result, validUntil, sigData] = IResolverService.decodeFunctionResult(
      'resolve',
      body.data
    );
    // Check the signature
    let messageHash = ethers.utils.solidityKeccak256(
      ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
      [
        '0x1900',
        TEST_ADDRESS,
        validUntil,
        ethers.utils.keccak256(outerData || '0x'),
        ethers.utils.keccak256(result),
      ]
    );
    expect(
      ethers.utils.recoverAddress(messageHash, expandSignature(sigData))
    ).toBe(signingAddress);
    return { status, result };
  }

  describe('addr(bytes32)', () => {
    it('resolves exact names', async () => {
      const response = await makeCall('addr(bytes32)', 'test.eth');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32)', [
          TEST_DB['test.eth'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall('addr(bytes32)', 'foo.eth');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32)', [
          TEST_DB['*.eth'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves nonexistent names', async () => {
      const response = await makeCall('addr(bytes32)', 'test.test');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32)', [ZERO_ADDRESS]),
      });
    });
  });

  describe('addr(bytes32,uint256)', () => {
    it('resolves exact names', async () => {
      const response = await makeCall(
        'addr(bytes32,uint256)',
        'test.eth',
        ETH_COIN_TYPE
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32,uint256)', [
          TEST_DB['test.eth'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall(
        'addr(bytes32,uint256)',
        'foo.eth',
        ETH_COIN_TYPE
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32,uint256)', [
          TEST_DB['*.eth'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves nonexistent names', async () => {
      const response = await makeCall(
        'addr(bytes32,uint256)',
        'test.test',
        ETH_COIN_TYPE
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32,uint256)', [
          ZERO_ADDRESS,
        ]),
      });
    });
  });

  describe('text(bytes32,string)', () => {
    it('resolves exact names', async () => {
      const response = await makeCall(
        'text(bytes32,string)',
        'test.eth',
        'email'
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('text(bytes32,string)', [
          TEST_DB['test.eth'].text['email'],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall(
        'text(bytes32,string)',
        'foo.eth',
        'email'
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('text(bytes32,string)', [
          TEST_DB['*.eth'].text['email'],
        ]),
      });
    });

    it('resolves nonexistent names', async () => {
      const response = await makeCall(
        'text(bytes32,string)',
        'test.test',
        'email'
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('text(bytes32,string)', ['']),
      });
    });
  });

  describe('contenthash(bytes32)', () => {
    it('resolves exact names', async () => {
      const response = await makeCall('contenthash(bytes32)', 'test.eth');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('contenthash(bytes32)', [
          TEST_DB['test.eth'].contenthash,
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall('contenthash(bytes32)', 'foo.eth');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('contenthash(bytes32)', [
          TEST_DB['*.eth'].contenthash,
        ]),
      });
    });

    it('resolves nonexistent names', async () => {
      const response = await makeCall('contenthash(bytes32)', 'test.test');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('contenthash(bytes32)', ['0x']),
      });
    });
  });
});
