import packet from 'dns-packet'
import { SignedSet } from '@ensdomains/dnsprovejs';

export const ETH_COIN_TYPE = 60;

export function hexEncodeSignedSet(keys: SignedSet<any>) {
  return [keys.toWire(), keys.signature.data.signature]
}

export function hexEncodeName(name: string) {
    return '0x' + (packet as any).name.encode(name).toString('hex')
}

export function hexDecodeName(hex: string) {
  return (packet as any).name.decode(Buffer.from(hex.slice(2), 'hex')).toString()
}

export function rootKeys(expiration: any, inception: any) {
    var name = '.'
    var sig = {
      name: '.',
      type: 'RRSIG',
      ttl: 0,
      class: 'IN',
      flush: false,
      data: {
        typeCovered: 'DNSKEY',
        algorithm: 253,
        labels: 0,
        originalTTL: 3600,
        expiration,
        inception,
        keyTag: 1278,
        signersName: '.',
        signature: new Buffer([]),
      },
    }

    var rrs = [
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: { flags: 0, algorithm: 253, key: Buffer.from('0000', 'HEX' as any) },
      },
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: { flags: 0, algorithm: 253, key: Buffer.from('1112', 'HEX' as any) },
      },
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: {
          flags: 0x0101,
          algorithm: 253,
          key: Buffer.from('0000', 'HEX' as any),
        },
      },
    ]
    return { name, sig, rrs }
}
const validityPeriod = 2419200
const expiration = Date.now() / 1000 - 15 * 60 + validityPeriod
const inception = Date.now() / 1000 - 15 * 60
        
export const testRrset = (name: string, value: string) => ({
    name,
    sig: {
      name: name,
      type: 'RRSIG',
      ttl: 0,
      class: 'IN',
      flush: false,
      data: {
        typeCovered: 'TXT',
        algorithm: 253,
        labels: name.split('.').length,
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
        name,
        type: 'TXT',
        class: 'IN',
        ttl: 3600,
        data: Buffer.from(value, 'ascii'),
      },
    ],
  });