import consola from "consola";
import { listen } from "listhen";

import { createIPX } from "./ipx";
import { createIPXMiddleware } from "./middleware";

async function main() {
  const ipx = createIPX({});
  const middleware = createIPXMiddleware(ipx);
  await listen(middleware, {
    clipboard: false,
  });
}

main().catch((error) => {
  consola.error(error);
  process.exit(1);
});
