import { Server } from '@chainlink/ccip-read-server';
// import { ethers, BytesLike } from 'ethers';
// import { hexConcat, Result } from 'ethers/lib/utils';
import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';
import fetch from 'cross-fetch';

// import { ETH_COIN_TYPE } from './utils';
import { abi as IResolverService_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json';
// import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json';
import { abi as Resolver_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/OffchainResolver.json';
import { abi as Gateway_abi } from '@ensdomains/ens-contracts/artifacts/contracts/utils/OffchainMulticallable.sol/BatchGateway.json';
// import { abi as OffchainResolver_abi } from '@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/OffchainResolver.json';
// const Resolver = new ethers.utils.Interface(Resolver_abi);
const IResolverService = new ethers.utils.Interface(IResolverService_abi);
console.log({Resolver_abi})
console.log(JSON.stringify(IResolverService_abi[0], null, 2))
// const resolveAbi = Resolver_abi.map(c => c['name'] === 'resolve')[0]
console.log(Resolver_abi[7])
// interface DatabaseResult {
//   result: any[];
//   ttl: number;
// }

type PromiseOrResult<T> = T | Promise<T>;

export interface Database {
  addr(
    name: string,
    coinType: number
  ): PromiseOrResult<{ addr: string; ttl: number }>;
  text(
    name: string,
    key: string
  ): PromiseOrResult<{ value: string; ttl: number }>;
  contenthash(
    name: string
  ): PromiseOrResult<{ contenthash: string; ttl: number }>;
}


export function makeServer(signer: ethers.utils.SigningKey, db: Database) {
  const server = new Server();
  server.add(Gateway_abi, [
    {
      type: 'query',
      func: async ([data]: Result, request) => {
        console.log('*******111111', {data, request, signer, db})
        const d = data[0]
        console.log('*******111112', {d})
        const sender = request.to
        const url = d.urls[0]
        const callData = d.callData
        console.log('*******111113', {url, callData, sender})
        const gatewayUrl = url.replace('{sender}', sender).replace('{data}', callData);
        console.log('*******111114', {gatewayUrl})
        const result = await fetch(gatewayUrl);
        console.log('*******111114', {result})
        const {data:resultData} = await result.json()
        console.log('*******111117', resultData)
        let  decoded
        try{
          decoded = IResolverService.decodeFunctionResult('resolve', resultData)
        }catch(e){
          console.log('*******111118', e)
        }
        console.log('*******111119', decoded)
        return [[resultData]];
      },
    },
  ]);
  return server;
}

export function makeApp(
  signer: ethers.utils.SigningKey,
  path: string,
  db: Database
) {
  return makeServer(signer, db).makeApp(path);
}
