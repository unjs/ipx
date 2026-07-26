import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "pathe";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import { imageMeta } from "image-meta";

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

  // Mocking sharp hides its own argument validation (`trim` wants an object,
  // `sharpen` wants a sigma, ...), so every modifier is exercised for real.
  describe("modifiers", () => {
    const valid: Record<string, Record<string, string>> = {
      quality: { quality: "80" },
      fit: { resize: "100x100", fit: "inside" },
      position: { resize: "100x100", fit: "cover", position: "right-top" },
      background: { background: "ff0000", extend: "10" },
      "background (named)": { background: "red", extend: "10" },
      enlarge: { enlarge: "", resize: "8000x8000" },
      kernel: { kernel: "mks2021", resize: "100x100" },
      width: { width: "100" },
      height: { height: "100" },
      resize: { resize: "100x50" },
      "resize (square)": { resize: "100" },
      trim: { trim: "10" },
      "trim (no args)": { trim: "" },
      extend: { extend: "10_20_30_40_mirror" },
      extract: { extract: "0_0_100_100" },
      crop: { crop: "0_0_100_100" },
      rotate: { rotate: "90" },
      "rotate (arbitrary angle)": { rotate: "45", background: "ff0000" },
      "rotate (auto-orient)": { rotate: "" },
      flip: { flip: "" },
      flop: { flop: "" },
      sharpen: { sharpen: "2_1_2" },
      "sharpen (no args)": { sharpen: "" },
      median: { median: "5" },
      blur: { blur: "5" },
      "blur (no args)": { blur: "" },
      flatten: { flatten: "", background: "ff0000" },
      unflatten: { unflatten: "" },
      gamma: { gamma: "2.2_1.8" },
      "gamma (no args)": { gamma: "" },
      negate: { negate: "" },
      normalize: { normalize: "" },
      threshold: { threshold: "128" },
      "threshold (no args)": { threshold: "" },
      tint: { tint: "00ff00" },
      "tint (named)": { tint: "red" },
      grayscale: { grayscale: "" },
    };

    it.each(Object.entries(valid))("%s", async (_name, modifiers) => {
      const { data } = await (await ipx("bliss.jpg", modifiers)).process();
      expect(data).toBeInstanceOf(Buffer);
    });

    // Mocking sharp hides this: sharp rejects `undefined` values for args that are
    // present as keys, so every arity has to be exercised against the real thing.
    it.each(["2", "2_1", "2_1_90", "2_1_90_10"])(
      "modulate_%s",
      async (modifier) => {
        const { data } = await (
          await ipx("bliss.jpg", { modulate: modifier })
        ).process();
        expect(data).toBeInstanceOf(Buffer);
      },
    );

    // `kernel` only takes effect if it runs before `resize`. It has no `order`,
    // so it relies on sorting by name ("kernel" < "resize" and < "s"). Assert
    // the outcome rather than the Buffer, so a sort change cannot silently
    // start dropping it.
    it.each([
      ["resize listed first", { resize: "100x100", kernel: "nearest" }],
      ["kernel listed first", { kernel: "nearest", resize: "100x100" }],
      ["`s` alias", { s: "100x100", kernel: "nearest" }],
    ])("kernel is applied before resize (%s)", async (_name, modifiers) => {
      const { data } = await (await ipx("bliss.jpg", modifiers)).process();
      const { data: lanczos3 } = await (
        await ipx("bliss.jpg", { resize: "100x100" })
      ).process();
      expect(data).not.toEqual(lanczos3);
    });

    it("extend resizes the canvas", async () => {
      const { data } = await (
        await ipx("bliss.jpg", { extend: "10_20_30_40_mirror" })
      ).process();
      const { width, height } = imageMeta(data as Uint8Array);
      expect(width).toBe(3840 + 20 + 40);
      expect(height).toBe(2160 + 10 + 30);
    });

    const invalid: Record<string, Record<string, string>> = {
      quality: { quality: "abc" },
      fit: { fit: "foo" },
      position: { position: "foo" },
      background: { background: "not-a-colour" },
      // Sharp validates colour names itself, when the colour is actually used
      "background (unknown name)": {
        background: "nosuchcolour",
        extend: "10",
      },
      kernel: { kernel: "foo" },
      width: { width: "abc" },
      height: { height: "-1" },
      resize: { resize: "abc" },
      trim: { trim: "abc" },
      extend: { extend: "10_10_10_10_foo" },
      "extend (negative)": { extend: "-10" },
      extract: { extract: "0_0_10" },
      rotate: { rotate: "abc" },
      sharpen: { sharpen: "abc" },
      median: { median: "0" },
      blur: { blur: "abc" },
      gamma: { gamma: "5" },
      threshold: { threshold: "256" },
      modulate: { modulate: "abc" },
      tint: { tint: "not-a-colour" },
    };

    it.each(Object.entries(invalid))(
      "%s (invalid)",
      async (_name, modifiers) => {
        await expect(
          (await ipx("bliss.jpg", modifiers)).process(),
        ).rejects.toMatchObject({ statusCode: 400 });
      },
    );
  });

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

    it("removes scripts", async () => {
      const { data } = await (await ipx("xss.svg", { f: "svg" })).process();
      expect(data.toString()).not.toContain("<script");
      expect(data.toString()).not.toContain("onclick");
      expect(data.toString()).not.toContain("javascript:");
    });
  });
});
