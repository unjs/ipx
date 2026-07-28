import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ipxHttpStorage } from "../../src/storage/http.ts";

describe("http", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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

  describe("blockPrivateIPs", () => {
    // No test in this block may reach the network: hosts are either IP literals
    // (never resolved), `localhost` (resolved from the hosts file) or a stubbed
    // `dns.lookup`. `fetch` is always stubbed.
    const stubFetch = () => {
      const fetch = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", fetch);
      return fetch;
    };

    const stubLookup = (...addresses: { address: string; family: number }[]) =>
      vi.spyOn(dns.promises, "lookup").mockResolvedValue(addresses as any);

    describe("disabled by default", () => {
      it("fetches a private IP literal", async () => {
        const fetch = stubFetch();
        const lookup = vi.spyOn(dns.promises, "lookup");

        await expect(
          ipxHttpStorage({ domains: ["127.0.0.1"] }).getData(
            "http://127.0.0.1/image.png",
          ),
        ).resolves.toBeInstanceOf(ArrayBuffer);

        expect(fetch).toHaveBeenCalledTimes(1);
        // no address check at all when the option is off
        expect(lookup).not.toHaveBeenCalled();
      });

      it("fetches an allowlisted host resolving to loopback", async () => {
        const fetch = stubFetch();

        await expect(
          ipxHttpStorage({ domains: ["localhost"] }).getData(
            "http://localhost/image.png",
          ),
        ).resolves.toBeInstanceOf(ArrayBuffer);

        expect(fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe("enabled", () => {
      const storage = ipxHttpStorage({
        domains: ["localhost", "example.com", "cdn.example.com", "127.0.0.1"],
        blockPrivateIPs: true,
      });

      it("blocks a loopback IP literal", async () => {
        const fetch = stubFetch();

        await expect(
          storage.getData("http://127.0.0.1/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
          message: expect.stringContaining("127.0.0.1"),
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("blocks an allowlisted hostname resolving to loopback", async () => {
        const fetch = stubFetch();

        // `localhost` comes from the hosts file, no DNS query is made
        await expect(
          storage.getData("http://localhost/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("blocks a hostname with a single private address among public ones", async () => {
        const fetch = stubFetch();
        stubLookup(
          { address: "93.184.216.34", family: 4 },
          { address: "169.254.169.254", family: 4 },
        );

        await expect(
          storage.getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
          message: expect.stringContaining("169.254.169.254"),
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("blocks the IPv4-mapped IPv6 form of a loopback address", async () => {
        const fetch = stubFetch();

        // literal, url-normalized to `[::ffff:7f00:1]`
        await expect(
          ipxHttpStorage({
            allowAllDomains: true,
            blockPrivateIPs: true,
          }).getData("http://[::ffff:127.0.0.1]/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });

        // and resolved from a hostname
        stubLookup({ address: "::ffff:169.254.169.254", family: 6 });
        await expect(
          storage.getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });

        expect(fetch).not.toHaveBeenCalled();
      });

      it("blocks a redirect hop to a private address", async () => {
        const fetch = vi
          .fn()
          .mockResolvedValueOnce(
            new Response(null, {
              status: 302,
              headers: { location: "http://127.0.0.1/image.png" },
            }),
          )
          .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
        vi.stubGlobal("fetch", fetch);
        stubLookup({ address: "93.184.216.34", family: 4 });

        await expect(
          storage.getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });
        // the redirect was never followed
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      it("validates redirects even with allowAllDomains", async () => {
        const fetch = vi
          .fn()
          .mockResolvedValueOnce(
            new Response(null, {
              status: 302,
              headers: { location: "http://169.254.169.254/latest/meta-data/" },
            }),
          )
          .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
        vi.stubGlobal("fetch", fetch);
        stubLookup({ address: "93.184.216.34", family: 4 });

        await expect(
          ipxHttpStorage({
            allowAllDomains: true,
            blockPrivateIPs: true,
          }).getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
          "https://example.com/image.png",
          expect.objectContaining({ redirect: "manual" }),
        );
      });

      it("allows a public IP literal", async () => {
        const fetch = stubFetch();

        await expect(
          ipxHttpStorage({
            allowAllDomains: true,
            blockPrivateIPs: true,
          }).getData("http://93.184.216.34/image.png"),
        ).resolves.toBeInstanceOf(ArrayBuffer);
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      it("allows a hostname resolving to public addresses", async () => {
        const fetch = stubFetch();
        stubLookup(
          { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
          { address: "93.184.216.34", family: 4 },
        );

        await expect(
          storage.getData("https://example.com/image.png"),
        ).resolves.toBeInstanceOf(ArrayBuffer);
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      it("propagates a failed lookup as 502", async () => {
        const fetch = stubFetch();
        vi.spyOn(dns.promises, "lookup").mockRejectedValue(
          new Error("ENOTFOUND"),
        );

        await expect(
          storage.getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 502,
          statusText: "IPX_DNS_LOOKUP_FAILED",
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("fails closed when the node builtins are unavailable", async () => {
        const fetch = stubFetch();
        vi.spyOn(process, "getBuiltinModule").mockReturnValue(
          undefined as never,
        );

        await expect(
          storage.getData("https://example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 500,
          statusText: "IPX_IP_CHECK_UNAVAILABLE",
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("can be enabled with IPX_HTTP_BLOCK_PRIVATE_IPS", async () => {
        const fetch = stubFetch();
        vi.stubEnv("IPX_HTTP_BLOCK_PRIVATE_IPS", "true");

        await expect(
          ipxHttpStorage({ domains: ["127.0.0.1"] }).getData(
            "http://127.0.0.1/image.png",
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      it("is still bound by the domain allowlist", async () => {
        const fetch = stubFetch();
        stubLookup({ address: "93.184.216.34", family: 4 });

        await expect(
          storage.getData("https://not-example.com/image.png"),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_HOST",
        });
        expect(fetch).not.toHaveBeenCalled();
      });
    });

    describe("address ranges", () => {
      const storage = ipxHttpStorage({
        allowAllDomains: true,
        blockPrivateIPs: true,
      });

      const blocked = [
        // IPv4
        "0.0.0.0",
        "0.1.2.3",
        "10.0.0.1",
        "100.64.1.1",
        "127.0.0.1",
        "127.1.2.3",
        "169.254.169.254",
        "172.16.0.1",
        "172.31.255.255",
        "192.0.0.1",
        "192.0.2.1",
        "192.88.99.1",
        "192.168.1.1",
        "198.18.0.1",
        "198.51.100.1",
        "203.0.113.1",
        "224.0.0.1",
        "239.255.255.250",
        "240.0.0.1",
        "255.255.255.255",
        // IPv6
        "[::]",
        "[::1]",
        "[::ffff:127.0.0.1]",
        "[::ffff:10.0.0.1]",
        "[::ffff:169.254.169.254]",
        "[::127.0.0.1]",
        "[::ffff:0:127.0.0.1]", // IPv4-translated (SIIT)
        "[64:ff9b::127.0.0.1]",
        "[64:ff9b:1::127.0.0.1]", // local-use NAT64, blocked as a whole
        "[64:ff9b:1::1]",
        "[2002:7f00:1::]",
        "[fc00::1]",
        "[fd12:3456:789a::1]",
        "[fe80::1]",
        "[febf::1]",
        "[fec0::1]",
        "[ff02::1]",
        "[2001:db8::1]",
        "[2001::1]",
        "[100::1]",
      ];

      it.each(blocked)("blocks %s", async (host) => {
        const fetch = stubFetch();
        await expect(
          storage.getData(`http://${host}/image.png`),
        ).rejects.toMatchObject({
          statusCode: 403,
          statusText: "IPX_FORBIDDEN_IP",
        });
        expect(fetch).not.toHaveBeenCalled();
      });

      const allowed = [
        "1.1.1.1",
        "8.8.8.8",
        "93.184.216.34",
        "100.63.255.255",
        "100.128.0.1",
        "169.253.0.1",
        "172.15.0.1",
        "172.32.0.1",
        "192.169.0.1",
        "198.20.0.1",
        "223.255.255.255",
        "[2606:2800:220:1:248:1893:25c8:1946]",
        "[2001:4860:4860::8888]",
        "[fe00::1]",
        "[2003::1]",
      ];

      it.each(allowed)("allows %s", async (host) => {
        const fetch = stubFetch();
        await expect(
          storage.getData(`http://${host}/image.png`),
        ).resolves.toBeInstanceOf(ArrayBuffer);
        expect(fetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});
