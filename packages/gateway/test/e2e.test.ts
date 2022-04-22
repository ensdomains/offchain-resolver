/// <reference types="./ganache-cli" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'ethers';
import ganache from 'ganache-cli';
import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers';
import { FetchJsonResponse } from '@ethersproject/web';
import { JSONDatabase } from '../src/json';
import { makeServer } from '../src/server';
import { ETH_COIN_TYPE } from '../src/utils';
import Resolver_abi from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
import OffchainResolver_abi from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/OffchainResolver.json';
import {
  BaseProvider,
  BlockTag,
  TransactionRequest,
  Network,
} from '@ethersproject/providers';
import { fetchJson } from '@ethersproject/web';
import { arrayify, BytesLike, hexlify } from '@ethersproject/bytes';
chai.use(chaiAsPromised);

export type Fetch = (
  url: string,
  json?: string,
  processFunc?: (value: any, response: FetchJsonResponse) => any
) => Promise<any>;

const Resolver = new ethers.utils.Interface(Resolver_abi.abi);

const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_URL = 'http://localhost:8080/rpc/{sender}/{data}.json';

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
    const template = urls[0];
    const url = template.replace(
      /\{([^}]*)\}/g,
      (_match, p1: keyof typeof args) => args[p1]
    );
    const data = await fetcher(
      url,
      template.includes('{data}') ? undefined : JSON.stringify(args),
      processFunc
    );
    return data.body.data;
  }

  detectNetwork(): Promise<Network> {
    return this.parent.detectNetwork();
  }
}

interface RevertError {
  error: {
    hashes: string[];
    results: {
      [name: string]: {
        return: string;
      };
    };
  };
}

function isRevertError(e: any): e is RevertError {
  return typeof e?.error?.hashes[0] === 'string';
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
            const error = e.error as any;
            const hash = error.hashes[0];
            if (error.hashes !== undefined && error.hashes.length > 0) {
              return error.results[hash].return;
            }
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

const TEST_DB = {
  '*.eth': {
    addresses: {
      [ETH_COIN_TYPE]: '0x2345234523452345234523452345234523452345',
    },
    text: { email: 'wildcard@example.com' },
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

describe('End to end test', () => {
  const key = new ethers.utils.SigningKey(TEST_PRIVATE_KEY);
  const signerAddress = ethers.utils.computeAddress(key.privateKey);
  const db = new JSONDatabase(TEST_DB, 300);
  const server = makeServer(key, db);

  async function fetcher(
    url: string,
    _json?: string,
    _processFunc?: (value: any, response: FetchJsonResponse) => any
  ) {
    const [to, data] = (url.match(
      /http:\/\/localhost:8080\/rpc\/([^/]+)\/([^/]+).json/
    ) as RegExpMatchArray).slice(1);
    const ret = await server.call({ to, data });
    return ret;
  }

  const baseProvider = new ethers.providers.Web3Provider(ganache.provider());
  const signer = baseProvider.getSigner();
  const proxyMiddleware = new RevertNormalisingMiddleware(baseProvider);
  const mockProvider = new MockProvider(proxyMiddleware, fetcher);

  let resolver: ethers.Contract;
  let snapshot: number;

  beforeAll(async () => {
    resolver = (
      await deploySolidity(OffchainResolver_abi, signer, TEST_URL, [
        signerAddress,
      ])
    ).connect(mockProvider);
    snapshot = await baseProvider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await baseProvider.send('evm_revert', [snapshot]);
  });

  describe('resolve()', () => {
    it('resolves calls to addr(bytes32)', async () => {
      const callData = Resolver.encodeFunctionData('addr(bytes32)', [
        ethers.utils.namehash('test.eth'),
      ]);
      const result = await resolver.resolve(dnsName('test.eth'), callData);
      const resultData = Resolver.decodeFunctionResult('addr(bytes32)', result);
      expect(resultData).to.deep.equal([
        TEST_DB['test.eth'].addresses[ETH_COIN_TYPE],
      ]);
    });

    it('resolves calls to text(bytes32,string)', async () => {
      const callData = Resolver.encodeFunctionData('text(bytes32,string)', [
        ethers.utils.namehash('test.eth'),
        'email',
      ]);
      const result = await resolver.resolve(dnsName('test.eth'), callData);
      const resultData = Resolver.decodeFunctionResult(
        'text(bytes32,string)',
        result
      );
      expect(resultData).to.deep.equal([TEST_DB['test.eth'].text['email']]);
    });
    it('resolves calls to contenthash(bytes32)', async () => {
      const callData = Resolver.encodeFunctionData('contenthash(bytes32)', [
        ethers.utils.namehash('test.eth'),
      ]);
      const result = await resolver.resolve(dnsName('test.eth'), callData);
      const resultData = Resolver.decodeFunctionResult(
        'contenthash(bytes32)',
        result
      );
      expect(resultData).to.deep.equal([TEST_DB['test.eth'].contenthash]);
    });
  });
});
