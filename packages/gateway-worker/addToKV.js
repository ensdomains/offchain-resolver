/**
 * Simple script to write json file into Cloudflare KV Store
 */

const fs = require('fs');
const spawn = require('child_process').spawn;
const { Command } = require('commander');

const program = new Command();
program.option('-d, --data <file>', 'JSON file to read data from');

program.parse(process.argv);
const options = program.opts();

if (!options.data) {
  console.error('Error: No data file provided!');
  process.exit(1);
}

const jsonDataPath = options.data;
const rawData = fs.readFileSync(jsonDataPath, { encoding: 'utf8' });

const putEntryToKVBash = spawn('wrangler', [
  'kv:key',
  'put',
  '--binding=OFFCHAIN_STORE_DEV',
  jsonDataPath,
  rawData,
  '--preview',
]);
putEntryToKVBash.stdout.on('data', data => {
  console.log(data.toString());
});
putEntryToKVBash.stderr.on('data', data => {
  console.error(data.toString());
});
putEntryToKVBash.stdout.on('exit', data => {
  console.log(data.toString());
});
