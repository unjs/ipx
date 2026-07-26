import { describe, expect, it } from "vitest";
import {
  type IPX,
  type IPXURLParser,
  createIPXFetchHandler,
  parseIPXURL,
} from "../src/index.ts";

describe("server", () => {
  let lastRequest: { id: string; modifiers?: Record<string, any> };

  const ipx: IPX = (id, modifiers?, _requestOptions?) => {
    lastRequest = { id, modifiers };
    return {
      getSourceMeta: async () => {
        return { maxAge: 3600, mtime: new Date() };
      },
      process: async () => {
        return {
          // data: new TextEncoder().encode("data"),
          data: Buffer.from("data"),
          format: "jpg",
          meta: { width: 100, height: 100 },
        };
      },
    };
  };

  it("createIPXFetchHandler returns expected value", async () => {
    const handler = createIPXFetchHandler(ipx);
    const res = await handler("http://example.com/w_200/test.jpg");
    await expect(res.text()).resolves.toEqual("data");
  });

  describe("parseIPXURL", () => {
    it("parses modifiers and id", () => {
      expect(
        parseIPXURL(new URL("http://example.com/s_200x200,f_webp/test.jpg")),
      ).toMatchObject({
        id: "test.jpg",
        modifiers: { s: "200x200", f: "webp" },
      });
    });

    it("supports `_` for no modifiers", () => {
      expect(
        parseIPXURL(new URL("http://example.com/_/nested/test.jpg")),
      ).toMatchObject({ id: "nested/test.jpg", modifiers: {} });
    });
  });

  describe("parseURL option", () => {
    // `/<id>@@<modifiers>.<format>`
    const parseURL: IPXURLParser = (url) => {
      const path = decodeURIComponent(url.pathname.slice(1));
      const match = path.match(/^(.+)@@(.+)\.([^.]+)$/);
      if (!match) {
        return { id: path, modifiers: {} };
      }
      const [, id = "", modifiersString = "", format = ""] = match;
      const modifiers = Object.fromEntries(
        modifiersString.split(",").map((m) => m.split("_")),
      );
      return { id, modifiers: { ...modifiers, format } };
    };

    it("overrides the default parser", async () => {
      const handler = createIPXFetchHandler(ipx, { parseURL });
      const res = await handler("http://example.com/test.png@@w_300.webp");
      await expect(res.text()).resolves.toEqual("data");
      expect(lastRequest).toMatchObject({
        id: "test.png",
        modifiers: { w: "300", format: "webp" },
      });
    });

    it("works without modifiers", async () => {
      const handler = createIPXFetchHandler(ipx, { parseURL });
      const res = await handler("http://example.com/test.png");
      await expect(res.text()).resolves.toEqual("data");
      expect(lastRequest).toMatchObject({ id: "test.png", modifiers: {} });
    });

    it("can delegate to the default parser", async () => {
      const handler = createIPXFetchHandler(ipx, {
        parseURL: (url) =>
          url.pathname.includes("@@") ? parseURL(url) : parseIPXURL(url),
      });
      await handler("http://example.com/w_200/test.jpg");
      expect(lastRequest).toMatchObject({
        id: "test.jpg",
        modifiers: { w: "200" },
      });
      await handler("http://example.com/test.png@@w_300.webp");
      expect(lastRequest).toMatchObject({
        id: "test.png",
        modifiers: { w: "300", format: "webp" },
      });
    });

    it("escapes parser output", async () => {
      const handler = createIPXFetchHandler(ipx, {
        parseURL: () => ({
          id: "test\n.jpg",
          modifiers: { f: "webp\r\n" },
        }),
      });
      await handler("http://example.com/anything");
      expect(lastRequest).toMatchObject({
        id: String.raw`test\n.jpg`,
        modifiers: { f: String.raw`webp\r\n` },
      });
    });

    it("still validates a missing id", async () => {
      const handler = createIPXFetchHandler(ipx, {
        parseURL: () => ({ id: "", modifiers: {} }),
      });
      const res = await handler("http://example.com/w_200/test.jpg");
      expect(await res.json()).toMatchObject({
        status: 400,
        statusText: "IPX_MISSING_ID",
      });
    });
  });

  describe("error handling", () => {
    it("IPX_MISSING_MODIFIERS", async () => {
      const handler = createIPXFetchHandler(ipx);
      const res = await handler("http://example.com/");
      expect(await res.json()).toEqual({
        status: 400,
        statusText: "IPX_MISSING_MODIFIERS",
        message: "Modifiers are missing: ",
      });
    });

    it("IPX_MISSING_ID", async () => {
      const handler = createIPXFetchHandler(ipx);
      const res = await handler("http://example.com/test");
      expect(await res.json()).toEqual({
        status: 400,
        statusText: "IPX_MISSING_ID",
        message: "Resource id is missing: /test",
      });
    });

    // https://github.com/h3js/h3/issues/1254
    it.skip("IPX_ERROR", async () => {
      const handler = createIPXFetchHandler(ipx);
      const res = await handler({} as any);
      expect(await res.json()).toEqual({
        status: 500,
        statusText: "IPX_ERROR",
        message: "Unexpected error",
      });
    });
  });
});
