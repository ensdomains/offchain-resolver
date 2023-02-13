import { Server } from '@ensdomains/ccip-read-cf-worker';
import { DNSProver, ProvableAnswer } from '@ensdomains/dnsprovejs';
import { getKeyTag, SignedSet } from '@ensdomains/dnsprovejs/dist/prove';
import { abi as IResolverService_abi } from '@ensdomains/ens-contracts/artifacts/contracts/dnsregistrar/OffchainDNSResolver.sol/IDNSGateway.json';

import { Result } from 'ethers/lib/utils';
import { TxtAnswer } from 'dns-packet';
import { Router } from 'itty-router';
import { hexDecodeName, hexEncodeSignedSet } from './utils';

function checkKeyTags(result: ProvableAnswer<TxtAnswer>) {
  let last = result.answer;
  for (const proof of result.proofs.reverse()) {
    switch (proof.records[0].type) {
      case 'DNSKEY':
        if (
          !proof.records
            .map((r: any) => getKeyTag(r))
            .includes(last.signature.data.keyTag)
        )
          throw Error(
            `${last.records[0].type} ${last.records[0].name} -> ${proof.records[0].type} ${proof.records[0].name}`
          );
        break;
      case 'DS':
        const dsTags = proof.records.map((r: any) => r.data.keyTag);
        const validKeys = last.records.filter((r: any) =>
          dsTags.includes(getKeyTag(r))
        );
        if (!validKeys || validKeys.length < 1)
          throw Error('Valid keys cannot be empty');
        if (
          !validKeys
            .map((r: any) => getKeyTag(r))
            .includes(last.signature.data.keyTag)
        )
          throw Error(
            `${last.records[0].type} ${last.records[0].name} -> ${proof.records[0].type} ${proof.records[0].name}`
          );
    }
    last = proof;
  }
}

export function makeServer(dohApi: string) {
  const server = new Server();
  // abi.encodeCall(IDNSGateway.resolve, (name, TYPE_TXT)),
  // abi: function resolve(bytes memory name, uint16 qtype) external returns(DNSSEC.RRSetWithSignature[] memory)
  server.add(IResolverService_abi, [
    {
      type: 'resolve',
      func: async ([encodedName, _type]: Result, _request) => {
        const name = hexDecodeName(encodedName);
        // Query the DNS
        const prover = DNSProver.create(dohApi);
        const dnsResult: ProvableAnswer<TxtAnswer> = (await prover.queryWithProof(
          'TXT',
          name
        )) as ProvableAnswer<TxtAnswer>;

        checkKeyTags(dnsResult);

        const proof = [
          hexEncodeSignedSet(dnsResult.proofs.at(-1) as SignedSet<any>),
          hexEncodeSignedSet(dnsResult.answer as SignedSet<any>),
        ];
        return [proof];
      },
    },
  ]);
  return server;
}

export function makeApp(dohApi: string, path: string): Router {
  return makeServer(dohApi).makeApp(path);
}
