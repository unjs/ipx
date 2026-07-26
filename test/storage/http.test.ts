import { afterEach, describe, expect, it, vi } from "vitest";

import { ipxHttpStorage } from "../../src/storage/http.ts";

describe("http", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getMeta", () => {
    const storage = ipxHttpStorage({});
    const sut = storage.getMeta;
    it("id has no hostname, throw Error ", async () => {
      await expect(sut("file://")).rejects.toThrow(
        "Hostname is missing: file://",
      );
    });
    it("id is not allowed domain, throw Error ", async () => {
      await expect(sut("http://localhost")).rejects.toThrow(
        "Forbidden host: localhost",
      );
    });
  });

  describe("validateId", () => {
    const storage = ipxHttpStorage({ domains: ["example.com"] });

    it("unparseable id throws a 400 HTTPError", async () => {
      await expect(storage.getData("not-a-url")).rejects.toMatchObject({
        statusCode: 400,
        statusText: "IPX_INVALID_URL",
        message: expect.stringContaining("not-a-url"),
      });
    });

    it("missing hostname throws a 403 HTTPError", async () => {
      await expect(storage.getData("file://")).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_MISSING_HOSTNAME",
      });
    });

    it("forbidden host throws a 403 HTTPError", async () => {
      await expect(
        storage.getData("https://not-example.com/image.png"),
      ).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_FORBIDDEN_HOST",
      });
    });

    it("malformed percent-encoding is not a URIError (forbidden host)", async () => {
      await expect(
        storage.getData("https://not-example.com/100%.jpg"),
      ).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_FORBIDDEN_HOST",
      });
    });

    it("malformed percent-encoding is fetched as-is for allowed hosts", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getData("https://example.com/100%.jpg"),
      ).resolves.toBeInstanceOf(ArrayBuffer);

      expect(fetch).toHaveBeenCalledWith(
        "https://example.com/100%.jpg",
        expect.anything(),
      );
    });

    it("encoded ids are decoded (direct storage usage)", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await storage.getData("https%3A%2F%2Fexample.com%2Fimage.png");
      expect(fetch).toHaveBeenCalledWith(
        "https://example.com/image.png",
        expect.anything(),
      );
    });

    it("getMeta propagates HTTPError for invalid ids", async () => {
      await expect(storage.getMeta("not-a-url")).rejects.toMatchObject({
        statusCode: 400,
        statusText: "IPX_INVALID_URL",
      });
    });
  });
});
