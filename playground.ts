import { createIPX, createIPXH3App, ipxFSStorage, ipxHttpStorage } from "./src";

const ipx = createIPX({
  storage: ipxFSStorage(),
  httpStorage: ipxHttpStorage({
    domains: ["picsum.photos"],
  }),
});

export default createIPXH3App(ipx);
