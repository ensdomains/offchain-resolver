import { Server } from '@chainlink/ccip-read-server';
import { Result } from 'ethers/lib/utils';
import fetch from 'cross-fetch';
import { abi as Gateway_abi } from '@ensdomains/ens-contracts/artifacts/contracts/utils/OffchainMulticallable.sol/BatchGateway.json';

export function makeServer() {
  const server = new Server();
  server.add(Gateway_abi, [
    {
      type: 'query',
      func: async ([data]: Result, request) => {
        const sender = request.to
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
  path: string
) {
  return makeServer().makeApp(path);
}
