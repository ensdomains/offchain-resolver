/**
 * Simple script to write json file into Cloudflare KV Store
 */

const fs = require('fs');
const spawn = require('child_process').spawn;

const jsonPath = 'test.eth.json';
const rawData = fs.readFileSync(jsonPath, { encoding: 'utf8' });

const putEntryToKVBash = spawn(
  'wrangler',
  ['kv:key', 'put', '--binding=OFFCHAIN_STORE_DEV', jsonPath, rawData, "--preview"]
);
putEntryToKVBash.stdout.on('data', data => {
  console.log(data.toString());
});
putEntryToKVBash.stderr.on('data', data => {
  console.error(data.toString());
});
putEntryToKVBash.stdout.on('exit', data => {
    console.log(data.toString());
});
