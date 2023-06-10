'use strict';

const defu = require('defu');
const imageMeta = require('image-meta');
const ufo = require('ufo');
const node_fs = require('node:fs');
const pathe = require('pathe');
const destr = require('destr');
const http = require('node:http');
const https = require('node:https');
const nodeFetchNative = require('node-fetch-native');
const acceptNegotiator = require('@fastify/accept-negotiator');
const getEtag = require('etag');
const xss = require('xss');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const destr__default = /*#__PURE__*/_interopDefaultCompat(destr);
const http__default = /*#__PURE__*/_interopDefaultCompat(http);
const https__default = /*#__PURE__*/_interopDefaultCompat(https);
const getEtag__default = /*#__PURE__*/_interopDefaultCompat(getEtag);
const xss__default = /*#__PURE__*/_interopDefaultCompat(xss);

const Handlers = {
  __proto__: null,
  get b () { return b; },
  get background () { return background; },
  get blur () { return blur; },
  get crop () { return crop; },
  get enlarge () { return enlarge; },
  get extend () { return extend; },
  get extract () { return extract; },
  get fit () { return fit; },
  get flatten () { return flatten; },
  get flip () { return flip; },
  get flop () { return flop; },
  get gamma () { return gamma; },
  get grayscale () { return grayscale; },
  get h () { return h; },
  get height () { return height; },
  get median () { return median; },
  get modulate () { return modulate; },
  get negate () { return negate; },
  get normalize () { return normalize; },
  get pos () { return pos; },
  get position () { return position; },
  get q () { return q; },
  get quality () { return quality; },
  get resize () { return resize; },
  get rotate () { return rotate; },
  get s () { return s; },
  get sharpen () { return sharpen; },
  get threshold () { return threshold; },
  get tint () { return tint; },
  get trim () { return trim; },
  get w () { return w; },
  get width () { return width; }
};

function getEnv(name, defaultValue) {
  return destr__default(process.env[name]) ?? defaultValue;
}
function cachedPromise(function_) {
  let p;
  return (...arguments_) => {
    if (p) {
      return p;
    }
    p = Promise.resolve(function_(...arguments_));
    return p;
  };
}
class IPXError extends Error {
}
function createError(statusMessage, statusCode, trace) {
  const error = new IPXError(statusMessage + (trace ? ` (${trace})` : ""));
  error.statusMessage = "IPX: " + statusMessage;
  error.statusCode = statusCode;
  return error;
}

const createFilesystemSource = (options) => {
  const rootDir = pathe.resolve(options.dir);
  return async (id) => {
    const fsPath = pathe.resolve(pathe.join(rootDir, id));
    if (!isValidPath(fsPath) || !fsPath.startsWith(rootDir)) {
      throw createError("Forbidden path", 403, id);
    }
    let stats;
    try {
      stats = await node_fs.promises.stat(fsPath);
    } catch (error_) {
      const error = error_.code === "ENOENT" ? createError("File not found", 404, fsPath) : createError("File access error " + error_.code, 403, fsPath);
      throw error;
    }
    if (!stats.isFile()) {
      throw createError("Path should be a file", 400, fsPath);
    }
    return {
      mtime: stats.mtime,
      maxAge: options.maxAge,
      getData: cachedPromise(() => node_fs.promises.readFile(fsPath))
    };
  };
};
const isWindows = process.platform === "win32";
function isValidPath(fp) {
  if (isWindows) {
    fp = fp.slice(pathe.parse(fp).root.length);
  }
  if (/["*:<>?|]/.test(fp)) {
    return false;
  }
  return true;
}

const HTTP_RE = /^https?:\/\//;
const createHTTPSource = (options) => {
  const httpsAgent = new https__default.Agent({ keepAlive: true });
  const httpAgent = new http__default.Agent({ keepAlive: true });
  let _domains = options.domains || [];
  if (typeof _domains === "string") {
    _domains = _domains.split(",").map((s) => s.trim());
  }
  const domains = new Set(
    _domains.map((d) => {
      if (!HTTP_RE.test(d)) {
        d = "http://" + d;
      }
      return new URL(d).hostname;
    }).filter(Boolean)
  );
  return async (id, requestOptions) => {
    const hostname = new URL(id).hostname;
    if (!hostname) {
      throw createError("Hostname is missing", 403, id);
    }
    if (!requestOptions?.bypassDomain && !domains.has(hostname)) {
      throw createError("Forbidden host", 403, hostname);
    }
    const response = await nodeFetchNative.fetch(id, {
      // @ts-ignore
      agent: id.startsWith("https") ? httpsAgent : httpAgent,
      ...options.fetchOptions
    });
    if (!response.ok) {
      throw createError(
        "Fetch error",
        response.status || 500,
        response.statusText
      );
    }
    let maxAge = options.maxAge;
    const _cacheControl = response.headers.get("cache-control");
    if (_cacheControl) {
      const m = _cacheControl.match(/max-age=(\d+)/);
      if (m && m[1]) {
        maxAge = Number.parseInt(m[1]);
      }
    }
    let mtime;
    const _lastModified = response.headers.get("last-modified");
    if (_lastModified) {
      mtime = new Date(_lastModified);
    }
    return {
      mtime,
      maxAge,
      // @ts-ignore
      getData: cachedPromise(
        () => response.arrayBuffer().then((ab) => Buffer.from(ab))
      )
    };
  };
};

function VArg(argument) {
  return destr__default(argument);
}
function parseArgs(arguments_, mappers) {
  const vargs = arguments_.split("_");
  return mappers.map((v, index) => v(vargs[index]));
}
function getHandler(key) {
  return Handlers[key];
}
function applyHandler(context, pipe, handler, argumentsString) {
  const arguments_ = handler.args ? parseArgs(argumentsString, handler.args) : [];
  return handler.apply(context, pipe, ...arguments_);
}
function clampDimensionsPreservingAspectRatio(sourceDimensions, desiredDimensions) {
  const desiredAspectRatio = desiredDimensions.width / desiredDimensions.height;
  let { width, height } = desiredDimensions;
  if (width > sourceDimensions.width) {
    width = sourceDimensions.width;
    height = Math.round(sourceDimensions.width / desiredAspectRatio);
  }
  if (height > sourceDimensions.height) {
    height = sourceDimensions.height;
    width = Math.round(sourceDimensions.height * desiredAspectRatio);
  }
  return { width, height };
}

const quality = {
  args: [VArg],
  order: -1,
  apply: (context, _pipe, quality2) => {
    context.quality = quality2;
  }
};
const fit = {
  args: [VArg],
  order: -1,
  apply: (context, _pipe, fit2) => {
    context.fit = fit2;
  }
};
const position = {
  args: [VArg],
  order: -1,
  apply: (context, _pipe, position2) => {
    context.position = position2;
  }
};
const HEX_RE = /^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
const SHORTHEX_RE = /^([\da-f])([\da-f])([\da-f])$/i;
const background = {
  args: [VArg],
  order: -1,
  apply: (context, _pipe, background2) => {
    background2 = String(background2);
    if (!background2.startsWith("#") && (HEX_RE.test(background2) || SHORTHEX_RE.test(background2))) {
      background2 = "#" + background2;
    }
    context.background = background2;
  }
};
const enlarge = {
  args: [],
  apply: (context) => {
    context.enlarge = true;
  }
};
const width = {
  args: [VArg],
  apply: (context, pipe, width2) => {
    return pipe.resize(width2, void 0, {
      withoutEnlargement: !context.enlarge
    });
  }
};
const height = {
  args: [VArg],
  apply: (context, pipe, height2) => {
    return pipe.resize(void 0, height2, {
      withoutEnlargement: !context.enlarge
    });
  }
};
const resize = {
  args: [VArg, VArg, VArg],
  apply: (context, pipe, size) => {
    let [width2, height2] = String(size).split("x").map(Number);
    if (!width2) {
      return;
    }
    if (!height2) {
      height2 = width2;
    }
    if (!context.enlarge) {
      const clamped = clampDimensionsPreservingAspectRatio(context.meta, {
        width: width2,
        height: height2
      });
      width2 = clamped.width;
      height2 = clamped.height;
    }
    return pipe.resize(width2, height2, {
      fit: context.fit,
      position: context.position,
      background: context.background
    });
  }
};
const trim = {
  args: [VArg],
  apply: (_context, pipe, threshold2) => {
    return pipe.trim(threshold2);
  }
};
const extend = {
  args: [VArg, VArg, VArg, VArg],
  apply: (context, pipe, top, right, bottom, left) => {
    return pipe.extend({
      top,
      left,
      bottom,
      right,
      background: context.background
    });
  }
};
const extract = {
  args: [VArg, VArg, VArg, VArg],
  apply: (_context, pipe, left, top, width2, height2) => {
    return pipe.extract({
      left,
      top,
      width: width2,
      height: height2
    });
  }
};
const rotate = {
  args: [VArg],
  apply: (context, pipe, angel) => {
    return pipe.rotate(angel, {
      background: context.background
    });
  }
};
const flip = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flip();
  }
};
const flop = {
  args: [],
  apply: (_context, pipe) => {
    return pipe.flop();
  }
};
const sharpen = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe, sigma, flat, jagged) => {
    return pipe.sharpen(sigma, flat, jagged);
  }
};
const median = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe, size) => {
    return pipe.median(size);
  }
};
const blur = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe, sigma) => {
    return pipe.blur(sigma);
  }
};
const flatten = {
  args: [VArg, VArg, VArg],
  apply: (context, pipe) => {
    return pipe.flatten({
      background: context.background
    });
  }
};
const gamma = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe, gamma2, gammaOut) => {
    return pipe.gamma(gamma2, gammaOut);
  }
};
const negate = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe) => {
    return pipe.negate();
  }
};
const normalize = {
  args: [VArg, VArg, VArg],
  apply: (_context, pipe) => {
    return pipe.normalize();
  }
};
const threshold = {
  args: [VArg],
  apply: (_context, pipe, threshold2) => {
    return pipe.threshold(threshold2);
  }
};
const modulate = {
  args: [VArg],
  apply: (_context, pipe, brightness, saturation, hue) => {
    return pipe.modulate({
      brightness,
      saturation,
      hue
    });
  }
};
const tint = {
  args: [VArg],
  apply: (_context, pipe, rgb) => {
    return pipe.tint(rgb);
  }
};
const grayscale = {
  args: [VArg],
  apply: (_context, pipe) => {
    return pipe.grayscale();
  }
};
const crop = extract;
const q = quality;
const b = background;
const w = width;
const h = height;
const s = resize;
const pos = position;

const SUPPORTED_FORMATS = /* @__PURE__ */ new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "tiff",
  "heif",
  "gif"
]);
function createIPX(userOptions) {
  const defaults = {
    dir: getEnv("IPX_DIR", "."),
    domains: getEnv("IPX_DOMAINS", []),
    alias: getEnv("IPX_ALIAS", {}),
    fetchOptions: getEnv("IPX_FETCH_OPTIONS", {}),
    maxAge: getEnv("IPX_MAX_AGE", 300),
    sharp: {}
  };
  const options = defu.defu(userOptions, defaults);
  options.alias = Object.fromEntries(
    Object.entries(options.alias).map((e) => [ufo.withLeadingSlash(e[0]), e[1]])
  );
  const context = {
    sources: {}
  };
  if (options.dir) {
    context.sources.filesystem = createFilesystemSource({
      dir: options.dir,
      maxAge: options.maxAge
    });
  }
  if (options.domains) {
    context.sources.http = createHTTPSource({
      domains: options.domains,
      fetchOptions: options.fetchOptions,
      maxAge: options.maxAge
    });
  }
  return function ipx(id, modifiers = {}, requestOptions = {}) {
    if (!id) {
      throw createError("resource id is missing", 400);
    }
    id = ufo.hasProtocol(id) ? id : ufo.withLeadingSlash(id);
    for (const base in options.alias) {
      if (id.startsWith(base)) {
        id = ufo.joinURL(options.alias[base], id.slice(base.length));
      }
    }
    const getSource = cachedPromise(() => {
      const source = ufo.hasProtocol(id) ? "http" : "filesystem";
      if (!context.sources[source]) {
        throw createError("Unknown source", 400, source);
      }
      return context.sources[source](id, requestOptions);
    });
    const getData = cachedPromise(async () => {
      const source = await getSource();
      const data = await source.getData();
      const meta = imageMeta.imageMeta(data);
      let mFormat = modifiers.f || modifiers.format;
      if (mFormat === "jpg") {
        mFormat = "jpeg";
      }
      const format = mFormat && SUPPORTED_FORMATS.has(mFormat) ? mFormat : SUPPORTED_FORMATS.has(meta.type) ? meta.type : "jpeg";
      if (meta.type === "svg" && !mFormat) {
        return {
          data,
          format: "svg+xml",
          meta
        };
      }
      const animated = modifiers.animated !== void 0 || modifiers.a !== void 0 || format === "gif";
      const Sharp = await import('sharp').then(
        (r) => r.default || r
      );
      let sharp = Sharp(data, { animated, ...options.sharp });
      const handlers = Object.entries(modifiers).map(([name, arguments_]) => ({
        handler: getHandler(name),
        name,
        args: arguments_
      })).filter((h) => h.handler).sort((a, b) => {
        const aKey = (a.handler.order || a.name || "").toString();
        const bKey = (b.handler.order || b.name || "").toString();
        return aKey.localeCompare(bKey);
      });
      const handlerContext = { meta };
      for (const h of handlers) {
        sharp = applyHandler(handlerContext, sharp, h.handler, h.args) || sharp;
      }
      if (SUPPORTED_FORMATS.has(format)) {
        sharp = sharp.toFormat(format, {
          quality: handlerContext.quality,
          progressive: format === "jpeg"
        });
      }
      const newData = await sharp.toBuffer();
      return {
        data: newData,
        format,
        meta
      };
    });
    return {
      src: getSource,
      data: getData
    };
  };
}

const MODIFIER_SEP = /[&,]/g;
const MODIFIER_VAL_SEP = /[:=_]/;
async function _handleRequest(request, ipx) {
  const res = {
    statusCode: 200,
    statusMessage: "",
    headers: {},
    body: ""
  };
  const [modifiersString = "", ...idSegments] = request.url.slice(
    1
    /* leading slash */
  ).split("/");
  const id = safeString(ufo.decode(idSegments.join("/")));
  if (!modifiersString) {
    throw createError("Modifiers are missing", 400, request.url);
  }
  if (!id || id === "/") {
    throw createError("Resource id is missing", 400, request.url);
  }
  const modifiers = /* @__PURE__ */ Object.create(null);
  if (modifiersString !== "_") {
    for (const p of modifiersString.split(MODIFIER_SEP)) {
      const [key, ...values] = p.split(MODIFIER_VAL_SEP);
      modifiers[safeString(key)] = values.map((v) => safeString(ufo.decode(v))).join("_");
    }
  }
  const mFormat = modifiers.f || modifiers.format;
  if (mFormat === "auto") {
    const acceptHeader = request.headers?.accept || "";
    const autoFormat = autoDetectFormat(
      acceptHeader,
      !!(modifiers.a || modifiers.animated)
    );
    delete modifiers.f;
    delete modifiers.format;
    if (autoFormat) {
      modifiers.format = autoFormat;
      res.headers.vary = "Accept";
    }
  }
  const img = ipx(id, modifiers, request.options);
  const source = await img.src();
  if (source.mtime) {
    if (request.headers?.["if-modified-since"] && new Date(request.headers["if-modified-since"]) >= source.mtime) {
      res.statusCode = 304;
      return res;
    }
    res.headers["Last-Modified"] = source.mtime.toUTCString();
  }
  if (typeof source.maxAge === "number") {
    res.headers["Cache-Control"] = `max-age=${+source.maxAge}, public, s-maxage=${+source.maxAge}`;
  }
  const { data, format } = await img.data();
  const etag = getEtag__default(data);
  res.headers.ETag = etag;
  if (etag && request.headers?.["if-none-match"] === etag) {
    res.statusCode = 304;
    return res;
  }
  if (format) {
    res.headers["Content-Type"] = `image/${format}`;
  }
  res.headers["Content-Security-Policy"] = "default-src 'none'";
  res.body = data;
  return sanetizeReponse(res);
}
function handleRequest(request, ipx) {
  return _handleRequest(request, ipx).catch((error) => {
    const statusCode = Number.parseInt(error.statusCode) || 500;
    const statusMessage = error.statusMessage ? error.statusMessage : `IPX Error (${statusCode})`;
    if (process.env.NODE_ENV !== "production" && statusCode === 500) {
      console.error(error);
    }
    return sanetizeReponse({
      statusCode,
      statusMessage,
      body: "IPX Error: " + error,
      headers: {},
      error
    });
  });
}
function createIPXMiddleware(ipx, options = {}) {
  return function IPXMiddleware(request, res, next) {
    return handleRequest(
      { url: request.url || "/", headers: request.headers },
      ipx
    ).then((_res) => {
      if (options.fallthrough && next && _res.error) {
        return next(_res.error);
      }
      res.statusCode = _res.statusCode;
      res.statusMessage = _res.statusMessage;
      for (const name in _res.headers) {
        res.setHeader(name, _res.headers[name]);
      }
      res.end(_res.body);
    });
  };
}
function autoDetectFormat(acceptHeader, animated) {
  if (animated) {
    const acceptMime2 = acceptNegotiator.negotiate(acceptHeader, ["image/webp", "image/gif"]);
    return acceptMime2?.split("/")[1] || "gif";
  }
  const acceptMime = acceptNegotiator.negotiate(acceptHeader, [
    "image/avif",
    "image/webp",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/heif",
    "image/gif"
  ]);
  return acceptMime?.split("/")[1] || "jpeg";
}
function sanetizeReponse(res) {
  return {
    statusCode: res.statusCode || 200,
    statusMessage: res.statusMessage ? safeString(res.statusMessage) : "OK",
    headers: safeStringObject(res.headers || {}),
    body: typeof res.body === "string" ? xss__default(safeString(res.body)) : res.body || ""
  };
}
function safeString(input) {
  return JSON.stringify(input).replace(/^"|"$/g, "").replace(/\\+/g, "\\").replace(/\\"/g, '"');
}
function safeStringObject(input) {
  const dst = {};
  for (const key in input) {
    dst[key] = safeString(input[key]);
  }
  return dst;
}

exports.createIPX = createIPX;
exports.createIPXMiddleware = createIPXMiddleware;
exports.handleRequest = handleRequest;
