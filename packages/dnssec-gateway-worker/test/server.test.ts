import { makeServer } from '../src/server';
import { ethers } from 'ethers';

import { SignedSet } from '@ensdomains/dnsprovejs';
import { abi as IResolverService_abi } from '@ensdomains/ens-contracts/artifacts/contracts/dnsregistrar/OffchainDNSResolver.sol/IDNSGateway.json';
import { hexEncodeName } from '../src/utils';

const IResolverService = new ethers.utils.Interface(IResolverService_abi);
// const Resolver = new ethers.utils.Interface(Resolver_abi);

const DOH_QUERY_URL = 'https://cloudflare-dns.com/dns-query';

const TEST_NAME = 'test.xyz';
const TEST_ADDRESS = '0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe';

describe('makeServer', () => {
  const server = makeServer(DOH_QUERY_URL);

  async function makeCall(_fragment: string, name: string, ..._args: any[]) {
    const dnsName = hexEncodeName(name);
    const data = IResolverService.encodeFunctionData('resolve', [dnsName, 16]);
    // Call the server with address and data
    const { status, body } = await server.call({
      to: TEST_ADDRESS,
      data,
    });
    return { status, result: body.data };
  }

  describe('resolve', () => {
    it('resolve DNSSEC encoded answer', async () => {
      const { result } = await makeCall('addr(bytes32)', TEST_NAME);

      const decodedResult = IResolverService.decodeFunctionResult(
        'resolve',
        result
      );

      const answerRecord = decodedResult[0][1];

      const signedAnswer = SignedSet.fromWire(
        Buffer.from(answerRecord[0].replace(/^0x/, ''), 'hex'),
        Buffer.from(answerRecord[1].replace(/^0x/, ''), 'hex')
      );

      expect(signedAnswer.records[0].name).toStrictEqual(TEST_NAME);
    });
  });
});
