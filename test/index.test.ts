import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { resolve } from "node:path";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import { imageMeta } from "image-meta";

import {
  type IPX,
  type IPXOptions,
  type IPXStorage,
  createIPX,
  createIPXFetchHandler,
  ipxFSStorage,
  ipxHttpStorage,
  WEB_INPUT_FORMATS,
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
      autoorient: { autoorient: "" },
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
      // Resized first: clahe is expensive enough on the full 3840x2160
      // source to trip the default test timeout, and what is under test here
      // is the argument handling.
      clahe: { resize: "200", clahe: "10" },
      "clahe (all args)": { resize: "200", clahe: "10_20_5" },
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
      // Resized first: encoding a full size png is slow enough to matter.
      opacity: { resize: "200", opacity: "0.5", format: "png" },
      "opacity (background)": {
        resize: "200",
        opacity: "0.5",
        background: "ffffff",
      },
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
    // bliss.jpg is 3840x2160, giphy.gif is 320x240
    const size = async (
      instance: IPX,
      modifiers: Record<string, string>,
      id = "bliss.jpg",
    ) => {
      const { data } = await (await instance(id, modifiers)).process();
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

    // libvips resizes before it extends, whatever order the modifiers appear
    // in, so budgeting the extend against the source used to let the two
    // clamps stack: each axis reached twice the limit, 4x the pixel budget.
    // Only visible against real sharp with both modifiers in one pipeline,
    // which is exactly what the per-modifier clamp tests cannot cover.
    it.each([
      [
        "resize listed first",
        { enlarge: "", resize: "1000x1000", extend: "5000_5000_5000_5000" },
      ],
      [
        "extend listed first",
        { extend: "5000_5000_5000_5000", enlarge: "", resize: "1000x1000" },
      ],
      [
        "`s` alias",
        { enlarge: "", s: "1000x1000", extend: "5000_5000_5000_5000" },
      ],
      // Only `width` is given, so sharp derives the height (750) from the
      // source aspect ratio: the extend budget has to account for that too.
      [
        "single axis",
        { enlarge: "", width: "1000", extend: "5000_5000_5000_5000" },
      ],
    ])(
      "bounds a resize combined with an extend (%s)",
      async (_name, modifiers) => {
        // A source well within the limit, so that both modifiers have room to
        // grow the canvas. `format` avoids the animated gif pipeline.
        expect(
          await size(
            createLimitedIPX(1000),
            { ...modifiers, format: "jpeg" },
            "giphy.gif",
          ),
        ).toBe("1000x1000");
      },
    );

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

    it("keeps the default limit when `IPX_MAX_OUTPUT_DIMENSION` is empty", async () => {
      vi.stubEnv("IPX_MAX_OUTPUT_DIMENSION", "");
      try {
        const limited = createIPX({
          storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
        });
        expect(await size(limited, { enlarge: "", resize: "20000x200" })).toBe(
          "8192x82",
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("does not affect requests within the limit", async () => {
      expect(await size(ipx, { resize: "100x50" })).toBe("100x50");
      expect(await size(ipx, { enlarge: "", resize: "4000x2000" })).toBe(
        "4000x2000",
      );
      expect(await size(ipx, { resize: "100x50", extend: "10_20_30_40" })).toBe(
        "160x90",
      );
    });
  });

  describe("allowedModifiers", () => {
    const createRestrictedIPX = (
      allowedModifiers?: IPXOptions["allowedModifiers"],
    ) =>
      createIPX({
        storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
        allowedModifiers,
      });

    const forbidden = { statusCode: 400, statusText: "IPX_FORBIDDEN_MODIFIER" };

    it("allows listed modifiers and their aliases", async () => {
      const restricted = createRestrictedIPX(["width", "format"]);
      for (const modifiers of [
        { width: "100", format: "png" },
        { w: "100", f: "png" },
      ]) {
        const { data, format } = await restricted(
          "bliss.jpg",
          modifiers,
        ).process();
        expect(format).toBe("png");
        expect(imageMeta(data as Uint8Array).width).toBe(100);
      }
    });

    it("allows a modifier listed by its alias", async () => {
      const restricted = createRestrictedIPX(["w"]);
      await expect(
        restricted("bliss.jpg", { width: "100" }).process(),
      ).resolves.toBeDefined();
    });

    it.each<[string, Record<string, any>]>([
      ["another modifier", { width: "100", blur: "5" }],
      ["another modifier's alias", { w: "100", h: "100" }],
      ["`animated` alias", { a: "" }],
      ["an unknown modifier", { width: "100", cachebust: "1" }],
    ])("rejects %s", (_name, modifiers) => {
      const restricted = createRestrictedIPX(["width", "format"]);
      expect(() => restricted("bliss.jpg", modifiers)).toThrow(
        expect.objectContaining(forbidden),
      );
    });

    // Rejected up front, so the source is never fetched (or found missing).
    it("rejects before resolving the source", () => {
      const restricted = createRestrictedIPX(["width"]);
      expect(() => restricted("missing.jpg", { blur: "5" })).toThrow(
        expect.objectContaining(forbidden),
      );
    });

    it("ignores inherited modifiers", async () => {
      const restricted = createRestrictedIPX(["width"]);
      const modifiers = Object.assign(Object.create({ f: "png", a: "" }), {
        w: "100",
      });
      const { format } = await restricted("bliss.jpg", modifiers).process();
      expect(format).toBe("jpeg");
    });

    it("ignores modifiers added after the check", async () => {
      const restricted = createRestrictedIPX(["width"]);
      const modifiers: Record<string, string> = { w: "100" };
      const img = restricted("bliss.jpg", modifiers);
      modifiers.format = "png";
      const { format } = await img.process();
      expect(format).toBe("jpeg");
    });

    it("allows no modifiers when empty", async () => {
      const restricted = createRestrictedIPX([]);
      expect(() => restricted("bliss.jpg", { width: "100" })).toThrow(
        expect.objectContaining(forbidden),
      );
      await expect(restricted("bliss.jpg").process()).resolves.toBeDefined();
    });

    it("throws on an unknown modifier name", () => {
      expect(() => createRestrictedIPX(["widht" as any])).toThrow(
        "Unknown modifier in allowedModifiers: widht",
      );
    });

    it("can be set with `IPX_ALLOWED_MODIFIERS`", () => {
      vi.stubEnv("IPX_ALLOWED_MODIFIERS", "width, format");
      try {
        const restricted = createRestrictedIPX();
        expect(() =>
          restricted("bliss.jpg", { w: "100", f: "png" }),
        ).not.toThrow();
        expect(() => restricted("bliss.jpg", { blur: "5" })).toThrow(
          expect.objectContaining(forbidden),
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("accepts a JSON array in `IPX_ALLOWED_MODIFIERS`", () => {
      vi.stubEnv("IPX_ALLOWED_MODIFIERS", '["width"]');
      try {
        const restricted = createRestrictedIPX();
        expect(() => restricted("bliss.jpg", { w: "100" })).not.toThrow();
        expect(() => restricted("bliss.jpg", { blur: "5" })).toThrow(
          expect.objectContaining(forbidden),
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it.each(["null", "1", "true", '{"width":true}'])(
      "throws on a non-list `IPX_ALLOWED_MODIFIERS=%s`",
      (value) => {
        vi.stubEnv("IPX_ALLOWED_MODIFIERS", value);
        try {
          expect(() => createRestrictedIPX()).toThrow(
            "allowedModifiers must be an array or a comma-separated string",
          );
        } finally {
          vi.unstubAllEnvs();
        }
      },
    );

    it("responds with a 400 from the server", async () => {
      const handler = createIPXFetchHandler(createRestrictedIPX(["width"]));
      expect((await handler("http://localhost/w_100/bliss.jpg")).status).toBe(
        200,
      );
      expect(
        (await handler("http://localhost/w_100,blur_5/bliss.jpg")).status,
      ).toBe(400);
    });
  });

  describe("input formats", () => {
    const bufferStorage = (data: Buffer): IPXStorage => ({
      name: "buffer",
      getMeta: () => ({}),
      getData: () => data,
    });

    let sharp: typeof import("sharp").default;
    let sources: Record<"jpeg" | "png" | "webp" | "avif" | "tiff", Buffer>;
    beforeAll(async () => {
      sharp = await import("sharp").then((r) => r.default);
      const base = () =>
        sharp({
          create: { width: 8, height: 8, channels: 3, background: "red" },
        });
      sources = {
        jpeg: await base().jpeg().toBuffer(),
        png: await base().png().toBuffer(),
        webp: await base().webp().toBuffer(),
        avif: await base().avif().toBuffer(),
        tiff: await base().tiff().toBuffer(),
      };
    });

    const forbidden = {
      statusCode: 403,
      statusText: "IPX_FORBIDDEN_INPUT_FORMAT",
    };

    describe("allowedInputFormats", () => {
      const processWith = (
        source: Buffer,
        allowedInputFormats?: IPXOptions["allowedInputFormats"],
      ) =>
        createIPX({ storage: bufferStorage(source), allowedInputFormats })(
          "image",
          { f: "png" },
        ).process();

      it("allows every format by default", async () => {
        const { format } = await processWith(sources.tiff);
        expect(format).toBe("png");
      });

      it("rejects a format that is not listed before decoding it", async () => {
        const toBuffer = vi.spyOn(sharp.prototype, "toBuffer");
        const metadata = vi.spyOn(sharp.prototype, "metadata");
        try {
          await expect(
            processWith(sources.tiff, WEB_INPUT_FORMATS),
          ).rejects.toMatchObject(forbidden);
          expect(toBuffer).not.toHaveBeenCalled();
          expect(metadata).not.toHaveBeenCalled();
        } finally {
          toBuffer.mockRestore();
          metadata.mockRestore();
        }
      });

      it.each(["jpeg", "webp", "avif"] as const)(
        "processes an allowed %s source",
        async (type) => {
          const { data, format } = await processWith(
            sources[type],
            WEB_INPUT_FORMATS,
          );
          expect(format).toBe("png");
          expect(imageMeta(data as Uint8Array).type).toBe("png");
        },
      );

      it.each(["jpeg", "jpg"] as const)(
        "treats `%s` as JPEG",
        async (allowed) => {
          await expect(
            processWith(sources.jpeg, [allowed]),
          ).resolves.toBeDefined();
          await expect(
            processWith(sources.webp, [allowed]),
          ).rejects.toMatchObject(forbidden);
        },
      );

      // `heif` is HEIC; AVIF uses the same container but is listed on its own.
      it("does not allow AVIF through `heif`", async () => {
        await expect(processWith(sources.avif, ["heif"])).rejects.toMatchObject(
          forbidden,
        );
      });

      it("covers SVG sources, which are not decoded by sharp", async () => {
        const restricted = createIPX({
          storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
          allowedInputFormats: ["jpeg"],
        });
        await expect(restricted("nuxt.svg").process()).rejects.toMatchObject(
          forbidden,
        );
        await expect(restricted("bliss.jpg").process()).resolves.toBeDefined();
      });

      it("allows a GIF and an SVG from the web set", async () => {
        const restricted = createIPX({
          storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
          allowedInputFormats: WEB_INPUT_FORMATS,
        });
        expect((await restricted("giphy.gif").process()).format).toBe("gif");
        expect((await restricted("nuxt.svg").process()).format).toBe("svg+xml");
      });

      it("allows nothing when empty", async () => {
        await expect(processWith(sources.jpeg, [])).rejects.toMatchObject(
          forbidden,
        );
      });

      it("throws on an unknown format name", () => {
        expect(() =>
          createIPX({
            storage: bufferStorage(sources.jpeg),
            allowedInputFormats: ["jpge" as any],
          }),
        ).toThrow("Unknown input format in allowedInputFormats: jpge");
      });

      it.each([
        ["a comma-separated list", "JPEG, png"],
        ["a JSON array", '["jpeg", "png"]'],
      ])(
        "can be set with `IPX_ALLOWED_INPUT_FORMATS` as %s",
        async (_, env) => {
          vi.stubEnv("IPX_ALLOWED_INPUT_FORMATS", env);
          try {
            await expect(processWith(sources.jpeg)).resolves.toBeDefined();
            await expect(processWith(sources.tiff)).rejects.toMatchObject(
              forbidden,
            );
          } finally {
            vi.unstubAllEnvs();
          }
        },
      );

      it("prefers the option over `IPX_ALLOWED_INPUT_FORMATS`", async () => {
        vi.stubEnv("IPX_ALLOWED_INPUT_FORMATS", "jpeg");
        try {
          await expect(
            processWith(sources.tiff, ["tiff"]),
          ).resolves.toBeDefined();
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it.each(["null", "1", "true", '{"jpeg":true}'])(
        "throws on a non-list `IPX_ALLOWED_INPUT_FORMATS=%s`",
        (value) => {
          vi.stubEnv("IPX_ALLOWED_INPUT_FORMATS", value);
          try {
            expect(() =>
              createIPX({ storage: bufferStorage(sources.jpeg) }),
            ).toThrow(
              "allowedInputFormats must be an array or a comma-separated string",
            );
          } finally {
            vi.unstubAllEnvs();
          }
        },
      );

      it("responds with a 403 from the server", async () => {
        const handler = createIPXFetchHandler(
          createIPX({
            storage: bufferStorage(sources.tiff),
            allowedInputFormats: WEB_INPUT_FORMATS,
          }),
        );
        const res = await handler("http://localhost/w_4/image.tiff");
        expect(res.status).toBe(403);
      });
    });

    // `restrictDecoders` changes process-wide libvips state, so every test
    // restores it to keep the rest of the suite (and other files) unaffected,
    // and gets a fresh ipx module, which tracks the loaders it re-enabled.
    describe("restrictDecoders", () => {
      let createIPX: typeof import("../src/index.ts").createIPX;
      beforeEach(async () => {
        vi.resetModules();
        ({ createIPX } = await import("../src/index.ts"));
      });
      afterEach(() => {
        sharp.unblock({ operation: ["VipsForeignLoad"] });
      });

      const decode = (source: Buffer) => sharp(source).png().toBuffer();

      it("blocks the libvips decoders of other formats", async () => {
        const { format } = await createIPX({
          storage: bufferStorage(sources.jpeg),
          restrictDecoders: true,
        })("image", { f: "png" }).process();
        expect(format).toBe("png");

        // A direct decode, bypassing the ipx format check, is refused by
        // libvips itself.
        await expect(decode(sources.tiff)).rejects.toThrow(
          "unsupported image format",
        );
        await expect(decode(sources.jpeg)).resolves.toBeInstanceOf(Buffer);
        await expect(decode(sources.avif)).resolves.toBeInstanceOf(Buffer);
      });

      it("defaults the allowed input formats to the web set", async () => {
        await expect(
          createIPX({
            storage: bufferStorage(sources.tiff),
            restrictDecoders: true,
          })("image", { f: "png" }).process(),
        ).rejects.toMatchObject(forbidden);
      });

      it("keeps the decoders of the allowed input formats", async () => {
        const restricted = (source: Buffer) =>
          createIPX({
            storage: bufferStorage(source),
            restrictDecoders: true,
            allowedInputFormats: ["jpeg", "tiff"],
          })("image", { f: "png" }).process();
        await expect(restricted(sources.tiff)).resolves.toBeDefined();
        await expect(restricted(sources.webp)).rejects.toMatchObject(forbidden);
        await expect(decode(sources.webp)).rejects.toThrow(
          "unsupported image format",
        );
      });

      // A later instance re-enables its own loaders on top of the earlier
      // ones, so it never takes a format away from an instance already
      // serving it.
      it("never narrows the decoders of an earlier instance", async () => {
        const web = createIPX({
          storage: bufferStorage(sources.png),
          restrictDecoders: true,
        });
        await web("image", { f: "jpeg" }).process();
        await createIPX({
          storage: bufferStorage(sources.jpeg),
          restrictDecoders: true,
          allowedInputFormats: ["jpeg"],
        })("image", { f: "png" }).process();
        await expect(
          web("image", { f: "jpeg" }).process(),
        ).resolves.toBeDefined();
        await expect(decode(sources.tiff)).rejects.toThrow(
          "unsupported image format",
        );
      });

      // `opacity` with a `background` composites a generated overlay, which
      // must not need a decoder that the allowed formats leave blocked.
      it("keeps `opacity` with a `background` working", async () => {
        const { format } = await createIPX({
          storage: bufferStorage(sources.jpeg),
          restrictDecoders: true,
          allowedInputFormats: ["jpeg", "png", "webp"],
        })("image", { opacity: "0.5", b: "blue", f: "png" }).process();
        expect(format).toBe("png");
      });

      it("can be enabled with `IPX_RESTRICT_DECODERS`", async () => {
        vi.stubEnv("IPX_RESTRICT_DECODERS", "true");
        try {
          await createIPX({ storage: bufferStorage(sources.jpeg) })(
            "image",
          ).process();
          await expect(decode(sources.tiff)).rejects.toThrow(
            "unsupported image format",
          );
        } finally {
          vi.unstubAllEnvs();
        }
      });

      it("leaves libvips alone when disabled", async () => {
        vi.stubEnv("IPX_RESTRICT_DECODERS", "false");
        try {
          await createIPX({ storage: bufferStorage(sources.jpeg) })(
            "image",
          ).process();
          await expect(decode(sources.tiff)).resolves.toBeInstanceOf(Buffer);
        } finally {
          vi.unstubAllEnvs();
        }
      });

      // A default instance must never call `unblock`, or it would undo a
      // block the host app set up on purpose.
      it("keeps a block the host app set when disabled", async () => {
        sharp.block({ operation: ["VipsForeignLoadTiff"] });
        await createIPX({ storage: bufferStorage(sources.jpeg) })(
          "image",
        ).process();
        await expect(decode(sources.tiff)).rejects.toThrow(
          "unsupported image format",
        );
      });

      // libvips decodes GIF with a loader whose name differs between builds,
      // so this catches a wrong entry in the loader list.
      it("keeps GIF working", async () => {
        const restricted = createIPX({
          storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
          restrictDecoders: true,
        });
        expect((await restricted("giphy.gif").process()).format).toBe("gif");
        expect(
          (await restricted("giphy.gif", { f: "png" }).process()).format,
        ).toBe("png");
      });

      it.each(["1", "0", "true", "false"])(
        "accepts `IPX_RESTRICT_DECODERS=%s`",
        (value) => {
          vi.stubEnv("IPX_RESTRICT_DECODERS", value);
          try {
            expect(() =>
              createIPX({ storage: bufferStorage(sources.jpeg) }),
            ).not.toThrow();
          } finally {
            vi.unstubAllEnvs();
          }
        },
      );

      it.each(["False", "off", "no", "yes", "2"])(
        "throws on `IPX_RESTRICT_DECODERS=%s`",
        (value) => {
          vi.stubEnv("IPX_RESTRICT_DECODERS", value);
          try {
            expect(() =>
              createIPX({ storage: bufferStorage(sources.jpeg) }),
            ).toThrow("restrictDecoders must be true or false");
          } finally {
            vi.unstubAllEnvs();
          }
        },
      );
    });
  });

  describe("maxAge", () => {
    const sourceMaxAge = async (maxAge: unknown) => {
      const storage: IPXStorage = {
        name: "test",
        getMeta: () => ({ maxAge: maxAge as number }),
        getData: () => undefined,
      };
      const meta = await createIPX({ storage })("test.jpg").getSourceMeta();
      return meta.maxAge;
    };

    it.each([
      [0, 0],
      [120, 120],
      ["120", 120],
      [1.5, 1],
      [1e21, 2 ** 31],
    ])("normalizes a storage maxAge of %j to %j", async (maxAge, expected) => {
      expect(await sourceMaxAge(maxAge)).toBe(expected);
    });

    it.each([Number.NaN, -1, Infinity, "abc", "1h", "120px", false])(
      "falls back to the IPX-wide default for a storage maxAge of %s",
      async (maxAge) => {
        expect(await sourceMaxAge(maxAge)).toBe(60);
      },
    );

    it("sends a valid cache-control header when `IPX_FS_MAX_AGE` is empty", async () => {
      vi.stubEnv("IPX_FS_MAX_AGE", "");
      try {
        const handler = createIPXFetchHandler(
          createIPX({
            storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
          }),
        );
        const res = await handler("http://localhost/w_10/bliss.jpg");
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe(
          "max-age=60, public, s-maxage=60",
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  // Without `enlarge` the source is never upscaled. Mocking the pipe would hide
  // what sharp itself makes of the box and `fit`, so these run for real.
  describe("resize without enlarge", () => {
    // bliss.jpg is 3840x2160, giphy.gif is 320x240
    const size = async (
      modifiers: Record<string, string>,
      id = "bliss.jpg",
    ) => {
      const { data } = await (await ipx(id, modifiers)).process();
      const { width, height } = imageMeta(data as Uint8Array);
      return `${width}x${height}`;
    };

    it.each([
      // `cover` (the default) and `fill` fit the source on both axes
      [{ s: "4000x4000" }, "2160x2160"],
      [{ s: "4000x4000", fit: "cover" }, "2160x2160"],
      [{ s: "5000x1000", fit: "fill" }, "3840x768"],
      // `contain` pads its other axis, so the box can exceed the source there
      [{ s: "4000x4000", fit: "contain" }, "3840x3840"],
      [{ s: "3000x5000", fit: "contain" }, "3000x5000"],
      // `inside` and `outside` keep the source aspect ratio
      [{ s: "4000x4000", fit: "inside" }, "3840x2160"],
      [{ s: "1920x5000", fit: "inside" }, "1920x1080"],
      [{ s: "5000x1000", fit: "outside" }, "3840x2160"],
      [{ s: "1000x1000", fit: "outside" }, "1778x1000"],
      // Within the source, nothing to clamp
      [{ s: "1920x1080", fit: "contain" }, "1920x1080"],
    ])("%o -> %s", async (modifiers, expected) => {
      expect(await size(modifiers)).toBe(expected);
    });

    it("`enlarge_false` keeps enlargement off", async () => {
      expect(await size({ enlarge: "", s: "640x640" }, "giphy.gif")).toBe(
        "640x640",
      );
      expect(await size({ enlarge: "false", s: "640x640" }, "giphy.gif")).toBe(
        "240x240",
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

  // An all-pages ("animated") decode stacks every page into one canvas of
  // height `pageHeight * nPages`. ipx rejects a multi-page image (TIFF, GIF,
  // WebP, HEIF) whose total height reaches the limit before decoding it.
  //
  // A real file that crosses libvips' default `VIPS_MAX_COORD` (1e8) is far too
  // big for a test, so these use a small real multi-frame image and lower
  // `VIPS_MAX_COORD` (which ipx honors) to put the same bound in reach.
  describe("multi-page total-height limit", () => {
    const bufferStorage = (data: Buffer): IPXStorage => ({
      name: "buffer",
      getMeta: () => ({}),
      getData: () => data,
    });

    // Real, legitimately-encoded multi-frame images. Frame content is varied so
    // the encoders keep all PAGES frames instead of collapsing identical ones.
    const PAGES = 5;
    const PAGE_HEIGHT = 10; // total height PAGES * PAGE_HEIGHT = 50
    let multi: Record<"gif" | "webp" | "tiff", Buffer>;
    beforeAll(async () => {
      const sharp = await import("sharp").then((r) => r.default);
      const width = 4;
      const raw = Buffer.alloc(width * PAGE_HEIGHT * PAGES);
      for (let index = 0; index < raw.length; index++) {
        raw[index] = (index * 37) % 256;
      }
      const base = () =>
        sharp(raw, {
          raw: {
            width,
            height: PAGE_HEIGHT * PAGES,
            channels: 1,
            pageHeight: PAGE_HEIGHT,
          },
        });
      multi = {
        gif: await base().gif().toBuffer(),
        webp: await base().webp().toBuffer(),
        tiff: await base().tiff().toBuffer(),
      };
    });

    it("decodes a normal animated image under the limit", async () => {
      const { data } = await createIPX({ storage: bufferStorage(multi.gif) })(
        "image.gif",
        { animated: "" },
      ).process();
      expect(data).toBeInstanceOf(Buffer);
    });

    it.each(["gif", "webp", "tiff"] as const)(
      "rejects an over-limit animated %s with a 400 before decode",
      async (fmt) => {
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT - 1));
        try {
          await expect(
            createIPX({ storage: bufferStorage(multi[fmt]) })(`image.${fmt}`, {
              animated: "",
            }).process(),
          ).rejects.toMatchObject({
            statusCode: 400,
            statusText: "IPX_INVALID_IMAGE",
          });
        } finally {
          vi.unstubAllEnvs();
        }
      },
    );

    // A GIF source enables all-pages decode on its own (`format === "gif"`), so
    // the limit must apply with no modifier at all.
    it("guards a GIF via the auto-animated path with no modifier", async () => {
      vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT - 1));
      try {
        await expect(
          createIPX({ storage: bufferStorage(multi.gif) })(
            "image.gif",
          ).process(),
        ).rejects.toMatchObject({
          statusCode: 400,
          statusText: "IPX_INVALID_IMAGE",
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });

    // A truncated GIF passes `image-meta` (header only) but libvips can't read
    // it. That is a bad source, not a bad modifier.
    it("rejects an unreadable multi-page source as an invalid image", async () => {
      const truncated = Buffer.concat([
        multi.gif.subarray(0, 13),
        Buffer.from("garbage"),
      ]);
      await expect(
        createIPX({ storage: bufferStorage(truncated) })("image.gif").process(),
      ).rejects.toMatchObject({
        statusCode: 400,
        statusText: "IPX_INVALID_IMAGE",
        message: expect.stringContaining("Cannot parse image metadata"),
      });
    });

    // The limit applies from the exact total upwards.
    it("rejects a total equal to the limit and allows one below it", async () => {
      const run = () =>
        createIPX({ storage: bufferStorage(multi.gif) })("image.gif", {
          animated: "",
        }).process();
      try {
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT));
        await expect(run()).rejects.toMatchObject({
          statusCode: 400,
          statusText: "IPX_INVALID_IMAGE",
        });
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT + 1));
        expect((await run()).data).toBeInstanceOf(Buffer);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("responds with a 400 from the server", async () => {
      vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT - 1));
      try {
        const handler = createIPXFetchHandler(
          createIPX({ storage: bufferStorage(multi.gif) }),
        );
        expect((await handler("http://localhost/_/image.gif")).status).toBe(
          400,
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    // `VIPS_MAX_COORD` can only lower the limit. The metadata read is faked to
    // report a total at the default limit but below the configured value.
    it("does not let VIPS_MAX_COORD raise the limit", async () => {
      const sharp = await import("sharp").then((r) => r.default);
      const metadata = vi
        .spyOn(
          sharp.prototype as { metadata: () => Promise<unknown> },
          "metadata",
        )
        .mockResolvedValueOnce({ height: 1000, pages: 100_000 });
      vi.stubEnv("VIPS_MAX_COORD", "1000000000");
      try {
        await expect(
          createIPX({ storage: bufferStorage(multi.gif) })("image.gif", {
            animated: "",
          }).process(),
        ).rejects.toMatchObject({
          statusCode: 400,
          statusText: "IPX_INVALID_IMAGE",
          message: expect.stringContaining("total height is too large"),
        });
      } finally {
        vi.unstubAllEnvs();
        metadata.mockRestore();
      }
    });

    // `sharpOptions` overrides the modifier-derived `animated` flag, so an
    // operator enabling multi-page decode there must not skip the guard.
    it.each([
      ["animated: true", { animated: true }],
      ["pages: -1", { pages: -1 }],
      ["pages: 2", { pages: 2 }],
    ] as const)(
      "guards a multi-page decode enabled via sharpOptions (%s)",
      async (_, sharpOptions) => {
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT - 1));
        try {
          await expect(
            createIPX({ storage: bufferStorage(multi.tiff), sharpOptions })(
              "image.tiff",
              { f: "png" },
            ).process(),
          ).rejects.toMatchObject({
            statusCode: 400,
            statusText: "IPX_INVALID_IMAGE",
          });
        } finally {
          vi.unstubAllEnvs();
        }
      },
    );

    // The guard only runs for all-pages decodes, so a single-page request of
    // the same source is unaffected even below the lowered limit.
    it("does not guard a single-page request", async () => {
      vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT - 1));
      try {
        const { data } = await createIPX({
          storage: bufferStorage(multi.tiff),
        })("image.tiff", { f: "png" }).process();
        expect(data).toBeInstanceOf(Buffer);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
