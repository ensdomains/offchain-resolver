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
    let ethAddress = await resolver.getAddress();
    let btcAddress = await resolver.getAddress(0);
    let content = await resolver.getContentHash();
    let email = await resolver.getText('email');
    console.log(`resolver address ${resolver.address}`);
    console.log(`eth address ${ethAddress}`);
    console.log(`btc address ${btcAddress}`);
    console.log(`content ${content}`);
    console.log(`email ${email}`);
  } else {
    console.log('no resolver found');
  }
})();
