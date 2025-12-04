import { describe, it, expect, beforeAll } from "vitest";

import { readFile } from "node:fs/promises";
import { resolve } from "pathe";

import { type IPX, createIPX, unstorageToIPXStorage } from "../src/index.ts";

import { createStorage } from "unstorage";
import fsLiteDriver from "unstorage/drivers/fs-lite";
import githubDriver from "unstorage/drivers/github";
import httpDriver from "unstorage/drivers/http";

const sampleImage = await readFile(
  new URL("assets/bliss.jpg", import.meta.url),
);

const tests = [
  {
    name: "node-fs",
    skip: false,
    setup() {
      const driver = fsLiteDriver({ base: resolve(__dirname, "assets") });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
  {
    name: "memory",
    skip: false,
    async setup() {
      const storage = createStorage();
      await storage.setItemRaw("bliss.jpg", sampleImage);
      await storage.setItemRaw("nested/bliss.jpg", sampleImage);
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
  {
    name: "memory (prefixed)",
    skip: false,
    async setup() {
      const storage = createStorage();
      await storage.setItemRaw("images/bliss.jpg", sampleImage);
      await storage.setItemRaw("images/nested/bliss.jpg", sampleImage);
      return createIPX({
        storage: unstorageToIPXStorage(storage, { prefix: "images" }),
      });
    },
  },
  {
    name: "github",
    skip: !process.env.TEST_UNSTORAGE_GITHUB,
    setup: () => {
      const driver = githubDriver({ repo: "unjs/ipx", dir: "test/assets" });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
  {
    name: "http",
    skip: !process.env.TEST_UNSTORAGE_HTTP,
    setup: () => {
      const driver = httpDriver({
        base: "https://raw.githubusercontent.com/unjs/ipx/main/test/assets",
      });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
] as const;

for (const test of tests) {
  describe.skipIf(test.skip)(`unstorage:ipx:${test.name}`, () => {
    let ipx: IPX;

    beforeAll(async () => {
      ipx = await test.setup();
    });

    it("file found", async () => {
      const source = await ipx("bliss.jpg");
      const { data, format } = await source.process();
      expect(data).toBeInstanceOf(Buffer);
      expect(format).toBe("jpeg");
    });

    it("file found nested", async () => {
      const source = await ipx("nested/bliss.jpg");
      const { data, format } = await source.process();
      expect(data).toBeInstanceOf(Buffer);
      expect(format).toBe("jpeg");
    });

    it("file not found", async () => {
      const source = await ipx("unknown.jpg");
      await expect(() => source.process()).rejects.toThrowError(
        "Resource not found: /unknown.jpg",
      );
    });

    it("invalid path", async () => {
      const source = await ipx("*.jpg");
      await expect(() => source.process()).rejects.toThrowError(
        "Resource not found: /*.jpg",
      );
    });
  });
}
