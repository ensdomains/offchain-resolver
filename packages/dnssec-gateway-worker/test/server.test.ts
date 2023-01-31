import { makeServer } from '../src/server';
import { ethers } from 'ethers';
import { abi as IResolverService_abi } from '@ensdomains/ens-contracts/artifacts/contracts/dnsregistrar/OffchainDNSResolver.sol/OffchainDNSResolver.json';
import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json';
import { ETH_COIN_TYPE } from '../src/utils';

const IResolverService = new ethers.utils.Interface(IResolverService_abi);
const Resolver = new ethers.utils.Interface(Resolver_abi);

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_ADDRESS = '0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe';

const validityPeriod = 2419200
const expiration = Date.now() / 1000 - 15 * 60 + validityPeriod
const inception = Date.now() / 1000 - 15 * 60
const testRrset = (name: string, account: string) => ({
  name,
  sig: {
    name: 'test',
    type: 'RRSIG',
    ttl: 0,
    class: 'IN',
    flush: false,
    data: {
      typeCovered: 'TXT',
      algorithm: 253,
      labels: name.split('.').length + 1,
      originalTTL: 3600,
      expiration,
      inception,
      keyTag: 1278,
      signersName: '.',
      signature: new Buffer([]),
    },
  },
  rrs: [
    {
      name: `_ens.${name}`,
      type: 'TXT',
      class: 'IN',
      ttl: 3600,
      data: Buffer.from(`a=${account}`, 'ascii'),
    },
  ],
});

const TEST_DB = {
  'test.com': {
    addresses: {
      [ETH_COIN_TYPE]: '0x3456345634563456345634563456345634563456',
    },
    text: { email: 'test@example.com' },
    contenthash:
      '0xe40101fa011b20d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162',
    hasDNSRecords: true,
    dnsRecords: testRrset('test.com', '0x3456345634563456345634563456345634563456'),
    zonehash: ''
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

// function expandSignature(sig: string) {
//   return {
//     r: ethers.utils.hexDataSlice(sig, 0, 32),
//     _vs: ethers.utils.hexDataSlice(sig, 32),
//   };
// }

describe('makeServer', () => {
  const server = makeServer('');

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
    const [result,] = IResolverService.decodeFunctionResult(
      'resolve',
      body.data
    );

    // do the DNSSEC verification instead signature check

    // // Check the signature
    // let messageHash = ethers.utils.solidityKeccak256(
    //   ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
    //   [
    //     '0x1900',
    //     TEST_ADDRESS,
    //     validUntil,
    //     ethers.utils.keccak256(outerData || '0x'),
    //     ethers.utils.keccak256(result),
    //   ]
    // );
    // expect(
    //   ethers.utils.recoverAddress(messageHash, expandSignature(sigData))
    // ).toBe(signingAddress);
    return { status, result };
  }

  describe('addr(bytes32)', () => {
    it('resolves exact names', async () => {
      const response = await makeCall('addr(bytes32)', 'test.com');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32)', [
          TEST_DB['test.com'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall('addr(bytes32)', 'foo.com');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32)', [
          TEST_DB['*.com'].addresses[ETH_COIN_TYPE],
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
        'test.com',
        ETH_COIN_TYPE
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32,uint256)', [
          TEST_DB['test.com'].addresses[ETH_COIN_TYPE],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall(
        'addr(bytes32,uint256)',
        'foo.com',
        ETH_COIN_TYPE
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('addr(bytes32,uint256)', [
          TEST_DB['*.com'].addresses[ETH_COIN_TYPE],
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
        'test.com',
        'email'
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('text(bytes32,string)', [
          TEST_DB['test.com'].text['email'],
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall(
        'text(bytes32,string)',
        'foo.com',
        'email'
      );
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('text(bytes32,string)', [
          TEST_DB['*.com'].text['email'],
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
      const response = await makeCall('contenthash(bytes32)', 'test.com');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('contenthash(bytes32)', [
          TEST_DB['test.com'].contenthash,
        ]),
      });
    });

    it('resolves wildcard names', async () => {
      const response = await makeCall('contenthash(bytes32)', 'foo.com');
      expect(response).toStrictEqual({
        status: 200,
        result: Resolver.encodeFunctionResult('contenthash(bytes32)', [
          TEST_DB['*.com'].contenthash,
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
