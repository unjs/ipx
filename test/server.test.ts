import { describe, expect, it } from "vitest";
import { type IPX, createIPXFetchHandler } from "../src/index.ts";

describe("server", () => {
  const ipx: IPX = (_id, _modifiers?, _requestOptions?) => {
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
