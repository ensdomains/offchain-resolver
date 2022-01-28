import { JSONDatabase } from '../src/json';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TEST_DB = {
  '*.eth': {
    addresses: {
      42: '0x2345234523452345234523452345234523452345',
    },
  },
  'test.eth': {
    addresses: {
      42: '0x3456345634563456345634563456345634563456',
    },
  },
};

describe('JSONDatabase', () => {
  const db = new JSONDatabase(TEST_DB, 300);

  it('returns the zero address for nonexistent names', () => {
    expect(db.addr('test.test', 42)).toStrictEqual({
      addr: ZERO_ADDRESS,
      ttl: 300,
    });
  });

  it('resolves exact names', () => {
    expect(db.addr('test.eth', 42)).toStrictEqual({
      addr: TEST_DB['test.eth'].addresses[42],
      ttl: 300,
    });
  });

  it('resolves wildcards', () => {
    expect(db.addr('foo.eth', 42)).toStrictEqual({
      addr: TEST_DB['*.eth'].addresses[42],
      ttl: 300,
    });
  });

  it('resolves multiple levels of wildcard', () => {
    expect(db.addr('bar.foo.eth', 42)).toStrictEqual({
      addr: TEST_DB['*.eth'].addresses[42],
      ttl: 300,
    });
  });

  it('stops when encountering a non-wildcard label', () => {
    expect(db.addr('blah.test.eth', 42)).toStrictEqual({
      addr: ZERO_ADDRESS,
      ttl: 300,
    });
  });
});

describe('makeApp', () => {});
