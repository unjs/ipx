import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "vitest";
import { IPX, createIPX, ipxFSStorage } from "../src";

describe("ipx: fs with multiple dirs", () => {
  let ipx: IPX;

  beforeAll(() => {
    ipx = createIPX({
      storage: ipxFSStorage({
        dir: ["assets", "assets2"].map((d) =>
          fileURLToPath(new URL(d, import.meta.url)),
        ),
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

describe("isolation", () => {
  it.only("should not be able to access files outside the specified directories", async () => {
    const ipx = createIPX({
      storage: ipxFSStorage({
        dir: fileURLToPath(new URL("assets", import.meta.url)),
      }),
    });
    const source = await ipx("../assets2/bliss.jpg"); // access file outside ./public dir because of same prefix folder
    await expect(source.process()).rejects.toThrowError("Forbidden path");
  });
});
