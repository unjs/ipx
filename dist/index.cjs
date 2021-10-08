'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const Sharp = require('sharp');
const defu = require('defu');
const imageMeta = require('image-meta');
const ufo = require('ufo');
const path = require('path');
const isValidPath = require('is-valid-path');
const fsExtra = require('fs-extra');
const destr = require('destr');
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const getEtag = require('etag');
const xss = require('xss');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const Sharp__default = /*#__PURE__*/_interopDefaultLegacy(Sharp);
const defu__default = /*#__PURE__*/_interopDefaultLegacy(defu);
const imageMeta__default = /*#__PURE__*/_interopDefaultLegacy(imageMeta);
const isValidPath__default = /*#__PURE__*/_interopDefaultLegacy(isValidPath);
const destr__default = /*#__PURE__*/_interopDefaultLegacy(destr);
const http__default = /*#__PURE__*/_interopDefaultLegacy(http);
const https__default = /*#__PURE__*/_interopDefaultLegacy(https);
const fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);
const getEtag__default = /*#__PURE__*/_interopDefaultLegacy(getEtag);
const xss__default = /*#__PURE__*/_interopDefaultLegacy(xss);

const Handlers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  get quality () { return quality; },
  get fit () { return fit; },
  get background () { return background; },
  get enlarge () { return enlarge; },
  get width () { return width; },
  get height () { return height; },
  get resize () { return resize; },
  get trim () { return trim; },
  get extend () { return extend; },
  get extract () { return extract; },
  get rotate () { return rotate; },
  get flip () { return flip; },
  get flop () { return flop; },
  get sharpen () { return sharpen; },
  get median () { return median; },
  get blur () { return blur; },
  get flatten () { return flatten; },
  get gamma () { return gamma; },
  get negate () { return negate; },
  get normalize () { return normalize; },
  get threshold () { return threshold; },
  get modulate () { return modulate; },
  get tint () { return tint; },
  get grayscale () { return grayscale; },
  get crop () { return crop; },
  get q () { return q; },
  get b () { return b; },
  get w () { return w; },
  get h () { return h; },
  get s () { return s; }
});

function getEnv(name, defaultValue) {
  var _a;
  return (_a = destr__default['default'](process.env[name])) != null ? _a : defaultValue;
}
function cachedPromise(fn) {
  let p;
  return (...args) => {
    if (p) {
      return p;
    }
    p = Promise.resolve(fn(...args));
    return p;
  };
}
class IPXError extends Error {
}
function createError(message, statusCode) {
  const err = new IPXError(message);
  err.statusMessage = "IPX: " + message;
  err.statusCode = statusCode;
  return err;
}

const createFilesystemSource = (options) => {
  const rootDir = path.resolve(options.dir);
  return async (id) => {
    const fsPath = path.resolve(path.join(rootDir, id));
    if (!isValidPath__default['default'](id) || id.includes("..") || !fsPath.startsWith(rootDir)) {
      throw createError("Forbidden path:" + id, 403);
    }
    let stats;
    try {
      stats = await fsExtra.stat(fsPath);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw createError("File not found: " + fsPath, 404);
      } else {
        throw createError("File access error for " + fsPath + ":" + err.code, 403);
      }
    }
    if (!stats.isFile()) {
      throw createError("Path should be a file: " + fsPath, 400);
    }
    return {
      mtime: stats.mtime,
      maxAge: options.maxAge || 300,
      getData: cachedPromise(() => fsExtra.readFile(fsPath))
    };
  };
};

const createHTTPSource = (options) => {
  const httpsAgent = new https__default['default'].Agent({ keepAlive: true });
  const httpAgent = new http__default['default'].Agent({ keepAlive: true });
  let domains = options.domains || [];
  if (typeof domains === "string") {
    domains = domains.split(",").map((s) => s.trim());
  }
  const hosts = domains.map((domain) => ufo.parseURL(domain, "https://").host);
  return async (id, reqOptions) => {
    const parsedUrl = ufo.parseURL(id, "https://");
    if (!parsedUrl.host) {
      throw createError("Hostname is missing: " + id, 403);
    }
    if (!(reqOptions == null ? void 0 : reqOptions.bypassDomain) && !hosts.find((host) => parsedUrl.host === host)) {
      throw createError("Forbidden host: " + parsedUrl.host, 403);
    }
    const response = await fetch__default['default'](id, {
      agent: id.startsWith("https") ? httpsAgent : httpAgent
    });
    if (!response.ok) {
      throw createError(response.statusText || "fetch error", response.status || 500);
    }
    let maxAge = options.maxAge || 300;
    const _cacheControl = response.headers.get("cache-control");
    if (_cacheControl) {
      const m = _cacheControl.match(/max-age=(\d+)/);
      if (m && m[1]) {
        maxAge = parseInt(m[1]);
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
      getData: cachedPromise(() => response.buffer())
    };
  };
};

function VArg(arg) {
  return destr__default['default'](arg);
}
function parseArgs(args, mappers) {
  const vargs = args.split("_");
  return mappers.map((v, i) => v(vargs[i]));
}
function getHandler(key) {
  return Handlers[key];
}
function applyHandler(ctx, pipe, handler, argsStr) {
  const args = handler.args ? parseArgs(argsStr, handler.args) : [];
  return handler.apply(ctx, pipe, ...args);
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
const HEX_RE = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const SHORTHEX_RE = /^([a-f\d])([a-f\d])([a-f\d])$/i;
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
    return pipe.resize(width2, null, { withoutEnlargement: !context.enlarge });
  }
};
const height = {
  args: [VArg],
  apply: (context, pipe, height2) => {
    return pipe.resize(null, height2, { withoutEnlargement: !context.enlarge });
  }
};
const resize = {
  args: [VArg, VArg, VArg],
  apply: (context, pipe, size) => {
    let [width2, height2] = String(size).split("x").map((v) => Number(v));
    if (!context.enlarge) {
      const clamped = clampDimensionsPreservingAspectRatio(context.meta, { width: width2, height: height2 });
      width2 = clamped.width;
      height2 = clamped.height;
    }
    return pipe.resize(width2, height2, {
      fit: context.fit,
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
  apply: (_context, pipe) => {
    return pipe.blur();
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

const SUPPORTED_FORMATS = ["jpeg", "png", "webp", "avif", "tiff"];
function createIPX(userOptions) {
  const defaults = {
    dir: getEnv("IPX_DIR", "."),
    domains: getEnv("IPX_DOMAINS", []),
    alias: getEnv("IPX_ALIAS", {}),
    sharp: {}
  };
  const options = defu__default['default'](userOptions, defaults);
  options.alias = Object.fromEntries(Object.entries(options.alias).map((e) => [ufo.withLeadingSlash(e[0]), e[1]]));
  const ctx = {
    sources: {}
  };
  if (options.dir) {
    ctx.sources.filesystem = createFilesystemSource({
      dir: options.dir
    });
  }
  if (options.domains) {
    ctx.sources.http = createHTTPSource({
      domains: options.domains
    });
  }
  return function ipx(id, modifiers = {}, reqOptions = {}) {
    if (!id) {
      throw createError("resource id is missing", 400);
    }
    id = ufo.hasProtocol(id) ? id : ufo.withLeadingSlash(id);
    for (const base in options.alias) {
      if (id.startsWith(base)) {
        id = ufo.joinURL(options.alias[base], id.substr(base.length));
      }
    }
    const getSrc = cachedPromise(() => {
      const source = ufo.hasProtocol(id) ? "http" : "filesystem";
      if (!ctx.sources[source]) {
        throw createError("Unknown source: " + source, 400);
      }
      return ctx.sources[source](id, reqOptions);
    });
    const getData = cachedPromise(async () => {
      const src = await getSrc();
      const data = await src.getData();
      const meta = imageMeta__default['default'](data);
      const mFormat = modifiers.f || modifiers.format;
      let format = mFormat || meta.type;
      if (format === "jpg") {
        format = "jpeg";
      }
      if (meta.type === "svg" && !mFormat) {
        return {
          data,
          format: "svg+xml",
          meta
        };
      }
      const animated = modifiers.animated !== void 0 || modifiers.a !== void 0;
      if (animated) {
        format = "webp";
      }
      let sharp = Sharp__default['default'](data, { animated });
      Object.assign(sharp.options, options.sharp);
      const handlers = Object.entries(modifiers).map(([name, args]) => ({ handler: getHandler(name), name, args })).filter((h) => h.handler).sort((a, b) => {
        const aKey = (a.handler.order || a.name || "").toString();
        const bKey = (b.handler.order || b.name || "").toString();
        return aKey.localeCompare(bKey);
      });
      const handlerCtx = { meta };
      for (const h of handlers) {
        sharp = applyHandler(handlerCtx, sharp, h.handler, h.args) || sharp;
      }
      if (SUPPORTED_FORMATS.includes(format)) {
        sharp = sharp.toFormat(format, {
          quality: handlerCtx.quality,
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
      src: getSrc,
      data: getData
    };
  };
}

async function _handleRequest(req, ipx) {
  const res = {
    statusCode: 200,
    statusMessage: "",
    headers: {},
    body: ""
  };
  const [modifiersStr = "", ...idSegments] = req.url.substr(1).split("/");
  const id = ufo.decode(idSegments.join("/"));
  if (!modifiersStr) {
    throw createError("Modifiers is missing in path: " + req.url, 400);
  }
  if (!id || id === "/") {
    throw createError("Resource id is missing: " + req.url, 400);
  }
  const modifiers = Object.create(null);
  if (modifiersStr !== "_") {
    for (const p of modifiersStr.split(",")) {
      const [key, value = ""] = p.split("_");
      modifiers[key] = ufo.decode(value);
    }
  }
  const img = ipx(id, modifiers, req.options);
  const src = await img.src();
  if (src.mtime) {
    if (req.headers["if-modified-since"]) {
      if (new Date(req.headers["if-modified-since"]) >= src.mtime) {
        res.statusCode = 304;
        return res;
      }
    }
    res.headers["Last-Modified"] = +src.mtime + "";
  }
  if (src.maxAge !== void 0) {
    res.headers["Cache-Control"] = `max-age=${+src.maxAge}, public, s-maxage=${+src.maxAge}`;
  }
  const { data, format } = await img.data();
  const etag = getEtag__default['default'](data);
  res.headers.ETag = etag;
  if (etag && req.headers["if-none-match"] === etag) {
    res.statusCode = 304;
    return res;
  }
  if (format) {
    res.headers["Content-Type"] = `image/${format}`;
  }
  res.body = data;
  return res;
}
function handleRequest(req, ipx) {
  return _handleRequest(req, ipx).catch((err) => {
    const statusCode = parseInt(err.statusCode) || 500;
    const statusMessage = err.statusMessage ? xss__default['default'](err.statusMessage) : `IPX Error (${statusCode})`;
    if (process.env.NODE_ENV !== "production" && statusCode === 500) {
      console.error(err);
    }
    return {
      statusCode,
      statusMessage,
      body: statusMessage,
      headers: {}
    };
  });
}
function createIPXMiddleware(ipx) {
  return function IPXMiddleware(req, res) {
    handleRequest({ url: req.url, headers: req.headers }, ipx).then((_res) => {
      res.statusCode = _res.statusCode;
      res.statusMessage = _res.statusMessage;
      for (const name in _res.headers) {
        res.setHeader(name, _res.headers[name]);
      }
      res.end(_res.body);
    });
  };
}

exports.createIPX = createIPX;
exports.createIPXMiddleware = createIPXMiddleware;
exports.handleRequest = handleRequest;
