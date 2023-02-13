import { makeApp } from './server';

const routeHandler = (env: any) => {
  const { DOH_API } = env;
  const app = makeApp(DOH_API, '/query');
  console.log(`Serving with DoH Resolver ${DOH_API}`);
  return app;
};

module.exports = {
  fetch: function(request: Request, env: any, _context: any) {
    const router = routeHandler(env);
    return router.handle(request) as any;
  },
};
