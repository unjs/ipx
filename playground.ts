import {
  createIPX,
  createIPXMiddleware,
  nodeFSStorage,
  httpStorage,
} from "./src";

const ipx = createIPX({
  storage: nodeFSStorage({ dir: "./test/assets" }),
  httpStorage: httpStorage({
    domains: ["picsum.photos"],
  }),
});

export default createIPXMiddleware(ipx);
