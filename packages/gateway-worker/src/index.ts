import { makeApp } from './server';
import { ethers } from 'ethers';
import { JSONDatabase } from './json';

const routeHandler = (env: any) => {
  const { OFFCHAIN_STORE_DEV, OG_PRIVATE_KEY, OG_TTL } = env;
  const privateKey = OG_PRIVATE_KEY;
  const address = ethers.utils.computeAddress(privateKey);
  const signer = new ethers.utils.SigningKey(privateKey);
  const db = JSONDatabase.fromKVStore(OFFCHAIN_STORE_DEV, parseInt(OG_TTL));
  const app = makeApp(signer, '/', db);
  console.log(`Serving with signing address ${address}`);
  return app;
};

module.exports = {
  fetch: function(request: Request, env: any, _context: any) {
    const router = routeHandler(env);
    return router.handle(request) as any;
  },
};
