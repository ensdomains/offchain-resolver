import { Command } from 'commander';
import ethers from 'ethers';

const program = new Command();
program
  .requiredOption('-r --registry <address>', 'ENS registry address')
  .option('-p --provider <url>', 'web3 provider URL', 'http://localhost:8545/')
  .option('-i --chainId <chainId>', 'chainId', '1337')
  .option('-n --chainName <name>', 'chainName', 'unknown')
  .argument('<name>');

program.parse(process.argv);
const options = program.opts();
const ensAddress = options.registry;
const chainId = parseInt(options.chainId);
const chainName = options.chainName;
const provider = new ethers.providers.JsonRpcProvider(options.provider, {
  chainId,
  name: chainName,
  ensAddress,
});
(async () => {
  const name = program.args[0];
  let resolver = await provider.getResolver(name);
  if (resolver) {
    console.log(`resolver address ${resolver.address}`);
    let ethAddress = await resolver.getAddress();
    console.log(`eth address ${ethAddress}`);
    let btcAddress = await resolver.getAddress(0);
    console.log(`btc address ${btcAddress}`);
    let content = await resolver.getContentHash();
    console.log(`content ${content}`);
  } else {
    console.log('no resolver found');
  }
})();
