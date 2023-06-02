import fs from "node:fs";
import { listen } from "listhen";
import { resolve } from "pathe";
import { describe, it, expect, vi } from "vitest";
import serveHandler from "serve-handler";
import { createStorage } from "unstorage";
import { createIPX } from "../src";

describe("ipx with cache storage", () => {
  it("remote file", async () => {
    const listener = await listen(
      (request, res) => {
        // eslint-disable-next-line unicorn/prefer-module
        serveHandler(request, res, { public: resolve(__dirname, "assets") });
      },
      { port: 3001 }
    );
    const ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      dir: resolve(__dirname, "assets"),
      domains: ["localhost:3001"],
      cache: true,
    });

    const source = ipx(`${listener.url}/bliss.jpg`);
    const { data, format } = await source.data();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    await listener.close();
  });

  it("should save the file with the same key without duplication", async () => {
    const storage = createStorage();

    const ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      dir: resolve(__dirname, "assets"),
      domains: ["localhost:3002"],
      cache: true,
      cacheMetadataStore: storage,
    });

    const listener = await listen(
      (request, res) => {
        // eslint-disable-next-line unicorn/prefer-module
        serveHandler(request, res, { public: resolve(__dirname, "assets") });
      },
      { port: 3002 }
    );

    const source = ipx(`${listener.url}bliss.jpg`);
    await source.data();

    const cached = ipx(`${listener.url}bliss.jpg`);
    await cached.data();

    expect((await storage.getKeys()).length).toBe(1);

    const cached2 = ipx(`${listener.url}bliss.jpg`);
    await cached2.data();
    expect((await storage.getKeys()).length).toBe(1);

    await listener.close();
  });

  it("should respect 304 responses from http servers", async () => {
    const ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      dir: resolve(__dirname, "assets"),
      domains: ["localhost:3003"],
      cache: true,
    });

    const serveFileReader = vi.spyOn(fs, "createReadStream");
    const listener = await listen(
      (request, res) => {
        // serveHandler doesn't support if-modified-since header
        if (request.headers["if-modified-since"]) {
          res.statusCode = 304;
          res.end();
        }

        serveHandler(
          request,
          res,
          // eslint-disable-next-line unicorn/prefer-module
          { public: resolve(__dirname, "assets") },
          {
            createReadStream: serveFileReader,
          }
        );
      },
      { port: 3003 }
    );

    const source = ipx(`${listener.url}bliss.jpg`);
    await source.data();

    const cached = ipx(`${listener.url}bliss.jpg`);
    await cached.data();

    const cached2 = ipx(`${listener.url}bliss.jpg`);
    await cached2.data();

    // one - for the original request, two - for checking "if-modified-since" header
    // if it fails - called time be 5
    expect(serveFileReader).toHaveBeenCalledTimes(3);

    await listener.close();
  });

  it("should not store local files to cache", async () => {
    const storage = createStorage();
    const ipx = createIPX({
      // eslint-disable-next-line unicorn/prefer-module
      dir: resolve(__dirname, "assets"),
      cache: true,
      cacheMetadataStore: storage,
    });

    const source = ipx("bliss.jpg");
    const { data, format } = await source.data();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
    expect((await storage.getKeys()).length).toBe(0);
  });
});
