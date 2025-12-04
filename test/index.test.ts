import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "pathe";
import { serve } from "srvx";
import { serveStatic } from "srvx/static";

import {
  type IPX,
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
} from "../src/index.ts";

describe("ipx", () => {
  let ipx: IPX;
  beforeAll(() => {
    ipx = createIPX({
      storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
      httpStorage: ipxHttpStorage({ domains: ["127.0.0.1"] }),
    });
  });

  it("remote file", async () => {
    const assetsDir = resolve(__dirname, "assets");
    const server = await serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: () => new Response("Not Found", { status: 404 }),
      middleware: [serveStatic({ dir: assetsDir })],
    });
    await server.ready();
    const source = await ipx(`${server.url}/bliss.jpg`);
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    await server.close();
  });

  it("local file", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });
});
