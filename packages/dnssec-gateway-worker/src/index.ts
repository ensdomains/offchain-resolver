import { makeApp } from './server';
import { ethers } from 'ethers';

const routeHandler = (env: any) => {
  const { OG_PRIVATE_KEY, DNS_SERVER } = env;
  const privateKey = OG_PRIVATE_KEY;
  const address = ethers.utils.computeAddress(privateKey);
  const app = makeApp(DNS_SERVER, '/');
  console.log(`Serving with signing address ${address}`);
  return app;
};

module.exports = {
  fetch: function(request: Request, env: any, _context: any) {
    const router = routeHandler(env);
    return router.handle(request) as any;
  },
};
