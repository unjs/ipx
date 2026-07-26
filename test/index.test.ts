import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "pathe";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";

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
      middleware: [staticMiddleware({ dir: assetsDir })],
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

  describe("svg", () => {
    it("passes through when no format is specified", async () => {
      const { data, format } = await (await ipx("nuxt.svg")).process();
      expect(format).toBe("svg+xml");
      expect(data.toString()).toContain("<svg");
    });

    // https://github.com/unjs/ipx/issues/261
    it.each(["f", "format"])(
      "passes through when svg is requested via `%s`",
      async (key) => {
        const { data, format } = await (
          await ipx("nuxt.svg", { [key]: "svg" })
        ).process();
        expect(format).toBe("svg+xml");
        expect(data.toString()).toContain("<svg");
      },
    );

    it("rasterizes when another format is requested", async () => {
      const { data, format } = await (
        await ipx("nuxt.svg", { f: "webp" })
      ).process();
      expect(data).toBeInstanceOf(Buffer);
      expect(format).toBe("webp");
    });

    it("ignores svg format for non-svg sources", async () => {
      const { format } = await (await ipx("bliss.jpg", { f: "svg" })).process();
      expect(format).toBe("jpeg");
    });

    it("removes scripts when svgo is enabled", async () => {
      const { data } = await (await ipx("xss.svg", { f: "svg" })).process();
      expect(data.toString()).not.toContain("<script");
      expect(data.toString()).not.toContain("onclick");
      expect(data.toString()).not.toContain("javascript:");
    });
  });
});
