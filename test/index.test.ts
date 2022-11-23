import { listen } from "listhen";
import { resolve } from "pathe";
import { describe, it, expect, beforeAll } from "vitest";
import serveHandler from "serve-handler";
import { IPX, createIPX } from "../src";

describe("ipx", () => {
  let ipx: IPX;
  beforeAll(() => {
    ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      dir: resolve(__dirname, "assets"),
      domains: ["localhost:3000"]
    });
  });

  it("remote file", async () => {
    // eslint-disable-next-line unicorn/prefer-module
    const listener = await listen((request, res) => { serveHandler(request, res, { public: resolve(__dirname, "assets") }); }, { port: 0 });
    const source = await ipx(`${listener.url}/bliss.jpg`);
    const { data, format } = await source.data();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    await listener.close();
  });

  it("local file", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format } = await source.data();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });
});
