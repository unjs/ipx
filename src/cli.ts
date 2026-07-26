#!/usr/bin/env node
import { parseArgs } from "node:util";
import pkg from "ipx/package.json" with { type: "json" };

import { createIPX } from "./ipx.ts";
import { serveIPX } from "./server.ts";
import { ipxFSStorage } from "./storage/node-fs.ts";
import { ipxHttpStorage } from "./storage/http.ts";

// ---- CLI parsing ----
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: "string" },
    domains: { type: "string" },
    port: { type: "string" },
    host: { type: "string" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
});

const [command] = positionals;

// ---- Global flags ----
if (values.version) {
  console.log(`${pkg.name} ${pkg.version}`);
  process.exit(0);
}

if (values.help || !command) {
  printHelp();
  process.exit(0);
}

// ---- Commands ----
switch (command) {
  case "serve": {
    await runServe(values);
    break;
  }
  default: {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }
}

// ---- Command impl ----
async function runServe(args) {
  const ipx = createIPX({
    storage: ipxFSStorage({
      dir: args.dir ?? process.env.IPX_FS_DIR ?? process.cwd(),
    }),
    httpStorage: ipxHttpStorage({
      domains: args.domains ?? process.env.IPX_HTTP_DOMAINS,
    }),
  });

  const server = serveIPX(ipx, {
    port: Number(args.port ?? process.env.PORT ?? 3000),
    hostname: args.host ?? process.env.HOST ?? "0.0.0.0",
  });

  await server.ready();
}

// ---- Help output ----
function printHelp() {
  console.log(`
${pkg.name} ${pkg.version}

Usage:
  ipx serve [options]

Commands:
  serve                   Start IPX server

Options:
  --dir <dir>             Directory to serve (ENV: IPX_FS_DIR)
  --domains <list>        Allowed domains (comma separated, ENV: IPX_HTTP_DOMAINS)
  --port <number>         Port to listen (default: 3000, ENV: PORT)
  --host <host>           Host to bind (default: 0.0.0.0, ENV: HOST)
  -h, --help              Show help
  -v, --version           Show version
`);
}
