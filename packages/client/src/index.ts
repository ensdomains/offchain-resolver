import { Command } from 'commander';
import ethers from 'ethers';
import { CCIPReadProvider } from '@chainlink/ethers-ccip-read-provider';
import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
import { abi as ENSRegistry_abi } from '@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json';
import { abi as IExtendedResolver_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/IExtendedResolver.sol/IExtendedResolver.json';

// Almost all of this boilerplate will be unnecessary once ethers.js adds support
// for ENSIP 10 and EIP 3668, but we're *early*.
const Resolver = new ethers.utils.Interface(Resolver_abi);
const ENSRegistry = new ethers.utils.Interface(ENSRegistry_abi);
const IExtendedResolver = new ethers.utils.Interface(IExtendedResolver_abi);

function dnsName(name: string) {
  // strip leading and trailing .
  const n = name.replace(/^\.|\.$/gm, '');

  var bufLen = n === '' ? 1 : n.length + 2;
  var buf = Buffer.allocUnsafe(bufLen);

  let offset = 0;
  if (n.length) {
    const list = n.split('.');
    for (let i = 0; i < list.length; i++) {
      const len = buf.write(list[i], offset + 1);
      buf[offset] = len;
      offset += len + 1;
    }
  }
  buf[offset++] = 0;
  return (
    '0x' +
    buf.reduce(
      (output, elem) => output + ('0' + elem.toString(16)).slice(-2),
      ''
    )
  );
}

const program = new Command();
program
  .requiredOption('-r --registry <address>', 'ENS registry address')
  .option('-p --provider <url>', 'web3 provider URL', 'http://localhost:8545/')
  .argument('<name>');

program.parse(process.argv);

const options = program.opts();
const baseProvider = ethers.getDefaultProvider(options.provider);
const provider = new CCIPReadProvider(baseProvider);

(async () => {
  try {
    const registry = new ethers.Contract(
      options.registry,
      ENSRegistry,
      provider
    );
    const name = program.args[0];
    const node = ethers.utils.namehash(name);

    const labels = name.split('.');
    let resolverAddress = undefined;
    for (let i = 0; i < labels.length; i++) {
      resolverAddress = await registry.resolver(
        ethers.utils.namehash(labels.slice(i).join('.'))
      );
      if (resolverAddress !== '0x0000000000000000000000000000000000000000') {
        break;
      }
    }
    if (resolverAddress === undefined) {
      console.log(`${name} could not be resolved`);
    }

    const resolver = new ethers.Contract(
      resolverAddress,
      IExtendedResolver,
      provider
    );
    const data = Resolver.encodeFunctionData('addr(bytes32)', [node]);
    const responseData = await resolver.resolve(dnsName(name), data);
    const addr = Resolver.decodeFunctionResult('addr(bytes32)', responseData);
    console.log(`addr: ${name}: ${addr}`);

    const textData = Resolver.encodeFunctionData('text(bytes32,string)', [
      node,
      'description',
    ]);
    const textResponseData = await resolver.resolve(dnsName(name), textData);
    const value = Resolver.decodeFunctionResult(
      'text(bytes32,string)',
      textResponseData
    );
    console.log(`text('description'): ${name}: ${value}`);
  } catch (e) {
    console.log(e);
  }
})();
