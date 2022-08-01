# ENS Offchain Resolver
![CI](https://github.com/ensdomains/offchain-resolver/actions/workflows/main.yml/badge.svg)


This repository contains smart contracts and a node.js gateway server that together allow hosting ENS names offchain using [EIP 3668](https://eips.ethereum.org/EIPS/eip-3668) and [ENSIP 10](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution).

## Overview

ENS resolution requests to the resolver implemented in this repository are responded to with a directive to query a gateway server for the answer. The gateway server generates and signs a response, which is sent back to the original resolver for decoding and verification. Full details of this request flow can be found in EIP 3668.

All of this happens transparently in supported clients (such as ethers.js with the ethers-ccip-read-provider plugin, or future versions of ethers.js which will have this functionality built-in).

## [Gateway Server](packages/gateway)

The gateway server implements CCIP Read (EIP 3668), and answers requests by looking up the names in a backing store. By default this is a JSON file, but the backend is pluggable and alternate backends can be provided by implementing a simple interface. Once a record is retrieved, it is signed using a user-provided key to assert its validity, and both record and signature are returned to the caller so they can be provided to the contract that initiated the request.

## [Contracts](packages/contracts)

The smart contract provides a resolver stub that implement CCIP Read (EIP 3668) and ENS wildcard resolution (ENSIP 10). When queried for a name, it directs the client to query the gateway server. When called back with the gateway server response, the resolver verifies the signature was produced by an authorised signer, and returns the response to the client.

## Trying it out

Start by generating an Ethereum private key; this will be used as a signing key for any messages signed by your gateway service. You can use a variety of tools for this; for instance, this Python snippet will generate one for you:

```
python3 -c "import os; import binascii; print('0x%s' % binascii.hexlify(os.urandom(32)).decode('utf-8'))"
```

For the rest of this demo we will be using the standard test private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`.

First, install dependencies and build all packages:

```bash
yarn && yarn build
```

Next, run the gateway:

```bash
yarn start:gateway --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --data test.eth.json
```

The value for the `--private-key` flag should be the key you generated earlier.

You will see output similar to the following:
```
Serving on port 8000 with signing address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

Take a look at the data in `test.eth.json` under `packages/gateway/`; it specifies addresses for the name `test.eth` and the wildcard `*.test.eth`.

Next, edit `packages/contracts/hardhat.config.js`; replacing the address on line 59 with the one output when you ran the command above. Then, in a new terminal, build and run a test node with an ENS registry, the offchain resolver, and the Universal resolver deployed:

```
cd packages/contracts
npx hardhat node
```

You will see output similar to the following:

```
Compilation finished successfully
deploying "ENSRegistry" (tx: 0xded902cec50a22b4d797a27c88bf3a96a9d1bdbb41b6b40342cad729a18cee8d)...: deployed at 0x5FbDB2315678afecb367f032d93F642f64180aa3 with 743372 gas
deploying "OffchainResolver" (tx: 0xd07d38decf02acff262ef085420fc1956233b6eb4d025a594915839835c21f60)...: deployed at 0x8464135c8F25Da09e49BC8782676a84730C318bC with 2086937 gas
***registry 0x5FbDB2315678afecb367f032d93F642f64180aa3
deploying "UniversalResolver" (tx: 0x1b666104bb78a5a22b1914a5902426975a88eaaab23ec275c4b92fe4d7bc1008)...: deployed at 0x71C95911E9a5D330f4D621842EC243EE1343292e with 1566841 gas
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/


Accounts
========

WARNING: These accounts, and their private keys, are publicly known.
Any funds sent to them on Mainnet or any other live network WILL BE LOST.

Account #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

(truncated for brevity)
```

Take note of the address to which the ENSRegistry was deployed (0x5FbDB...).

Finally, in a third terminal, run the example client to demonstrate resolving a name:

```
yarn start:client --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 test.eth
yarn start:client --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 foo.test.eth
```

You should see output similar to the following:

```
$ yarn start:client --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 test.eth
yarn run v1.22.17
$ node packages/client/dist/index.js --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 test.eth
test.eth: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Done in 0.28s.

$ yarn start:client --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 foo.test.eth
yarn run v1.22.17
$ node packages/client/dist/index.js --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 foo.test.eth
foo.test.eth: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Done in 0.23s.
```

Check these addresses against the gateway's `test.eth.json` and you will see that they match.


## Batch gateway

The normal gateway can only request single record at a time.
The batch gateway will make use of of `OffchainMulticallable.multicall` function that combines multiple calls.

To use the batch gateway, start the gateway server

```
yarn start:batch:gateway
yarn run v1.22.18
$ yarn workspace @ensdomains/offchain-resolver-batch-gateway start
$ node dist/index.js
Serving on port 8081
```

Then runs the batch client 

```
 yarn start:batch:client  --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --uAddress 0x71C95911E9a5D330f4D621842EC243EE1343292e foo.test.eth
yarn run v1.22.18
$ yarn workspace @ensdomains/offchain-resolver-batch-client start --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --uAddress 0x71C95911E9a5D330f4D621842EC243EE1343292e foo.test.eth
$ node dist/index.js --registry 0x5FbDB2315678afecb367f032d93F642f64180aa3 --uAddress 0x71C95911E9a5D330f4D621842EC243EE1343292e foo.test.eth
{
  name: 'foo.test.eth',
  coinType: 60,
  finalResult: [ '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' ],
  decodedResult: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
}
{
  name: 'foo.test.eth',
  coinType: 0,
  finalResult: [ '0x0000000000000000000000000000000000000000' ],
  decodedResult: 'bc1q9zpgru'
}
✨  Done in 1.27s.
```

### How it works.

The batch client and gateway go through the following sequence.

- Call `UniversalResolver.findResolver(dnsname)` to find the correct offchain resolver
- Encode `addr(node,coinType)` call into `addrData`
- Encode `resolver(dnsname, addrData)` into `callData`
- Combine `callData` into the array of `callDatas`
- Call `offchainResolver.multicall(callDatas)`
- Catch `OffchainLookup` error that encodes `Gateway.query(callDatas)` as callData
- Call the gateway server
- The batch gateway server decodes `Gateway.query(callDatas)` and call each gateway server in parallel
- Once the client receive the response, decode in the order of `Gateway.query` -> `ResolverService.resolve` -> `Resolver.addr(node, cointype)`
- Decode each coin cointype

### Todo

- Make batch gateway deployable
- Handle partial failure
- Fix lint errors

## Real-world usage

There are 5 main steps to using this in production:

 1. Optionally, write a new backend for the gateway that queries your own data store. Or, use the JSON one and write your records to a JSON file in the format described in the gateway repository.
 2. Generate one or more signing keys. Secure these appropriately; posession of the signing keys makes it possible to forge name resolution responses!
 3. Start up a gateway server using your name database and a signing key. Publish it on a publicly-accessible URL.
 4. Deploy `OffchainResolver` to Ethereum, providing it with the gateway URL and list of signing key addresses.
 5. Set the newly deployed resolver as the resolver for one or more ENS names.
