import { Server } from '@chainlink/ccip-read-server';
import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';
import fetch from 'cross-fetch';
import { abi as Gateway_abi } from '@ensdomains/ens-contracts/artifacts/contracts/utils/OffchainMulticallable.sol/BatchGateway.json';

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
        const sender = request.to
        console.log({signer, db})
        let responses = await Promise.all(
          data.map((d:any) => {
            const url = d.urls[0]
            const callData = d.callData
            const gatewayUrl = url.replace('{sender}', sender).replace('{data}', callData);
            return fetch(gatewayUrl).then(response => response.json());
          })
        )
        return [responses.map((r:any) => r.data )];
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
