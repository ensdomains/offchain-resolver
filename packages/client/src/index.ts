import { Command } from 'commander';
import ethers from 'ethers';

const program = new Command();
program
  .requiredOption('-r --registry <address>', 'ENS registry address')
  .option('-p --provider <url>', 'web3 provider URL', 'http://localhost:8545/')
  .option('-i --chainId <chainId>', 'chainId', '31337')
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
  let resolveName = await provider.resolveName(name);
  if (resolver) {
    let content = await resolver.getContentHash();
    let email = await resolver.getText('email');

    console.log(`resolver address ${resolver.address}`);
    console.log(`eth address ${resolveName}`);
    console.log(`content ${content}`);
    console.log(`email ${email}`)
  } else {
    console.log(`resolver not found for ${name}`);
  }
})();
