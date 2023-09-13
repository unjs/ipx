import { listen } from "listhen";
import { defineCommand, runMain } from "citty";
import {
  getArgs as listhenArgs,
  parseArgs as parseListhenArgs,
} from "listhen/cli";
import { name, version, description } from "../package.json";
import { createIPX } from "./ipx";
import { createIPXMiddleware } from "./middleware";
import { ipxFSStorage } from "./storage/node-fs";
import { ipxHttpStorage } from "./storage/http";

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
    const middleware = createIPXMiddleware(ipx);
    await listen(middleware, {
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
