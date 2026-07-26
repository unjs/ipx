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

  // Mocking sharp hides this: sharp rejects `undefined` values for args that are
  // present as keys, so every arity has to be exercised against the real thing.
  it.each(["2", "2_1", "2_1_90", "2_1_90_10"])(
    "modulate_%s",
    async (modifier) => {
      const source = await ipx("bliss.jpg", { modulate: modifier });
      const { data } = await source.process();
      expect(data).toBeInstanceOf(Buffer);
    },
  );
});
