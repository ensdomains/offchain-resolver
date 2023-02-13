/// <reference types="./ganache" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as dotenv from 'dotenv'
import { Contract, ethers } from 'ethers';
import ganache from 'ganache';
import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers';
import { FetchJsonResponse } from '@ethersproject/web';
import { makeServer } from '../src/server';
import { hexEncodeName } from '../src/utils';
import OffchainResolver_abi from '@ensdomains/ens-contracts/artifacts/contracts/dnsregistrar/OffchainDNSResolver.sol/OffchainDNSResolver.json';
import Resolver_abi from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/OwnedResolver.sol/OwnedResolver.json';
import {
  BaseProvider,
  BlockTag,
  TransactionRequest,
  Network,
} from '@ethersproject/providers';
import { fetchJson } from '@ethersproject/web';
import { arrayify, BytesLike, hexlify } from '@ethersproject/bytes';
dotenv.config();
chai.use(chaiAsPromised);

export type Fetch = (
  url: string,
  json?: string,
  processFunc?: (value: any, response: FetchJsonResponse) => any
) => Promise<any>;

const Resolver = new ethers.utils.Interface(Resolver_abi.abi);

const ENS_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const DNSSEC_IMPL = '0x21745ff62108968fbf5ab1e07961cc0fcbeb2364';

const DOH_QUERY_URL = 'https://cloudflare-dns.com/dns-query';
const FORK_PROVIDER_URL = process.env.FORK_PROVIDER_URL;

const TEST_URL = 'https://localhost:8000/query';
const TEST_NAME = 'test.xyz'; // use a domain with resolver txt set (e.g. ENS1 0x30200e0cb040f38e474e53ef437c95a1be723b2b)

const CCIP_READ_INTERFACE = new ethers.utils.Interface(
  OffchainResolver_abi.abi
);

function deploySolidity(data: any, signer: ethers.Signer, ...args: any[]) {
  const factory = ethers.ContractFactory.fromSolidity(data, signer);
  return factory.deploy(...args);
}

export class MockProvider extends BaseProvider {
  readonly parent: BaseProvider;
  readonly fetcher: Fetch;

  /**
   * Constructor.
   * @param provider: The Ethers provider to wrap.
   */
  constructor(provider: BaseProvider, fetcher: Fetch = fetchJson) {
    super(1337);
    this.parent = provider;
    this.fetcher = fetcher;
  }

  async perform(method: string, params: any): Promise<any> {
    switch (method) {
      case 'call':
        const { result } = await this.handleCall(this, params);
        console.log('result perform', result);
        return result;
      default:
        return this.parent.perform(method, params);
    }
  }

  async handleCall(
    provider: MockProvider,
    params: { transaction: TransactionRequest; blockTag?: BlockTag }
  ): Promise<{ transaction: TransactionRequest; result: BytesLike }> {
    let result = await provider.parent.perform('call', params);
    let bytes = arrayify(result);
    const { urls, callData } = CCIP_READ_INTERFACE.decodeErrorResult(
      'OffchainLookup',
      bytes
    );
    const response = await this.sendRPC(
      provider.fetcher,
      urls,
      params.transaction.to,
      callData
    );
    return {
      transaction: params.transaction,
      result: response,
    };
  }

  async sendRPC(
    fetcher: Fetch,
    urls: string[],
    to: any,
    callData: BytesLike
  ): Promise<BytesLike> {
    const processFunc = (value: any, response: FetchJsonResponse) => {
      return { body: value, status: response.statusCode };
    };

    const args = { sender: hexlify(to), data: hexlify(callData) };
    const url = urls[0];
    const data = await fetcher(url, JSON.stringify(args), processFunc);
    return data.body.data;
  }

  detectNetwork(): Promise<Network> {
    return this.parent.detectNetwork();
  }
}

interface RevertError {
  error: {
    code: number;
    data: string;
  };
}

function isRevertError(e: any): e is RevertError {
  try {
    const error = CCIP_READ_INTERFACE.parseError(e?.error?.data);
    return error.name === 'OffchainLookup';
  } catch {
    return false;
  }
}

/**
 * Hack to ensure that revert data gets passed back from test nodes the same way as from real nodes.
 * This middleware catches Ganache's custom revert error and returns it as response data instead.
 */
class RevertNormalisingMiddleware extends ethers.providers.BaseProvider {
  readonly parent: ethers.providers.BaseProvider;

  constructor(provider: ethers.providers.BaseProvider) {
    super(provider.getNetwork());
    this.parent = provider;
  }

  getSigner(addressOrIndex?: string | number): JsonRpcSigner {
    return (this.parent as Web3Provider).getSigner(addressOrIndex);
  }

  async perform(method: string, params: any): Promise<any> {
    switch (method) {
      case 'call':
        try {
          return await this.parent.perform(method, params);
        } catch (e) {
          if (isRevertError(e)) {
            return e.error.data;
          }
          throw e;
        }
      default:
        const result = await this.parent.perform(method, params);
        return result;
    }
  }

  detectNetwork(): Promise<ethers.providers.Network> {
    return this.parent.detectNetwork();
  }
}

describe('End to end test', () => {
  const server = makeServer(DOH_QUERY_URL);

  async function fetcher(
    _url: string,
    json?: string,
    _processFunc?: (value: any, response: FetchJsonResponse) => any
  ) {
    // add error handling in case json is invalid
    const { sender: to, data } = JSON.parse(json as string);
    console.log('server, to, data', server, to, data);
    const ret = await server.call({ to, data });
    console.log('ret', ret);
    return ret;
  }
  const baseProvider = new ethers.providers.Web3Provider(
    ganache.provider({
      fork: {
        url: FORK_PROVIDER_URL,
      },
    })
  );
  const signer = baseProvider.getSigner();
  const proxyMiddleware = new RevertNormalisingMiddleware(baseProvider);
  const mockProvider = new MockProvider(proxyMiddleware, fetcher);
  let resolver: Contract;

  beforeAll(async () => {
    try {
      const code = await baseProvider.getCode(ENS_ADDRESS);
      if (code !== '0x') console.log('ENS contract is reachable.');
    } catch (error) {
      console.log('getCode error', error);
    }
    try {
      const code = await baseProvider.getCode(DNSSEC_IMPL);
      if (code !== '0x') console.log('DNSSEC_IMPL contract is reachable.');
    } catch (error) {
      console.log('getCode error', error);
    }

    resolver = (
      await deploySolidity(
        OffchainResolver_abi,
        signer,
        ENS_ADDRESS,
        DNSSEC_IMPL,
        TEST_URL
      )
    ).connect(mockProvider);
  });

  describe('resolve()', () => {
    it('resolves calls to addr(bytes32)', async () => {
      const callData = Resolver.encodeFunctionData('addr(bytes32)', [
        ethers.utils.namehash(TEST_NAME),
      ]);
      console.log('callData', callData);
      const dnsName = hexEncodeName(TEST_NAME);
      const response = await resolver.resolve(dnsName, callData);
      console.log('response', response);

      const extraData = ethers.utils.defaultAbiCoder.encode(
        ['bytes', 'bytes'],
        [dnsName, callData]
      );

      try {
        const resultCallback = await resolver.resolveCallback(
          response,
          extraData
        );
        const resultData = Resolver.decodeFunctionResult(
          'addr(bytes32)',
          resultCallback
        );

        expect(resultData).to.deep.equal([
          '0x0000000000000000000000000000000000000000',
        ]);
      } catch (e: any) {
        console.log('e', e?.error);
      }
    });

    // it('resolves calls to text(bytes32,string)', async () => {
    //   const dnsName = hexEncodeName(TEST_NAME);
    //   const callData = Resolver.encodeFunctionData('text(bytes32,string)', [
    //     ethers.utils.namehash(TEST_NAME),
    //     'email',
    //   ]);
    //   const response = await resolver.resolve(dnsName, callData);
    //   const extraData = ethers.utils.defaultAbiCoder.encode(
    //     ['bytes', 'bytes'],
    //     [dnsName, callData]
    //   );

    //   const resultCallback = await resolver.resolveCallback(
    //     response,
    //     extraData
    //   );

    //   const resultData = Resolver.decodeFunctionResult(
    //     'text(bytes32,string))',
    //     resultCallback
    //   );

    //   expect(resultData).to.deep.equal(['']);
    // });

    // it('resolves calls to contenthash(bytes32)', async () => {
    //   const dnsName = hexEncodeName(TEST_NAME);
    //   const callData = Resolver.encodeFunctionData('contenthash(bytes32)', [
    //     ethers.utils.namehash(TEST_NAME),
    //   ]);
    //   const response = await resolver.resolve(dnsName, callData);

    //   const extraData = ethers.utils.defaultAbiCoder.encode(
    //     ['bytes', 'bytes'],
    //     [dnsName, callData]
    //   );

    //   const resultCallback = await resolver.resolveCallback(
    //     response,
    //     extraData
    //   );

    //   const resultData = Resolver.decodeFunctionResult(
    //     'contenthash(bytes32)',
    //     resultCallback
    //   );

    //   expect(resultData).to.deep.equal('');
    // });
  });
});
