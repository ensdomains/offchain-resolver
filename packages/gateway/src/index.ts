import { makeApp } from './server';
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { JSONDatabase } from './json';
import 'dotenv/config'
console.log('****0')
console.log('****1', process.env)
require('dotenv').config()
console.log('****2')
let options:any = {}
console.log('****3')
if(process.env.OFFCHAIN_DATA && process.env.OFFCHAIN_PRIVATE_KEY){
  console.log('****4')
  options.data = process.env.OFFCHAIN_DATA
  options.privateKey = process.env.OFFCHAIN_PRIVATE_KEY
  options.ttl = process.env.OFFCHAIN_TTL
  options.port = process.env.OFFCHAIN_PORT
}else{
  console.log('****5')
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
console.log('****6')
console.log({options})
let privateKey = options.privateKey;
if (privateKey.startsWith('@')) {
  privateKey = ethers.utils.arrayify(
    readFileSync(privateKey.slice(1), { encoding: 'utf-8' })
  );
}
console.log('****7')
const address = ethers.utils.computeAddress(privateKey);
const signer = new ethers.utils.SigningKey(privateKey);
console.log('****8')
const db = JSONDatabase.fromFilename(options.data, parseInt(options.ttl));
console.log({db})
const app = makeApp(signer, '/', db);
console.log(`Serving on port ${options.port} with signing address ${address}`);
app.listen(parseInt(options.port));

// const express = require('express');
// const app = express();

// app.get('/', (_:any, res:any) => {
//   // res.status(200).send('Hello, world!1').end();
//   res.status(200).send(JSON.stringify(db)).end();
// });

// // Start the server
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//   console.log(`App listening on port ${PORT}`);
//   console.log('Press Ctrl+C to quit.');
// });
// // [END gae_node_request_example]

// module.exports = app;