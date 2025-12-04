#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { serve as srvx } from "srvx";

import { createIPX } from "./ipx.ts";
import { createIPXFetchHandler } from "./server.ts";
import { ipxFSStorage } from "./storage/node-fs.ts";
import { ipxHttpStorage } from "./storage/http.ts";

import pkg from "../package.json" with { type: "json" };

const serve = defineCommand({
  meta: {
    description: "Start IPX Server",
  },
  args: {
    dir: {
      type: "string",
      required: false,
      description:
        "Directory to serve (default: current directory) ENV: IPX_FS_DIR",
    },
    domains: {
      type: "string",
      required: false,
      description: "Allowed domains (comma separated) ENV: IPX_HTTP_DOMAINS",
    },
    port: {
      type: "string",
      required: false,
      description: "Server port (default: 3000) ENV: PORT",
    },
    host: {
      type: "string",
      required: false,
      description: "Server host (default: 0.0.0.0) ENV: HOST",
    },
  },
  async run({ args }) {
    const ipx = createIPX({
      storage: ipxFSStorage({
        dir: args.dir,
      }),
      httpStorage: ipxHttpStorage({
        domains: args.domains,
      }),
    });
    const server = srvx({
      fetch: createIPXFetchHandler(ipx),
      port: args.port,
      hostname: args.host,
    });
    await server.ready();
  },
});

const main = defineCommand({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  subCommands: {
    serve,
  },
});

runMain(main);
