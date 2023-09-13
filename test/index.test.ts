import { listen } from "listhen";
import { resolve } from "pathe";
import { describe, it, expect, beforeAll } from "vitest";
import serveHandler from "serve-handler";
import { IPX, createIPX, ipxFSStorage, ipxHttpStorage } from "../src";

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
});
