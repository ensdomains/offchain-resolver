# ENS Offchain Resolver Gateway - Cloudflare Worker
This package implements a simple CCIP-read gateway worker for ENS offchain resolution.

## Usage:
Before running the gateway worker, couple of configuration needs to be done as following;

### Local
1. Create a `dev.vars` file under `packages/gateway-worker/` folder
2. Put gateway private key into it in between double quotes, as below;
```
OG_PRIVATE_KEY="PRIVATE_KEY_HERE"
```
3. Run addToKV.js script to write test.eth.json file into Cloudflare KV Store
```
node addToKV.js -d test.eth.json
```
3. Run worker;
```
yarn && yarn build
yarn start
```

`private-key` should be an Ethereum private key that will be used to sign messages. You should configure your resolver contract to expect messages to be signed using the corresponding address.

`data` is the path to the data file; an example file is provided in `test.eth.json`.

### Deployment

1. Be sure all configurations mentioned in [local](#local) section are in place.
2. Add private key as a [Cloudflare Secret](https://blog.cloudflare.com/workers-secrets-environment/) with OG_PRIVATE_KEY key.
3. Deploy worker with `wrangler publish`

## Customisation
The JSON backend is implemented in [json.ts](src/json.ts), and implements the `Database` interface from [server.ts](src/server.ts). You can replace Cloudflare KV Store with your own database service by implementing the methods provided in that interface. If a record does not exist, you should return the zero value for that type - for example, requests for nonexistent text records should be responded to with the empty string, and requests for nonexistent addresses should be responded to with the all-zero address.

For an example of how to set up a gateway server with a custom database backend, see [index.ts](src/index.ts):
```
const signer = new ethers.utils.SigningKey(privateKey);

const db = JSONDatabase.fromKVStore(OFFCHAIN_STORE_DEV, parseInt(OG_TTL));

const app = makeApp(signer, '/', db);

module.exports = {
  fetch: function (request, _env, _context) {
    return app.handle(request)
  }
};

```
