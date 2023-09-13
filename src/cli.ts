import consola from "consola";
import { listen } from "listhen";
import { createIPX } from "./ipx";
import { createIPXMiddleware } from "./middleware";
import { ipxFSStorage } from "./storage/node-fs";
import { ipxHttpStorage } from "./storage/http";

async function main() {
  const ipx = createIPX({
    storage: ipxFSStorage({ dir: process.env.IPX_DIR || "." }),
    httpStorage: ipxHttpStorage({
      domains: ["picsum.photos"],
    }),
  });

  const middleware = createIPXMiddleware(ipx);
  await listen(middleware, {});
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
