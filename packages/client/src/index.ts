import { Command } from 'commander';
import ethers, { utils, BigNumber } from 'ethers';
import { formatsByCoinType } from '@ensdomains/address-encoder';

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
  let resolveName = await provider.resolveName(name);
  let btcAddress
  if(resolver){
    const encodedCoinType = utils.hexZeroPad(BigNumber.from(0).toHexString(), 32)
    const btcData = await resolver._fetchBytes('0xf1cb7e06', encodedCoinType)
    if(btcData){
      let buffer = Buffer.from(btcData.slice(2), "hex")
      btcAddress = formatsByCoinType[0].encoder(buffer);
    }
    console.log(`resolver address ${resolver.address}`);
    console.log(`address ${resolveName}`);
    console.log(`btc address ${btcAddress}`);
  }else{
    console.log('no resolver found')
  }
})();
