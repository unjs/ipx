import { listen } from "listhen";
import { resolve } from "pathe";
import { describe, it, expect, beforeAll, vi } from "vitest";
import serveHandler from "serve-handler";
import {
  IPX,
  IPXStorage,
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
} from "../src";

describe("ipx", () => {
  let ipx: IPX;
  beforeAll(() => {
    ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
      httpStorage: ipxHttpStorage({ domains: ["localhost:3000"] }),
    });
  });

  it("remote file", async () => {
    const listener = await listen(
      (request, res) => {
        // eslint-disable-next-line unicorn/prefer-module
        serveHandler(request, res, { public: resolve(__dirname, "assets") });
      },
      { port: 0 },
    );
    const source = await ipx(`${listener.url}/bliss.jpg`);
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    await listener.close();
  });

  it("local file", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
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
      getData: () => Uint8Array.from(data).buffer,
    });

    // Real, legitimately-encoded multi-frame images. sharp 0.32 cannot build a
    // multi-page image from raw pixels, so they are derived from the animated
    // `giphy.gif` fixture (PAGES frames), scaled down to PAGE_HEIGHT per page.
    const PAGES = 20;
    const PAGE_HEIGHT = 10; // total height PAGES * PAGE_HEIGHT = 200
    let multi: Record<"gif" | "webp" | "tiff", Buffer>;
    beforeAll(async () => {
      const sharp = await import("sharp").then((r) => r.default);
      const small = await sharp(
        // eslint-disable-next-line unicorn/prefer-module
        resolve(__dirname, "assets/giphy.gif"),
        { animated: true },
      )
        .resize(4, PAGE_HEIGHT, { fit: "fill" })
        .gif()
        .toBuffer();
      const base = () => sharp(small, { animated: true });
      multi = {
        gif: await base().gif().toBuffer(),
        webp: await base().webp().toBuffer(),
        tiff: await base().tiff().toBuffer(),
      };
      // Make sure every fixture really is multi-page with the expected shape.
      for (const data of Object.values(multi)) {
        const meta = await sharp(data, { animated: true }).metadata();
        expect([meta.pages, meta.pageHeight]).toEqual([PAGES, PAGE_HEIGHT]);
      }
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
            statusMessage: "IPX_INVALID_IMAGE",
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
          statusMessage: "IPX_INVALID_IMAGE",
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
        statusMessage: "IPX_INVALID_IMAGE",
        message: expect.stringContaining("Cannot parse image metadata"),
      });
    });

    // The limit applies from the exact total upwards.
    const runAnimatedGif = () =>
      createIPX({ storage: bufferStorage(multi.gif) })("image.gif", {
        animated: "",
      }).process();
    it("rejects a total equal to the limit and allows one below it", async () => {
      try {
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT));
        await expect(runAnimatedGif()).rejects.toMatchObject({
          statusCode: 400,
          statusMessage: "IPX_INVALID_IMAGE",
        });
        vi.stubEnv("VIPS_MAX_COORD", String(PAGES * PAGE_HEIGHT + 1));
        expect((await runAnimatedGif()).data).toBeInstanceOf(Buffer);
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
          statusMessage: "IPX_INVALID_IMAGE",
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
            statusMessage: "IPX_INVALID_IMAGE",
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
