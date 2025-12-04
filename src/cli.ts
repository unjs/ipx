import { listen } from "listhen";
import { defineCommand, runMain } from "citty";
import {
  getArgs as listhenArgs,
  parseArgs as parseListhenArgs,
} from "listhen/cli";
import {
  name,
  version,
  description,
} from "../package.json" with { type: "json" };
import { createIPX } from "./ipx.ts";
import { createIPXNodeServer } from "./server.ts";
import { ipxFSStorage } from "./storage/node-fs.ts";
import { ipxHttpStorage } from "./storage/http.ts";

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
    ...listhenArgs(),
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
    await listen(createIPXNodeServer(ipx), {
      name: "IPX",
      ...parseListhenArgs(args),
    });
  },
});

const main = defineCommand({
  meta: {
    name,
    version,
    description,
  },
  subCommands: {
    serve,
  },
});

runMain(main);
