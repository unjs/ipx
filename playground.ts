import { serve } from "srvx";
import {
  createIPX,
  createIPXFetchHandler,
  ipxFSStorage,
  ipxHttpStorage,
} from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage(),
  alias: {
    "/picsum": "https://picsum.photos",
  },
  httpStorage: ipxHttpStorage({
    domains: ["picsum.photos", "images.unsplash.com"],
  }),
});

serve({
  fetch: createIPXFetchHandler(ipx),
});
