import { listen } from "listhen";
import { resolve } from "pathe";
import { describe, it, expect, beforeAll } from "vitest";
import serveHandler from "serve-handler";
import sharp from "sharp";
import { IPX, createIPX, ipxFSStorage, ipxHttpStorage } from "../src";

describe("ipx", () => {
  let ipx: IPX;
  beforeAll(() => {
    ipx = createIPX({
      storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
      httpStorage: ipxHttpStorage({ domains: ["localhost:3000"] }),
    });
  });

  it("remote file", async () => {
    const listener = await listen(
      (request, res) => {
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

  it.each([
    { modifier: "", options: undefined },
    { modifier: "true", options: undefined },
    { modifier: "2", options: { sigma: 2 } },
    { modifier: "2_0_3", options: { sigma: 2, m1: 0, m2: 3 } },
  ])(
    "preserves sharpen parameters '$modifier'",
    async ({ modifier, options }) => {
      const { data } = await ipx("bliss.jpg", {
        sharpen: modifier,
        f: "png",
      }).process();
      const expected = await sharp(resolve(__dirname, "assets/bliss.jpg"))
        .sharpen(options)
        .png()
        .toBuffer();

      expect(Buffer.isBuffer(data) && data.equals(expected)).toBe(true);
    },
  );

  it("allows disabling sharpening", async () => {
    const { data } = await ipx("bliss.jpg", {
      sharpen: "false",
      f: "png",
    }).process();
    const expected = await sharp(resolve(__dirname, "assets/bliss.jpg"))
      .png()
      .toBuffer();

    expect(Buffer.isBuffer(data) && data.equals(expected)).toBe(true);
  });
});
