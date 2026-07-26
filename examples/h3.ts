import { H3, serve } from "h3";

import {
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
  createIPXFetchHandler,
} from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

const app = new H3();

app.mount("/ipx", createIPXFetchHandler(ipx));

// http://localhost:3000/ipx/w_512/picsum/1000
serve(app);
