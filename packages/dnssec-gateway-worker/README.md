# ENS Offchain DNS Resolver Gateway - Cloudflare Worker
This package implements a simple CCIP-read gateway worker for ENS offchain DNS resolution.

## Usage:
Before running the gateway worker, couple of configuration needs to be done as following;

### Local
1. Create a `.dev.vars` file under `packages/dnssec-gateway-worker/` folder (or just rename `dev.vars` to `.dev.vars`)
2. Put preffered DoH (DNS over HTTPS) Resolver API into it in between double quotes, as below;
```
DOH_API="DOH_API_URL_HERE"
```
3. Run worker;
```
yarn && yarn build
yarn start
```

### Deployment

1. Be sure all configurations mentioned in [local](#local) section are in place.
2. Deploy worker with `wrangler publish`
