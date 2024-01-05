import { resolve } from "pathe";
import { describe, it, expect, beforeAll } from "vitest";
import { IPX, createIPX, ipxFSStorage } from "../src";

describe("ipx", () => {
  let ipx: IPX;

  beforeAll(() => {
    ipx = createIPX({
      storage: ipxFSStorage({
        // eslint-disable-next-line unicorn/prefer-module
        dir: [resolve(__dirname, "assets"), resolve(__dirname, "assets-2")],
      }),
    });
  });

  it("local file: 1st layer", async () => {
    const source = await ipx("giphy.gif");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("gif");
  });

  it("local file: 2nd layer", async () => {
    const source = await ipx("unjs.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it("local file: priority", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format, meta } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    expect(meta?.height).toBe(2160);
  });

  it("error: not found", async () => {
    const source = await ipx("unknown.png");
    await expect(() => source.process()).rejects.toThrowError(
      "File not found: /unknown.png",
    );
  });

  it("error: forbidden path", async () => {
    const source = await ipx("*.png");
    await expect(() => source.process()).rejects.toThrowError(
      "Forbidden path: /*.png",
    );
  });
});
