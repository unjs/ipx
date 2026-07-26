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

    it("non http(s) protocol throws a 403 HTTPError", async () => {
      await expect(
        storage.getData("ftp://example.com/image.png"),
      ).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_FORBIDDEN_PROTOCOL",
      });
    });

    it("non http(s) protocol is rejected with allowAllDomains", async () => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);

      await expect(
        ipxHttpStorage({ allowAllDomains: true }).getData(
          "ftp://example.com/image.png",
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_FORBIDDEN_PROTOCOL",
      });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("redirects", () => {
    const storage = ipxHttpStorage({
      domains: ["example.com", "cdn.example.com"],
    });

    const redirect = (location: string, status = 302) =>
      new Response(null, { status, headers: { location } });

    it("follows redirects within the allowlist", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(redirect("https://cdn.example.com/image.png"))
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getData("https://example.com/image.png"),
      ).resolves.toBeInstanceOf(ArrayBuffer);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        "https://example.com/image.png",
        expect.objectContaining({ redirect: "manual" }),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        "https://cdn.example.com/image.png",
        expect.objectContaining({ redirect: "manual" }),
      );
    });

    it("rejects a redirect to a non-allowlisted host", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(redirect("http://169.254.169.254/"));
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getData("https://example.com/image.png"),
      ).rejects.toMatchObject({
        statusCode: 403,
        statusText: "IPX_FORBIDDEN_HOST",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("resolves a relative location against the current url", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(redirect("/redirected/image.png"))
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await storage.getData("https://example.com/nested/image.png");

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        "https://example.com/redirected/image.png",
        expect.anything(),
      );
    });

    it("throws for too many redirects", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(redirect("https://cdn.example.com/image.png"));
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getData("https://example.com/image.png"),
      ).rejects.toMatchObject({
        statusText: "IPX_TOO_MANY_REDIRECTS",
      });
      // initial request + 3 followed redirects
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("treats a redirect without location as the final response", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 302 }));
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getData("https://example.com/image.png"),
      ).rejects.toMatchObject({ statusCode: 302 });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("switches to GET for 303 redirects", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          redirect("https://cdn.example.com/image.png", 303),
        )
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await ipxHttpStorage({
        domains: ["example.com", "cdn.example.com"],
        fetchOptions: { method: "POST" },
      }).getData("https://example.com/image.png");

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        "https://example.com/image.png",
        expect.objectContaining({ method: "POST" }),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        "https://cdn.example.com/image.png",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("follows redirects with getMeta", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(redirect("https://cdn.example.com/image.png"))
        .mockResolvedValueOnce(
          new Response(null, { headers: { "cache-control": "max-age=42" } }),
        );
      vi.stubGlobal("fetch", fetch);

      await expect(
        storage.getMeta("https://example.com/image.png"),
      ).resolves.toMatchObject({ maxAge: 42 });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        "https://cdn.example.com/image.png",
        expect.objectContaining({ method: "HEAD" }),
      );
    });

    it("does not validate redirects when all domains are allowed", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await ipxHttpStorage({ allowAllDomains: true }).getData(
        "https://example.com/image.png",
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      // plain fetch: no `redirect` override, default (follow) applies
      expect(fetch).toHaveBeenCalledWith("https://example.com/image.png", {});
    });

    it("honors a user provided redirect option", async () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);

      await ipxHttpStorage({
        domains: ["example.com"],
        fetchOptions: { redirect: "follow" },
      }).getData("https://example.com/image.png");

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("https://example.com/image.png", {
        redirect: "follow",
      });
    });
  });
});
