import { serveIPX, createIPX, ipxFSStorage, ipxHttpStorage } from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

// http://localhost:3000/w_512/picsum/1000
serveIPX(ipx);
