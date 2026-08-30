import { HTTPError } from "h3";
import { getBuiltinModule, getEnv } from "../utils.ts";
import type { IPXStorage } from "../types.ts";

export type HTTPStorageOptions = {
  /**
   * Custom options for fetch operations, such as headers or method overrides.
   *
   * Redirects are followed manually (one hop at a time) so that each redirect target
   * can be re-validated against the {@link HTTPStorageOptions.domains} allowlist
   * (and {@link HTTPStorageOptions.blockPrivateIPs} when enabled).
   * Explicitly setting `redirect` here opts out of this protection: the value is passed
   * to `fetch` as-is and redirect targets are **not** validated (a redirect to an
   * internal address is then possible: SSRF).
   * @optional
   */
  fetchOptions?: RequestInit;

  /**
   * Default maximum age (in seconds) for cache control. If not specified, defaults to the environment setting or 300 seconds.
   *
   * `0` is meaningful and is passed through as-is — it disables caching rather than
   * falling back to the default.
   * @optional
   */
  maxAge?: number;

  /**
   * Whitelist of domains from which resource fetching is allowed. Can be a single string or an array of strings.
   *
   * Only `http:` and `https:` URLs are allowed. Redirects are followed only within this
   * allowlist (up to 3 hops): a redirect to a host that is not listed is rejected with
   * `403 IPX_FORBIDDEN_HOST`, so an allowlisted host cannot bounce IPX to an internal
   * address. Hosts that redirect to a CDN must have the CDN hostname listed here too.
   * @optional
   */
  domains?: string | string[];

  /**
   * If set to true, allows retrieval from any domain. Overrides the domain whitelist.
   * @optional
   */
  allowAllDomains?: boolean;

  /**
   * If set to true, ignore the cache control header in responses and use the default or specified maxAge.
   * @optional
   */
  ignoreCacheControl?: boolean;

  /**
   * If set to true, reject URLs whose host is (or resolves to) a non-public IP address
   * with `403 IPX_FORBIDDEN_IP`. Checked for the requested URL and for every redirect hop.
   *
   * This is **defense in depth**, not the primary access control: the
   * {@link HTTPStorageOptions.domains} allowlist is. It only helps when an allowlisted
   * (or, with `allowAllDomains`, arbitrary) hostname points at loopback, link-local
   * (`169.254.169.254`, the cloud metadata service), RFC1918, CGNAT, unique-local or
   * otherwise non-public space.
   *
   * Disabled by default because many legitimate deployments fetch from in-cluster origins
   * (internal object storage, sidecars, `localhost` during development), which this blocks.
   * @optional
   * @default false
   */
  blockPrivateIPs?: boolean;
};

const HTTP_RE = /^https?:\/\//;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/** Maximum number of redirects followed when they are re-validated. */
const MAX_REDIRECTS = 3;

/** Parses a dotted-quad IPv4 literal into its 4 octets. */
function parseIPv4(input: string): number[] | undefined {
  const parts = input.split(".");
  if (parts.length !== 4) {
    return;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return;
    }
    const octet = Number(part);
    if (octet > 255) {
      return;
    }
    octets.push(octet);
  }
  return octets;
}

/** Parses an IPv6 literal (including `::` compression and a trailing embedded IPv4) into 16 bytes. */
function parseIPv6(input: string): number[] | undefined {
  // Drop the zone id (`fe80::1%eth0`), it says nothing about the range.
  const zoneIndex = input.indexOf("%");
  const address = zoneIndex === -1 ? input : input.slice(0, zoneIndex);

  const halves = address.split("::");
  if (halves.length > 2) {
    return;
  }

  const expand = (part: string): number[] | undefined => {
    if (part === "") {
      return [];
    }
    const bytes: number[] = [];
    const groups = part.split(":");
    for (const [index, group] of groups.entries()) {
      if (group.includes(".")) {
        // Only the last group may be an embedded IPv4 (`::ffff:127.0.0.1`)
        if (index !== groups.length - 1) {
          return;
        }
        const octets = parseIPv4(group);
        if (!octets) {
          return;
        }
        bytes.push(...octets);
        continue;
      }
      if (!/^[\da-f]{1,4}$/i.test(group)) {
        return;
      }
      const value = Number.parseInt(group, 16);
      bytes.push(value >> 8, value & 0xff);
    }
    return bytes;
  };

  const head = expand(halves[0]!);
  const tail = halves.length === 2 ? expand(halves[1]!) : [];
  if (!head || !tail) {
    return;
  }
  if (halves.length === 1) {
    return head.length === 16 ? head : undefined;
  }
  const fill = 16 - head.length - tail.length;
  if (fill < 0) {
    return;
  }
  return [...head, ...Array.from({ length: fill }, () => 0), ...tail];
}

/**
 * Returns the IPv4 address embedded in an IPv6 address, if any.
 *
 * IPv4-mapped (`::ffff:127.0.0.1`) and IPv4-compatible (`::127.0.0.1`) forms are the
 * classic way to smuggle a loopback/metadata address past a naive IPv6 range check, so
 * they are unwrapped and judged by the IPv4 rules instead. `::` and `::1` land here too
 * and are non-public as `0.0.0.0/8` (`::` / `::0.0.0.0`) and `0.0.0.1` (`::1`).
 */
function embeddedIPv4(bytes: number[]): number[] | undefined {
  // `::ffff:0:0/96` (IPv4-mapped) and `::/96` (IPv4-compatible, deprecated)
  if (
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    ((bytes[10] === 0xff && bytes[11] === 0xff) ||
      (bytes[10] === 0 && bytes[11] === 0))
  ) {
    return bytes.slice(12);
  }
  // `::ffff:0:0:0/96` (IPv4-translated, SIIT)
  if (
    bytes.slice(0, 8).every((byte) => byte === 0) &&
    bytes[8] === 0xff &&
    bytes[9] === 0xff &&
    bytes[10] === 0 &&
    bytes[11] === 0
  ) {
    return bytes.slice(12);
  }
  // `64:ff9b::/96` NAT64
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((byte) => byte === 0)
  ) {
    return bytes.slice(12);
  }
  // `2002::/16` 6to4 embeds the IPv4 address right after the prefix
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return bytes.slice(2, 6);
  }
}

function isPublicIPv4(octets: number[]): boolean {
  const [a, b, c] = octets as [number, number, number, number];
  return !(
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // 192.0.2.0/24 TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 192.88.99.0/24 6to4 relay anycast
    (a === 192 && b === 168) || // RFC1918
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    (a === 198 && b === 51 && c === 100) || // 198.51.100.0/24 TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // 203.0.113.0/24 TEST-NET-3
    a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  );
}

function isPublicIPv6(bytes: number[]): boolean {
  const embedded = embeddedIPv4(bytes);
  if (embedded) {
    return isPublicIPv4(embedded);
  }
  const [a, b] = bytes as [number, number];
  return !(
    a === 0xff || // ff00::/8 multicast
    (a === 0xfe && (b & 0xc0) === 0x80) || // fe80::/10 link-local
    (a === 0xfe && (b & 0xc0) === 0xc0) || // fec0::/10 site-local (deprecated)
    (a & 0xfe) === 0xfc || // fc00::/7 unique local
    // The rest of `64:ff9b::/32`, including the `64:ff9b:1::/48` local-use NAT64
    // prefix (the well-known `64:ff9b::/96` was already unwrapped above). Blocked
    // as a whole: RFC 6052 puts the embedded IPv4 at a prefix-dependent offset here.
    (a === 0x00 && b === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) ||
    (a === 0x01 && b === 0x00 && bytes.slice(2, 8).every((x) => x === 0)) || // 100::/64 discard-only
    (a === 0x20 && b === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) || // 2001:db8::/32 documentation
    (a === 0x20 && b === 0x01 && bytes[2] === 0 && bytes[3] === 0) // 2001::/32 Teredo
  );
}

/** Unknown/unparseable input is treated as non-public (fail closed). */
function isPublicIP(address: string, family: number): boolean {
  if (family === 4) {
    const octets = parseIPv4(address);
    return octets ? isPublicIPv4(octets) : false;
  }
  if (family === 6) {
    const bytes = parseIPv6(address);
    return bytes ? isPublicIPv6(bytes) : false;
  }
  return false;
}

function decode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    // Keep malformed percent-encoding as-is (e.g. `100%.jpg`)
    return input;
  }
}

/**
 * Creates an HTTP storage handler for IPX that fetches image data from external URLs.
 * This handler allows configuration to specify allowed domains, caching behaviour and custom fetch options.
 *
 * @param {HTTPStorageOptions} [_options={}] - Configuration options for HTTP storage, with defaults possibly taken from environment variables. See {@link HTTPStorageOptions}.
 * @returns {IPXStorage} An IPXStorage interface implementation for retrieving images over HTTP. See {@link IPXStorage}.
 * @throws {H3Error} If validation of the requested URL fails due to a missing hostname or denied host access. See {@link H3Error}.
 */
export function ipxHttpStorage(_options: HTTPStorageOptions = {}): IPXStorage {
  const allowAllDomains =
    _options.allowAllDomains ?? getEnv("IPX_HTTP_ALLOW_ALL_DOMAINS") ?? false;
  let _domains =
    _options.domains || getEnv<string | string[]>("IPX_HTTP_DOMAINS") || [];
  const defaultMaxAge =
    _options.maxAge ?? getEnv<string | number>("IPX_HTTP_MAX_AGE") ?? 300;
  const fetchOptions: RequestInit =
    _options.fetchOptions ||
    getEnv<RequestInit>("IPX_HTTP_FETCH_OPTIONS") ||
    {};
  const blockPrivateIPs =
    _options.blockPrivateIPs ??
    getEnv<boolean>("IPX_HTTP_BLOCK_PRIVATE_IPS") ??
    false;

  if (typeof _domains === "string") {
    _domains = _domains.split(",").map((s) => s.trim());
  }

  const domains = new Set(
    _domains
      .map((d) => {
        if (!HTTP_RE.test(d)) {
          d = "http://" + d;
        }
        return new URL(d).hostname;
      })
      .filter(Boolean),
  );

  async function validateId(id: string) {
    let url: URL;
    try {
      // Ids are usually already decoded by the URL parser but the storage API
      // can also be used directly with still encoded ids.
      url = new URL(decode(id));
    } catch {
      throw new HTTPError({
        statusCode: 400,
        statusText: `IPX_INVALID_URL`,
        message: `Invalid URL: ${id}`,
      });
    }
    await validateURL(url, id);
    return url.toString();
  }

  async function validateURL(url: URL, id: string = url.toString()) {
    if (!url.hostname) {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_MISSING_HOSTNAME`,
        message: `Hostname is missing: ${id}`,
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_PROTOCOL`,
        message: `Forbidden protocol: ${url.protocol}`,
      });
    }
    if (!allowAllDomains && !domains.has(url.hostname)) {
      throw new HTTPError({
        statusCode: 403,
        statusText: `IPX_FORBIDDEN_HOST`,
        message: `Forbidden host: ${url.hostname}`,
      });
    }
    if (blockPrivateIPs) {
      await validatePublicIP(url, id);
    }
  }

  /**
   * Rejects hosts that are, or resolve to, a non-public IP address.
   *
   * Both IP literals and hostnames are covered: an allowlisted hostname may still have a
   * DNS record pointing at `127.0.0.1` or `169.254.169.254`. All resolved addresses have
   * to be public, since which one the socket ends up using is not ours to decide.
   *
   * Limitation: this cannot close the TOCTOU / DNS-rebinding window. The name is resolved
   * again when `fetch` opens the socket, so a record with a short TTL can answer with a
   * public address here and a private one there. Closing that gap needs connection-level
   * pinning (a custom agent/dispatcher that validates the peer address of the socket it
   * just connected), which is out of reach of the plain `fetch` used here.
   */
  async function validatePublicIP(url: URL, id: string) {
    // Strip the brackets of an IPv6 literal (`[::1]`)
    const hostname = url.hostname.replace(/^\[|]$/g, "");

    const net = getBuiltinModule<typeof import("node:net")>("node:net");
    const dns = getBuiltinModule<typeof import("node:dns")>("node:dns");
    if (!net?.isIP || !dns?.promises?.lookup) {
      // Fail closed: the operator explicitly asked for private addresses to be blocked,
      // so a runtime without `node:net` / `node:dns` must not silently serve requests
      // with the check disabled.
      throw new HTTPError({
        statusCode: 500,
        statusText: `IPX_IP_CHECK_UNAVAILABLE`,
        message: `Cannot verify the address of ${hostname}: \`blockPrivateIPs\` requires \`node:net\` and \`node:dns\`.`,
      });
    }

    const assertPublic = (address: string, family: number) => {
      if (!isPublicIP(address, family)) {
        throw new HTTPError({
          statusCode: 403,
          statusText: `IPX_FORBIDDEN_IP`,
          message: `Forbidden IP address: ${address} (${id})`,
        });
      }
    };

    const family = net.isIP(hostname);
    if (family) {
      assertPublic(hostname, family);
      return;
    }

    // `lookup` (not `resolve`) so that the answer matches what the socket will use:
    // the OS resolver, including `/etc/hosts` and any local override.
    let addresses: { address: string; family: number }[];
    try {
      addresses = await dns.promises.lookup(hostname, {
        all: true,
        verbatim: true,
      });
    } catch {
      throw new HTTPError({
        statusCode: 502,
        statusText: `IPX_DNS_LOOKUP_FAILED`,
        message: `Cannot resolve host: ${hostname}`,
      });
    }

    if (addresses.length === 0) {
      throw new HTTPError({
        statusCode: 502,
        statusText: `IPX_DNS_LOOKUP_FAILED`,
        message: `Cannot resolve host: ${hostname}`,
      });
    }

    for (const { address, family } of addresses) {
      assertPublic(address, family || net.isIP(address));
    }
  }

  /**
   * Fetches `url`, following redirects manually so that every hop is re-validated
   * against the allowlist and, when enabled, the private IP check (see {@link validateURL}).
   *
   * Skipped (plain `fetch` with default redirect handling) when there is nothing to
   * validate — all domains allowed and `blockPrivateIPs` off — or when the user
   * explicitly set `redirect` in `fetchOptions` (opt-out).
   */
  async function fetchURL(url: string, init?: RequestInit): Promise<Response> {
    const _init: RequestInit = { ...fetchOptions, ...init };

    if ((allowAllDomains && !blockPrivateIPs) || _init.redirect) {
      return fetch(url, _init);
    }

    let currentURL = url;
    let method = _init.method || "GET";

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const response = await fetch(currentURL, {
        ..._init,
        method,
        redirect: "manual",
      });

      if (!REDIRECT_STATUS.has(response.status)) {
        return response;
      }

      const location = response.headers.get("location");
      if (!location) {
        // Not an actionable redirect, treat it as the final response.
        return response;
      }

      let nextURL: URL;
      try {
        nextURL = new URL(location, currentURL);
      } catch {
        throw new HTTPError({
          statusCode: 502,
          statusText: `IPX_INVALID_REDIRECT`,
          message: `Invalid redirect location: ${location}`,
        });
      }

      await validateURL(nextURL, location);

      // Per fetch semantics, 303 rewrites the request to GET (HEAD is kept as-is).
      if (response.status === 303 && method !== "HEAD") {
        method = "GET";
      }
      currentURL = nextURL.toString();
    }

    throw new HTTPError({
      statusCode: 502,
      statusText: `IPX_TOO_MANY_REDIRECTS`,
      message: `Too many redirects (max ${MAX_REDIRECTS}): ${url}`,
    });
  }

  function parseResponse(response: Response) {
    let maxAge = defaultMaxAge;
    if (_options.ignoreCacheControl !== true) {
      const _cacheControl = response.headers.get("cache-control");
      if (_cacheControl) {
        const m = _cacheControl.match(/max-age=(\d+)/);
        if (m && m[1]) {
          maxAge = Number.parseInt(m[1]);
        }
      }
    }

    let mtime;
    const _lastModified = response.headers.get("last-modified");
    if (_lastModified) {
      mtime = new Date(_lastModified);
    }

    return { maxAge, mtime };
  }

  return {
    name: "ipx:http",
    async getMeta(id) {
      const url = await validateId(id);
      try {
        const response = await fetchURL(url, { method: "HEAD" });
        if (!response.ok) {
          return {};
        }
        const { maxAge, mtime } = parseResponse(response);
        return { mtime, maxAge };
      } catch {
        return {};
      }
    },
    async getData(id) {
      const url = await validateId(id);
      const response = await fetchURL(url);
      if (!response.ok) {
        throw new HTTPError({
          statusCode: response.status,
          statusText: response.statusText,
          message: `Failed to fetch ${id}: ${response.status} ${response.statusText}`,
        });
      }
      return await response.arrayBuffer();
    },
  };
}
