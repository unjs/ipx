import { createIPX, createIPXH3App, ipxFSStorage, ipxHttpStorage } from "./src";

const ipx = createIPX({
  storage: ipxFSStorage(),
  alias: {
    "/picsum": "https://picsum.photos",
  },
  httpStorage: ipxHttpStorage({
    domains: ["picsum.photos", "images.unsplash.com"],
  }),
});

export const app = createIPXH3App(ipx);
