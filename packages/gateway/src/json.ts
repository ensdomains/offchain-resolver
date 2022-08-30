import { Database } from './server';
import { readFileSync } from 'fs';

interface NameData {
  addresses?: { [coinType: number]: string };
  text?: { [key: string]: string };
  contenthash?: string;
}

type ZoneData = { [name: string]: NameData };

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_CONTENT_HASH = '0x';

export class JSONDatabase implements Database {
  data: ZoneData;
  ttl: number;

  constructor(data: ZoneData, ttl: number) {
    // Insert an empty synthetic wildcard record for every concrete name that doesn't have one
    // This is to ensure that if '*.eth' exists and 'test.eth' exists, 'blah.test.eth' does not resolve to '*.eth'.
    this.data = Object.assign({}, data);
    for (const k of Object.keys(this.data)) {
      if (!k.startsWith('*.') && !this.data['*.' + k]) {
        this.data['*.' + k] = {};
      }
    }
    this.ttl = ttl;
  }

  static fromFilename(filename: string, ttl: number) {
    return new JSONDatabase(
      JSON.parse(readFileSync(filename, { encoding: 'utf-8' })),
      ttl
    );
  }

  addr(name: string, coinType: number) {
    const nameData = this.findName(name);
    if (!nameData || !nameData.addresses || !nameData.addresses[coinType]) {
      return { addr: ZERO_ADDRESS, ttl: this.ttl };
    }
    return { addr: nameData.addresses[coinType], ttl: this.ttl };
  }

  text(name: string, key: string) {
    const nameData = this.findName(name);
    if (!nameData || !nameData.text || !nameData.text[key]) {
      return { value: '', ttl: this.ttl };
    }
    return { value: nameData.text[key], ttl: this.ttl };
  }

  contenthash(name: string) {
    const nameData = this.findName(name);
    if (!nameData || !nameData.contenthash) {
      return { contenthash: EMPTY_CONTENT_HASH, ttl: this.ttl };
    }
    return { contenthash: nameData.contenthash, ttl: this.ttl };
  }

  private findName(name: string) {
    if (this.data[name]) {
      return this.data[name];
    }

    const labels = name.split('.');
    for (let i = 1; i < labels.length + 1; i++) {
      name = ['*', ...labels.slice(i)].join('.');
      if (this.data[name]) {
        return this.data[name];
      }
    }
    return null;
  }
}
