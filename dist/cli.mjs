import consola from 'consola';
import { listen } from 'listhen';
import { createIPX, createIPXMiddleware } from './index.mjs';
import 'defu';
import 'image-meta';
import 'ufo';
import 'node:fs';
import 'pathe';
import 'destr';
import 'node:http';
import 'node:https';
import 'node-fetch-native';
import '@fastify/accept-negotiator';
import 'etag';
import 'xss';

async function main() {
  const ipx = createIPX({});
  const middleware = createIPXMiddleware(ipx);
  await listen(middleware, {
    clipboard: false
  });
}
main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
