import consola from "consola";
import { listen } from "listhen";
import { createIPX } from "./ipx";
import { createIPXMiddleware } from "./middleware";
import { nodeFSStorage } from "./storage/node-fs";
import { httpStorage } from "./storage/http";

async function main() {
  const ipx = createIPX({
    storage: nodeFSStorage({ dir: "./test/fixture" }),
    httpStorage: httpStorage({
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
