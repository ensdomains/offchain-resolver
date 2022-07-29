import { Command } from 'commander';
import ethers from 'ethers';
import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
// import { abi as ENSRegistry_abi } from '@ensdomains/ens-contracts/artifacts/contracts/registry/ENSRegistry.sol/ENSRegistry.json';
import { abi as UniversalResolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/utils/UniversalResolver.sol/UniversalResolver.json';
import { abi as OffchainResolver_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/OffchainResolver.json';
import { abi as Gateway_abi } from '@ensdomains/ens-contracts/artifacts/contracts/utils/OffchainMulticallable.sol/BatchGateway.json';
import { abi as IResolverService_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json';
const IResolverService = new ethers.utils.Interface(IResolverService_abi);
import fetch from 'cross-fetch';

function getDnsName(name: string) {
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


// Almost all of this boilerplate will be unnecessary once ethers.js adds support
// for ENSIP 10 and EIP 3668, but we're *early*.
const ResolverI = new ethers.utils.Interface(Resolver_abi);
const GatewayI = new ethers.utils.Interface(Gateway_abi);


// const ENSRegistry = new ethers.utils.Interface(ENSRegistry_abi);
// const IExtendedResolver = new ethers.utils.Interface(IExtendedResolver_abi);


const program = new Command();
program
  .requiredOption('-r --registry <address>', 'ENS registry address')  
  .option('-p --provider <url>', 'web3 provider URL', 'http://localhost:8545/')
  .option('-i --chainId <chainId>', 'chainId', '1337')
  .option('-n --chainName <name>', 'chainName', 'unknown')
  .option('-u --uAddress <uaddress>', 'Universal Resolver address')
  .argument('<name>');

program.parse(process.argv);

const options = program.opts();
// {
//   options: {
//     provider: 'http://localhost:8545/',
//     chainId: '1337',
//     chainName: 'unknown',
//     registry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
//     uAddress: '0x71C95911E9a5D330f4D621842EC243EE1343292e'
//   }
// }

console.log(1, options)
const ensAddress = options.registry;
const uAddress = options.uAddress;
const chainId = parseInt(options.chainId);
const chainName = options.chainName;
console.log(2, {
  ensAddress,
  uAddress,
  chainId,
  chainName
})
const provider = new ethers.providers.JsonRpcProvider(options.provider, {
  chainId,
  // name: chainName,
  name: 'private',
  ensAddress,
});
console.log('3');
(async () => {
  const name = program.args[0];
  const node = ethers.utils.namehash(name);
  const dnsName = getDnsName("test.eth")
  console.log(4, {
    name, node, dnsName
  });
  const uResolver = new ethers.Contract(
    uAddress,
    UniversalResolver_abi,
    provider
  )

  console.log(5, {uResolver})
  
  console.log(6, {dnsName})
  // const result = await uResolver.callStatic.findResolver(dnsName);
  const [resolverAddress] = await uResolver.callStatic.findResolver(dnsName);
  if (resolverAddress) {
    console.log(7, {resolverAddress})
    const offchainResolver = new ethers.Contract(
      resolverAddress,
      OffchainResolver_abi,
      provider
    )
    console.log(8, {offchainResolver, ResolverI, Gateway_abi})
    // const data = offchainResolver.interface.encodeFunctionData('addr(bytes32)', [node]);
    const data = ResolverI.encodeFunctionData('addr(bytes32)', [node]);
    const iface = new ethers.utils.Interface(
      [
        "function addr(bytes32) returns(address)",
        // "function resolve(bytes,bytes) returns(bytes)",
        "function resolve(bytes,bytes) returns(bytes,uint64,bytes)",
        "function multicall(bytes[])"
      ]
    );
    const addrData = iface.encodeFunctionData("addr", [node]);

    console.log('addr(bytes32)',{
      sighash: iface.getSighash('addr(bytes32)'),
      node, data, addrData
    })

    console.log(9, {dnsName, addrData})
    console.log(10, offchainResolver.interface.encodeFunctionData)
    
    // // Encode the outer call to 'resolve'
    const callData = iface.encodeFunctionData("resolve", [dnsName, addrData]);
    // const callData = offchainResolver.interface.encodeFunctionData("resolve", [dnsName, addrData]);
    console.log('resolve(bytes,bytes)',{
      sighash: iface.getSighash('resolve(bytes,bytes)'),
      dnsName, addrData, callData
    })
    console.log(101)
    // // Encode the result data
    // resultData = iface.encodeFunctionResult("addr", [TEST_ADDRESS]);

    // // Generate a signature hash for the response from the gateway
    // const callDataHash = await resolver.makeSignatureHash(resolver.address, expires, callData, resultData);
    try{
      console.log(102)
      console.log('multicall',{
        sighash: offchainResolver.interface.getSighash('multicall')
      })
      console.log('query',{
        sighash: GatewayI.getSighash('query')
      })

      offchainResolver.interface.getSighash('multicall')
      console.log(103)
      const responseData = await offchainResolver.callStatic.multicall([callData]);
      console.log(104)
      console.log(10, {responseData})  
    }catch(e){
      if(e && e.errorArgs){
        console.log(11, [
          e.errorArgs,
          e.errorArgs.sender,
          e.errorArgs.urls,
          e.errorArgs.callData
        ])
        const url = e.errorArgs.urls[0];
        const lowerTo = e.errorArgs.sender.toLowerCase();
        const callData = e.errorArgs.callData;
        const multiCallData = iface.encodeFunctionData("multicall", [[callData]]);
        const gatewayData = GatewayI.decodeFunctionData("query", e.errorArgs.callData);
        const gatewayUrl = url.replace('{sender}', lowerTo).replace('{data}', callData);
        console.log(1, {gatewayUrl, multiCallData, callData})
        console.log('gatewayData', gatewayData[0])
        const result = await fetch(gatewayUrl);
        console.log(2, {result})
        const {data:resultData} = await result.json()
        console.log(3, {resultData})
        const {responses:decodedQuery} = GatewayI.decodeFunctionResult('query', resultData)
        console.log(4, {decodedQuery})
        const {result:addrResult, expires, sig} = IResolverService.decodeFunctionResult('resolve', decodedQuery[0])
        console.log(5, {addrResult, expires, sig})
        const finalResult = iface.decodeFunctionResult("addr", addrResult);
        console.log(6, {finalResult})
      }else{
        console.log(105, e)
      }
    }
    // const addr = Resolver.decodeFunctionResult('addr(bytes32)', responseData);
    // console.log(`addr: ${name}: ${addr}`);
  
    // const arg1 = 2 // anything below 5 is offchain
    // const arg2 = 2 // anything below 5 is offchain
    // const args = [arg1, arg2]
    // const encodedArgs = args.map(arg => resolver.interface.encodeFunctionData('doSomethingOffchain', [arg]))
    // const result = await resolver.callStatic.multicall(encodedArgs)
    // resolver.interface.decodeFunctionResult('doSomethingOffchain', result[0])[0].toNumber(), arg1);
  
  //   console.log(`resolver address ${resolver.address}`);
  //   let ethAddress = await resolver.getAddress();
  //   console.log(`eth address ${ethAddress}`);
  //   let btcAddress = await resolver.getAddress(0);
  //   console.log(`btc address ${btcAddress}`);
  //   let content = await resolver.getContentHash();
  //   console.log(`content ${content}`);
  // } else {
  //   console.log('no resolver found');
  }
})();
