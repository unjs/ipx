'use strict';

const consola = require('consola');
const listhen = require('listhen');
const index = require('./index.cjs');
require('defu');
require('image-meta');
require('ufo');
require('node:fs');
require('pathe');
require('destr');
require('node:http');
require('node:https');
require('node-fetch-native');
require('@fastify/accept-negotiator');
require('etag');
require('xss');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const consola__default = /*#__PURE__*/_interopDefaultCompat(consola);

async function main() {
  const ipx = index.createIPX({});
  const middleware = index.createIPXMiddleware(ipx);
  await listhen.listen(middleware, {
    clipboard: false
  });
}
main().catch((error) => {
  consola__default.error(error);
  process.exit(1);
});
