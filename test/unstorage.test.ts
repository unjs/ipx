import { resolve } from "pathe";
import { describe, it, expect, beforeAll } from "vitest";
import { createStorage } from "unstorage";
import fsLiteDriver from "unstorage/drivers/fs-lite";
import githubDriver from "unstorage/drivers/github";
import httpDriver from "unstorage/drivers/http";
import { IPX, createIPX, unstorageToIPXStorage } from "../src";

function getFile() {
  // eslint-disable-next-line unicorn/prefer-module
  const driver = fsLiteDriver({ base: resolve(__dirname, "assets") });
  const storage = createStorage({ driver });
  return storage.getItemRaw("bliss.jpg");
}

type TestVariant = {
  name: string;
  setup: () => IPX | Promise<IPX>;
  condition?: () => boolean;
};

const variants = [
  {
    name: "node fs lite",
    setup: () => {
      // eslint-disable-next-line unicorn/prefer-module
      const driver = fsLiteDriver({ base: resolve(__dirname, "assets") });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
  {
    name: "memory",
    setup: async () => {
      const storage = createStorage();
      await storage.setItemRaw("bliss.jpg", await getFile());
      await storage.setItemRaw("nested/bliss.jpg", await getFile());
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
  },
  {
    name: "memory (prefix)",
    setup: async () => {
      const storage = createStorage();
      await storage.setItemRaw("images/bliss.jpg", await getFile());
      await storage.setItemRaw("images/nested/bliss.jpg", await getFile());
      return createIPX({
        storage: unstorageToIPXStorage(storage, { prefix: "images" }),
      });
    },
  },
  {
    name: "github",
    setup: () => {
      const driver = githubDriver({ repo: "unjs/ipx", dir: "test/assets" });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
    condition: () => process.env.TEST_UNSTORAGE_GITHUB === "true",
  },
  {
    name: "http",
    setup: () => {
      const driver = httpDriver({
        base: "https://raw.githubusercontent.com/unjs/ipx/main/test/assets",
      });
      const storage = createStorage({ driver });
      return createIPX({ storage: unstorageToIPXStorage(storage) });
    },
    condition: () => process.env.TEST_UNSTORAGE_HTTP === "true",
  },
] satisfies TestVariant[];

describe.each(variants)(`unstorage: $name`, ({ setup, condition }) => {
  const shouldRun = condition ? condition() : true;
  let ipx: IPX;

  beforeAll(async () => {
    ipx = await setup();
  });

  it.runIf(shouldRun)("file found", async () => {
    const source = await ipx("bliss.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it.runIf(shouldRun)("file found nested", async () => {
    const source = await ipx("nested/bliss.jpg");
    const { data, format } = await source.process();
    expect(data).toBeInstanceOf(Buffer);
    expect(format).toBe("jpeg");
  });

  it.runIf(shouldRun)("file not found", async () => {
    const source = await ipx("unknown.jpg");
    await expect(() => source.process()).rejects.toThrowError(
      "Resource not found: /unknown.jpg",
    );
  });

  it.runIf(shouldRun)("invalid path", async () => {
    const source = await ipx("*.jpg");
    await expect(() => source.process()).rejects.toThrowError(
      "Resource not found: /*.jpg",
    );
  });
});
