import { JSONDatabase } from '../src/json';
import { ETH_COIN_TYPE } from '../src/utils';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_CONTENT_HASH = '0x';

const TEST_DB = {
  '*.eth': {
    addresses: {
      [ETH_COIN_TYPE]: '0x2345234523452345234523452345234523452345',
    },
    text: {
      email: 'info@example.com',
      description: 'hello offchainresolver record',
    },
    contenthash: 'ipfs://QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB',
  },
  'test.eth': {
    addresses: {
      [ETH_COIN_TYPE]: '0x3456345634563456345634563456345634563456',
    },
    text: {
      email: 'info@example.com',
      description: 'hello offchainresolver record',
    },
  },
};

describe('JSONDatabase', () => {
  const db = new JSONDatabase(TEST_DB, 300);

  it('returns the zero address for nonexistent names', () => {
    expect(db.addr('test.test', ETH_COIN_TYPE)).toStrictEqual({
      addr: ZERO_ADDRESS,
      ttl: 300,
    });
  });

  it('resolves exact names', () => {
    expect(db.addr('test.eth', ETH_COIN_TYPE)).toStrictEqual({
      addr: TEST_DB['test.eth'].addresses[ETH_COIN_TYPE],
      ttl: 300,
    });
  });

  it('resolves wildcards', () => {
    expect(db.addr('foo.eth', ETH_COIN_TYPE)).toStrictEqual({
      addr: TEST_DB['*.eth'].addresses[ETH_COIN_TYPE],
      ttl: 300,
    });
  });

  it('resolves text', () => {
    expect(db.text('foo.eth', 'email')).toStrictEqual({
      value: TEST_DB['*.eth'].text['email'],
      ttl: 300,
    });

    expect(db.text('foo.eth', 'description')).toStrictEqual({
      value: TEST_DB['*.eth'].text['description'],
      ttl: 300,
    });
  });

  it('resolves content', () => {
    expect(db.contenthash('foo.eth')).toStrictEqual({
      contenthash: TEST_DB['*.eth'].contenthash,
      ttl: 300,
    });
  });

  it('resolves empty contenthash when no contenthash is set', () => {
    expect(db.contenthash('test.eth')).toStrictEqual({
      contenthash: EMPTY_CONTENT_HASH,
      ttl: 300,
    });
  });

  it('resolves multiple levels of wildcard', () => {
    expect(db.addr('bar.foo.eth', ETH_COIN_TYPE)).toStrictEqual({
      addr: TEST_DB['*.eth'].addresses[ETH_COIN_TYPE],
      ttl: 300,
    });
  });

  it('stops when encountering a non-wildcard label', () => {
    expect(db.addr('blah.test.eth', ETH_COIN_TYPE)).toStrictEqual({
      addr: ZERO_ADDRESS,
      ttl: 300,
    });
  });
});

describe('makeApp', () => {});
