import Express from "express";

import {
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
  createIPXNodeHandler,
} from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

const app = Express();

app.use("/ipx", createIPXNodeHandler(ipx));

// http://localhost:3000/ipx/w_512/picsum/1000
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
