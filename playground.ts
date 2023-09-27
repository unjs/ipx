import { createIPX, createIPXH3App, ipxFSStorage, ipxHttpStorage } from "./src";

const ipx = createIPX({
  storage: ipxFSStorage(),
  alias: {
    "/picsum": "https://picsum.photos",
  },
  httpStorage: ipxHttpStorage({
    domains: ["picsum.photos"],
  }),
});

export default createIPXH3App(ipx);
