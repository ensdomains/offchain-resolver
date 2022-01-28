import { Database } from './server';
import { readFileSync } from 'fs';

interface NameData {
  addresses?: { [coinType: number]: string };
  text?: { [key: string]: string };
}

type ZoneData = { [name: string]: NameData };

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class JSONDatabase implements Database {
  data: ZoneData;
  ttl: number;

  constructor(data: ZoneData, ttl: number) {
    console.log('***JSONDatabase')
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
    console.log('***addr1', {name, coinType})
    // throw('*** throw addr')
    const nameData = this.findName(name);
    console.log('***addr2', {nameData})
    if (!nameData || !nameData.addresses || !nameData.addresses[coinType]) {
      console.log('***addr3')
      return { addr: ZERO_ADDRESS, ttl: this.ttl };
    }
    console.log('***addr4')
    return { addr: nameData.addresses[coinType], ttl: this.ttl };
  }

  text(name: string, key: string) {
    const nameData = this.findName(name);
    if (!nameData || !nameData.text || !nameData.text[key]) {
      return { value: ZERO_ADDRESS, ttl: this.ttl };
    }
    return { value: nameData.text[key], ttl: this.ttl };
  }


  private findName(name: string) {
    console.log('***findName')
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
