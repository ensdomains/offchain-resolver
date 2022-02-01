import { makeApp } from './server';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { JSONDatabase } from './json';
import 'dotenv/config'
require('dotenv').config()
let options:any = {}
if(process.env.OFFCHAIN_DATA && process.env.OFFCHAIN_PRIVATE_KEY){
    options.data = process.env.OFFCHAIN_DATA
    options.privateKey = process.env.OFFCHAIN_PRIVATE_KEY
    options.ttl = process.env.OFFCHAIN_TTL
    options.port = process.env.OFFCHAIN_PORT
}else{
  const program = new Command();
  program
    .requiredOption(
      '-k --private-key <key>',
      'Private key to sign responses with. Prefix with @ to read from a file'
    )
    .requiredOption('-d --data <file>', 'JSON file to read data from')
    .option('-t --ttl <number>', 'TTL for signatures', '300')
    .option('-p --port <number>', 'Port number to serve on', '8000');
  program.parse(process.argv);
  options = program.opts();
}
console.log({options})
let privateKey = options.privateKey;
if (privateKey.startsWith('@')) {
  privateKey = ethers.utils.arrayify(
    readFileSync(privateKey.slice(1), { encoding: 'utf-8' })
  );
}
const address = ethers.utils.computeAddress(privateKey);
const signer = new ethers.utils.SigningKey(privateKey);

const db = JSONDatabase.fromFilename(options.data, parseInt(options.ttl));
console.log({db})
const app = makeApp(signer, '/', db);
console.log(`Serving on port ${options.port} with signing address ${address}`);
app.listen(parseInt(options.port));
