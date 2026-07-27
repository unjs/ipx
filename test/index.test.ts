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
      autoOrient: { autoOrient: "" },
      flip: { flip: "" },
      flop: { flop: "" },
      sharpen: { sharpen: "2_1_2" },
      "sharpen (all args)": { sharpen: "2_1_2_2_10_20" },
      "sharpen (no args)": { sharpen: "" },
      median: { median: "5" },
      blur: { blur: "5" },
      "blur (all args)": { blur: "5_approximate_0.5" },
      "blur (no args)": { blur: "" },
      dilate: { dilate: "3" },
      "dilate (no args)": { dilate: "" },
      erode: { erode: "3" },
      "erode (no args)": { erode: "" },
      clahe: { clahe: "10" },
      "clahe (all args)": { clahe: "10_20_5" },
      flatten: { flatten: "", background: "ff0000" },
      unflatten: { unflatten: "" },
      gamma: { gamma: "2.2_1.8" },
      "gamma (no args)": { gamma: "" },
      negate: { negate: "" },
      "negate (alpha)": { negate: "false" },
      normalize: { normalize: "" },
      "normalize (range)": { normalize: "5_95" },
      threshold: { threshold: "128" },
      "threshold (grayscale)": { threshold: "128_false" },
      "threshold (no args)": { threshold: "" },
      linear: { linear: "1.2_-10" },
      "linear (no args)": { linear: "" },
      brightness: { brightness: "1.5" },
      saturation: { saturation: "0.5" },
      hue: { hue: "90" },
      lightness: { lightness: "10" },
      tint: { tint: "00ff00" },
      "tint (named)": { tint: "red" },
      grayscale: { grayscale: "" },
      opacity: { opacity: "0.5", format: "png" },
      "opacity (background)": { opacity: "0.5", background: "ffffff" },
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

    // `opacity` is composited rather than mapped to a sharp operation, so the
    // outcome is asserted on the pixels themselves.
    describe("opacity", () => {
      const pixels = async (modifiers: Record<string, string>) => {
        const { data } = await (await ipx("bliss.jpg", modifiers)).process();
        const sharp = await import("sharp").then((r) => r.default);
        const { data: raw, info } = await sharp(data as Buffer)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return (x: number, y: number) => {
          const index = (y * info.width + x) * info.channels;
          return [...raw.subarray(index, index + info.channels)];
        };
      };

      it("scales the alpha channel", async () => {
        const at = await pixels({
          opacity: "0.5",
          resize: "100",
          format: "png",
        });
        expect(at(50, 50)[3]).toBe(128);
      });

      it("blends into the background when one is set", async () => {
        const at = await pixels({
          opacity: "0",
          resize: "100",
          background: "00ff00",
          format: "png",
        });
        // Fully transparent over green leaves green, and stays opaque.
        expect(at(50, 50)).toEqual([0, 255, 0, 255]);
      });

      // The overlay is an SVG, where an unparseable colour would otherwise
      // silently render as black.
      it("rejects an unknown background colour", async () => {
        await expect(
          (
            await ipx("bliss.jpg", {
              opacity: "0.5",
              background: "nosuchcolour",
            })
          ).process(),
        ).rejects.toMatchObject({ statusCode: 400 });
      });
    });

    // libvips validates some arguments only once it runs, which happens after
    // every handler has been applied.
    it.each([
      // A clahe window larger than the (resized) image
      ["clahe", { resize: "50", clahe: "100" }],
      ["extract", { extract: "0_0_99999_99999" }],
    ])("%s failing inside libvips is a 400", async (_name, modifiers) => {
      await expect(
        (await ipx("bliss.jpg", modifiers)).process(),
      ).rejects.toMatchObject({ statusCode: 400 });
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
      "threshold (grayscale)": { threshold: "128_yes" },
      modulate: { modulate: "abc" },
      tint: { tint: "not-a-colour" },
      dilate: { dilate: "0" },
      erode: { erode: "1.5" },
      clahe: { clahe: "" },
      "clahe (maxSlope)": { clahe: "10_10_101" },
      linear: { linear: "abc" },
      negate: { negate: "yes" },
      // Sharp rejects a `lower` that is not below `upper`
      normalize: { normalize: "90_10" },
      "normalize (out of range)": { normalize: "100" },
      brightness: { brightness: "" },
      "brightness (negative)": { brightness: "-1" },
      saturation: { saturation: "abc" },
      hue: { hue: "1.5" },
      lightness: { lightness: "" },
      opacity: { opacity: "2" },
      "opacity (missing)": { opacity: "" },
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

  // Sharp's `limitInputPixels` only bounds the *input*: without a cap on the
  // output, `/enlarge,s_20000x20000/bliss.jpg` (or a large `extend`) makes it
  // allocate gigabytes from a source image of any size.
  describe("maxOutputDimension", () => {
    // bliss.jpg is 3840x2160
    const size = async (instance: IPX, modifiers: Record<string, string>) => {
      const { data } = await (await instance("bliss.jpg", modifiers)).process();
      const { width, height } = imageMeta(data as Uint8Array);
      return `${width}x${height}`;
    };

    const createLimitedIPX = (maxOutputDimension: number | false) =>
      createIPX({
        storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
        maxOutputDimension,
      });

    it("clamps enlarged resize to the default limit", async () => {
      expect(await size(ipx, { enlarge: "", resize: "20000x200" })).toBe(
        "8192x82",
      );
    });

    it("clamps enlarged width to the limit", async () => {
      expect(
        await size(createLimitedIPX(500), { enlarge: "", width: "5000" }),
      ).toBe("500x281");
    });

    it("bounds the canvas of a large extend", async () => {
      expect(
        await size(createLimitedIPX(4000), {
          extend: "10000_10000_10000_10000",
        }),
      ).toBe("4000x4000");
    });

    // Clamping only ever bounds growth: a source larger than the limit is
    // served as-is rather than rejected.
    it("does not extend a source already over the limit", async () => {
      expect(await size(createLimitedIPX(1000), { extend: "100" })).toBe(
        "3840x2160",
      );
    });

    it("can be disabled with `false`", async () => {
      expect(
        await size(createLimitedIPX(false), {
          enlarge: "",
          resize: "20000x200",
        }),
      ).toBe("20000x200");
    });

    it("can be set with `IPX_MAX_OUTPUT_DIMENSION`", async () => {
      process.env.IPX_MAX_OUTPUT_DIMENSION = "300";
      try {
        const limited = createIPX({
          storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
        });
        expect(await size(limited, { enlarge: "", resize: "5000x5000" })).toBe(
          "300x300",
        );
      } finally {
        delete process.env.IPX_MAX_OUTPUT_DIMENSION;
      }
    });

    it("does not affect requests within the limit", async () => {
      expect(await size(ipx, { resize: "100x50" })).toBe("100x50");
      expect(await size(ipx, { enlarge: "", resize: "4000x2000" })).toBe(
        "4000x2000",
      );
    });
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
