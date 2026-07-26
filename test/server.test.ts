import { beforeEach, describe, expect, it } from "vitest";
import { resolve } from "pathe";
import {
  type IPX,
  type IPXURLParser,
  createIPX,
  createIPXFetchHandler,
  ipxFSStorage,
  parseIPXURL,
} from "../src/index.ts";

describe("server", () => {
  let lastRequest: { id?: string; modifiers?: Record<string, any> };

  beforeEach(() => {
    lastRequest = {};
  });

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

  describe("conditional requests", () => {
    const mtime = new Date("2024-01-01T00:00:00.000Z");

    const request = (
      headers: Record<string, string>,
      url = "http://example.com/w_200/test.jpg",
    ) => new Request(url, { headers });

    let processed: number;

    const createTestIPX = (sourceMeta: { maxAge?: number; mtime?: Date }) => {
      processed = 0;
      const ipx: IPX = (id, modifiers?) => {
        lastRequest = { id, modifiers };
        return {
          getSourceMeta: async () => sourceMeta,
          process: async () => {
            processed++;
            return { data: Buffer.from("data"), format: "jpg" };
          },
        };
      };
      return createIPXFetchHandler(ipx);
    };

    it("emits an ETag and replays it as a 304 without processing", async () => {
      const handler = createTestIPX({ maxAge: 3600, mtime });

      const res = await handler("http://example.com/w_200/test.jpg");
      expect(res.status).toEqual(200);
      const etag = res.headers.get("etag")!;
      expect(etag).toMatch(/^W\/".+"$/);
      expect(processed).toEqual(1);

      const res2 = await handler(request({ "if-none-match": etag }));
      expect(res2.status).toEqual(304);
      expect(res2.headers.get("etag")).toEqual(etag);
      expect(await res2.text()).toEqual("");
      // The image is never processed for a revalidation request
      expect(processed).toEqual(1);
    });

    it("keeps cache-control and last-modified on 304 responses", async () => {
      const handler = createTestIPX({ maxAge: 3600, mtime });
      const res = await handler("http://example.com/w_200/test.jpg");
      const res2 = await handler(
        request({ "if-none-match": res.headers.get("etag")! }),
      );
      expect(res2.status).toEqual(304);
      expect(res2.headers.get("last-modified")).toEqual(mtime.toUTCString());
      expect(res2.headers.get("cache-control")).toEqual(
        "max-age=3600, public, s-maxage=3600",
      );
      expect(res2.headers.get("content-security-policy")).toEqual(
        "default-src 'none'",
      );
    });

    it("matches an if-none-match list", async () => {
      const handler = createTestIPX({ mtime });
      const etag = (
        await handler("http://example.com/w_200/test.jpg")
      ).headers.get("etag")!;
      for (const ifNoneMatch of [
        `"other", ${etag}`,
        `${etag}, "other"`,
        etag.slice(2) /* strong form of the same tag */,
        "*",
      ]) {
        const res = await handler(request({ "if-none-match": ifNoneMatch }));
        expect([ifNoneMatch, res.status]).toEqual([ifNoneMatch, 304]);
      }
      expect(processed).toEqual(1);
    });

    it("does not match an unrelated if-none-match", async () => {
      const handler = createTestIPX({ mtime });
      const res = await handler(request({ "if-none-match": '"nope"' }));
      expect(res.status).toEqual(200);
      expect(processed).toEqual(1);
    });

    it("changes the ETag with id, modifiers and mtime", async () => {
      const etagOf = async (url: string, sourceMtime?: Date) => {
        const res = await createTestIPX({ mtime: sourceMtime || mtime })(url);
        return res.headers.get("etag");
      };
      const base = await etagOf("http://example.com/w_200/test.jpg");
      expect(base).toBeTruthy();

      // Stable for the same inputs
      expect(await etagOf("http://example.com/w_200/test.jpg")).toEqual(base);
      // ...and order independent
      expect(await etagOf("http://example.com/w_200,f_webp/test.jpg")).toEqual(
        await etagOf("http://example.com/f_webp,w_200/test.jpg"),
      );

      for (const url of [
        "http://example.com/w_300/test.jpg",
        "http://example.com/_/test.jpg",
        "http://example.com/w_200/other.jpg",
        "http://example.com/w_200,f_webp/test.jpg",
      ]) {
        expect([url, await etagOf(url)]).not.toEqual([url, base]);
      }

      expect(
        await etagOf(
          "http://example.com/w_200/test.jpg",
          new Date("2025-01-01T00:00:00.000Z"),
        ),
      ).not.toEqual(base);
    });

    it("falls back to a content ETag without mtime", async () => {
      const handler = createTestIPX({ maxAge: 3600 });

      const res = await handler("http://example.com/w_200/test.jpg");
      expect(res.status).toEqual(200);
      expect(res.headers.get("last-modified")).toEqual(null);
      const etag = res.headers.get("etag")!;
      expect(etag).toMatch(/^"[\d a-f]+-[\d A-Za-z+/]+"$/);

      const res2 = await handler(request({ "if-none-match": etag }));
      expect(res2.status).toEqual(304);
      expect(await res2.text()).toEqual("");
      // Processing cost is accepted for content based ETags
      expect(processed).toEqual(2);
    });

    // Real storage: revalidation must not even read the source data
    it("does not read the source on revalidation", async () => {
      const fsStorage = ipxFSStorage({ dir: resolve(__dirname, "assets") });
      let reads = 0;
      const handler = createIPXFetchHandler(
        createIPX({
          storage: {
            ...fsStorage,
            getData: (...args) => {
              reads++;
              return fsStorage.getData!(...args);
            },
          },
        }),
      );

      const url = "http://example.com/w_100/bliss.jpg";
      const res = await handler(url);
      expect(res.status).toEqual(200);
      expect(reads).toEqual(1);

      const etag = res.headers.get("etag")!;
      expect(etag).toMatch(/^W\/".+"$/);

      const res2 = await handler(request({ "if-none-match": etag }, url));
      expect(res2.status).toEqual(304);
      expect(await res2.text()).toEqual("");
      expect(reads).toEqual(1);
    });

    it("supports if-modified-since", async () => {
      const handler = createTestIPX({ mtime });

      const res = await handler("http://example.com/w_200/test.jpg");
      expect(res.headers.get("last-modified")).toEqual(mtime.toUTCString());

      const res2 = await handler(
        request({ "if-modified-since": mtime.toUTCString() }),
      );
      expect(res2.status).toEqual(304);
      expect(await res2.text()).toEqual("");

      const res3 = await handler(
        request({ "if-modified-since": new Date("2020-01-01").toUTCString() }),
      );
      expect(res3.status).toEqual(200);
      expect(processed).toEqual(2);
    });
  });

  describe("parseIPXURL", () => {
    it("parses modifiers and id", () => {
      expect(
        parseIPXURL("http://example.com/s_200x200,f_webp/test.jpg"),
      ).toMatchObject({
        id: "test.jpg",
        modifiers: { s: "200x200", f: "webp" },
      });
    });

    it("supports `_` for no modifiers", () => {
      const parsed = parseIPXURL("http://example.com/_/nested/test.jpg");
      expect(parsed.id).toEqual("nested/test.jpg");
      expect({ ...parsed.modifiers }).toEqual({});
    });

    it("supports valueless modifiers", () => {
      const parsed = parseIPXURL("http://example.com/grayscale/a.jpg");
      expect({ ...parsed.modifiers }).toEqual({ grayscale: "" });
    });

    it("ignores the query string", () => {
      const parsed = parseIPXURL("http://example.com/w_200/a.jpg?v=1#x");
      expect(parsed.id).toEqual("a.jpg");
      expect({ ...parsed.modifiers }).toEqual({ w: "200" });
    });
  });

  // h3 normalizes `event.url`, which drops percent-encoded tab/newline/CR
  it("parses the raw request URL", async () => {
    const handler = createIPXFetchHandler(ipx);
    const cases = [
      ["%09", String.raw`a\tb.jpg`],
      ["%0A", String.raw`a\nb.jpg`],
      ["%0D", String.raw`a\rb.jpg`],
      ["%2F", "a/b.jpg"],
    ];
    for (const [encoded, expected] of cases) {
      await handler(`http://example.com/w_200/a${encoded}b.jpg`);
      expect(lastRequest.id).toEqual(expected);
    }
  });

  describe("parseURL option", () => {
    // `/<id>@@<modifiers>.<format>`
    const parseURL: IPXURLParser = (url) => {
      const path = decodeURIComponent(new URL(url).pathname.slice(1));
      const match = path.match(/^(.+)@@(.+)\.([^.]+)$/);
      if (!match) {
        return { id: path, modifiers: {} };
      }
      const [, id = "", modifiersString = "", format = ""] = match;
      const modifiers = Object.fromEntries(
        modifiersString.split(",").map((m) => {
          const [key = "", ...values] = m.split("_");
          return [key, values.join("_")];
        }),
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
      expect(lastRequest.id).toEqual("test.png");
      expect({ ...lastRequest.modifiers }).toEqual({});
    });

    it("supports valueless modifiers", async () => {
      const handler = createIPXFetchHandler(ipx, { parseURL });
      const res = await handler("http://example.com/test.png@@grayscale.webp");
      expect(res.status).toEqual(200);
      expect({ ...lastRequest.modifiers }).toEqual({
        grayscale: "",
        format: "webp",
      });
    });

    it("supports async parsers", async () => {
      const handler = createIPXFetchHandler(ipx, {
        parseURL: async (url) => parseIPXURL(url),
      });
      const res = await handler("http://example.com/w_200/test.jpg");
      expect(res.status).toEqual(200);
      expect(lastRequest).toMatchObject({
        id: "test.jpg",
        modifiers: { w: "200" },
      });
    });

    it("does not crash on malformed parser output", async () => {
      for (const parseURL of [
        () => undefined,
        () => ({ id: "test.jpg" }),
        () => ({ id: "test.jpg", modifiers: { w: 200, grayscale: undefined } }),
      ] as unknown as IPXURLParser[]) {
        const handler = createIPXFetchHandler(ipx, { parseURL });
        const res = await handler("http://example.com/test.jpg");
        expect([200, 400]).toContain(res.status);
      }
      expect({ ...lastRequest.modifiers }).toEqual({ w: "200", grayscale: "" });
    });

    it("can delegate to the default parser", async () => {
      const handler = createIPXFetchHandler(ipx, {
        parseURL: (url) =>
          url.includes("@@") ? parseURL(url) : parseIPXURL(url),
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
