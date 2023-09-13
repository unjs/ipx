import {
  createIPX,
  createIPXMiddleware,
  ipxFSStorage,
  ipxHttpStorage,
} from "./src";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./test/assets" }),
  httpStorage: ipxHttpStorage({
    domains: ["picsum.photos"],
  }),
});

export default createIPXMiddleware(ipx);
