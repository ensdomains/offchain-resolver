import { Server } from '@ensdomains/ccip-read-cf-worker';
import { DNSProver, ProvableAnswer } from '@ensdomains/dnsprovejs';
import { getKeyTag } from '@ensdomains/dnsprovejs/dist/prove';
import { ethers } from 'ethers';
import { Result } from 'ethers/lib/utils';
import { Router } from 'itty-router';
import { abi as IResolverService_abi } from '@ensdomains/ens-contracts/artifacts/contracts/dnsregistrar/OffchainDNSResolver.sol/OffchainDNSResolver.json';
import { abi as Resolver_abi } from '@ensdomains/ens-contracts/artifacts/contracts/resolvers/PublicResolver.sol/PublicResolver.json';
import { TxtAnswer } from 'dns-packet';
const Resolver = new ethers.utils.Interface(Resolver_abi);

interface RecordsResult {
  result: any[];
  ttl: number;
}

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
        console.log(validKeys);
        if (!validKeys || validKeys.length < 1)
          throw Error('Valid keys cannot be empty');
        console.log(validKeys.map((r: any) => getKeyTag(r)));
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

function decodeDnsName(dnsname: Buffer) {
  const labels = [];
  let idx = 0;
  while (true) {
    const len = dnsname.readUInt8(idx);
    if (len === 0) break;
    labels.push(dnsname.slice(idx + 1, idx + len + 1).toString('utf8'));
    idx += len + 1;
  }
  return labels.join('.');
}

const queryHandlers: {
  [key: string]: (records: TxtAnswer[], args: Result) => Promise<RecordsResult>;
} = {
  'addr(bytes32)': async (records, _args) => {
    const { data, ttl } = records.filter(item => {
      return item.data.toString().startsWith('a=');
    })[0];
    return { result: [data.toString().replace('a=', '')], ttl: ttl || 0 };
  },
  'addr(bytes32,uint256)': async (records, _args) => {
    const { data, ttl } = records.filter(item => {
      return item.data.toString().startsWith('a=');
    })[0];
    return { result: [data.toString().replace('a=', '')], ttl: ttl || 0 };
    // const { addr, ttl } = await db.addr(name, args[0]);
    // return { result: [addr], ttl };
  },
  // 'text(bytes32,string)': async (records, args) => {
  //   const { value, ttl } = await db.text(name, args[0]);
  //   return { result: [value], ttl };
  // },
  // 'contenthash(bytes32)': async (records, _args) => {
  //   const { contenthash, ttl } = await db.contenthash(name);
  //   return { result: [contenthash], ttl };
  // },
  // 'dnsRecord(bytes32,bytes32,uint16)': async (records, args) => {
  //   const { dnsRecord, ttl } = await db.dnsRecord(name, args[0], args[1]);
  //   return { result: [dnsRecord], ttl };
  // },
  // 'hasDNSRecords(bytes32,bytes32)': async (records, args) => {
  //   const { hasDNSRecords, ttl } = await db.hasDNSRecords(name, args[0]);
  //   return { result: [hasDNSRecords], ttl };
  // },
  // 'zonehash(bytes32)': async (records, _args) => {
  //   const {zonehash, ttl} = await db.zonehash(name);
  //   return { result: [zonehash], ttl };
  // },
};

async function query(
  records: TxtAnswer[],
  name: string,
  data: string
): Promise<{ result: any; validUntil: number }> {
  // Parse the data nested inside the second argument to `resolve`
  const { signature, args } = Resolver.parseTransaction({ data });

  if (ethers.utils.nameprep(name) !== name) {
    throw new Error('Name must be normalised');
  }

  if (ethers.utils.namehash(name) !== args[0]) {
    throw new Error('Name does not match namehash');
  }

  const handler = queryHandlers[signature];
  if (handler === undefined) {
    throw new Error(`Unsupported query function ${signature}`);
  }

  const { result, ttl } = await handler(records, args.slice(1));
  // console.log('result, ttl', result, ttl);
  return {
    result: Resolver.encodeFunctionResult(signature, result),
    validUntil: Math.floor(Date.now() / 1000 + ttl),
  };
}

export function makeServer(dnsServer: string) {
  const server = new Server();
  server.add(IResolverService_abi, [
    {
      type: 'resolve',
      func: async ([encodedName, data]: Result, _request) => {
        const name = decodeDnsName(Buffer.from(encodedName.slice(2), 'hex'));
        // Query the DNS
        const prover = DNSProver.create(dnsServer);
        const dnsResult: ProvableAnswer<TxtAnswer> = (await prover.queryWithProof(
          'TXT',
          `_ens.${name}`
        )) as ProvableAnswer<TxtAnswer>;

        checkKeyTags(dnsResult);

        const {
          answer: { records },
        } = dnsResult;

        const { result } = await query(records, encodedName, data);

        const proof = [dnsResult.proofs.at(-1), dnsResult.proofs.at(-2)];

        // change it with DNSSEC proof

        // get the DNSSEC proof and return only that bit

        // https://github.com/ensdomains/ens-contracts/blob/ccip-dnsregistrar/contracts/dnssec-oracle/DNSSEC.sol#L8

        return [proof, result.answer.signature];
      },
    },
  ]);
  return server;
}

export function makeApp(dnsServer: string, path: string): Router {
  return makeServer(dnsServer).makeApp(path);
}
