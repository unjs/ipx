# 🖼️ IPX

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/ipx?color=yellow)](https://npmjs.com/package/ipx)
[![npm downloads](https://img.shields.io/npm/dm/ipx?color=yellow)](https://npm.chart.dev/ipx)

<!-- /automd -->

High performance, secure and easy-to-use image optimizer powered by [sharp](https://github.com/lovell/sharp) and [svgo](https://github.com/svg/svgo).

Used by [Nuxt Image](https://image.nuxt.com/) and [Netlify](https://www.npmjs.com/package/@netlify/ipx) and open to everyone!

## Migration from v3 to v4

> [!NOTE]
> This is the active development branch for IPX v4. Check out [v3](https://github.com/unjs/ipx/tree/v3) for v3 docs.

- The server creation APIs have changed. See the Programmatic API section for examples.
- The JSON error format has changed from `{ error: string }` to `{ status, statusText, message }`.
- The `svgo` option is now `svg.optimize`. SVG images are always sanitized, even when optimization is disabled.
- SVG optimization now applies SVGO's `preset-default` unless custom `plugins` are configured (previously only the configured plugins ran), so SVG output is restructured more than before. See the SVG Images section.

## Using CLI

You can use `ipx` command to start server.

Using `npx`:

```bash
npx ipx serve --dir ./
```

Using `bun`

```bash
bunx ipx serve --dir ./
```

The default serve directory is the current working directory.

## Programmatic API

You can use IPX as a middleware or directly use IPX interface.

**Example:** Using built-in server

<!-- automd:file code src="./examples/serve.ts" -->

```ts [serve.ts]
import { serveIPX, createIPX, ipxFSStorage, ipxHttpStorage } from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

// http://localhost:3000/w_512/picsum/1000
serveIPX(ipx);
```

<!-- /automd -->

**Example**: Using with [h3](https://h3.dev)

<!-- automd:file code src="./examples/h3.ts" -->

```ts [h3.ts]
import { H3, serve } from "h3";

import {
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
  createIPXFetchHandler,
} from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

const app = new H3();

app.mount("/ipx", createIPXFetchHandler(ipx));

// http://localhost:3000/ipx/w_512/picsum/1000
serve(app);
```

<!-- /automd -->

**Example:** Using with [express](https://expressjs.com)

<!-- automd:file code src="./examples/express.ts" -->

```ts [express.ts]
import Express from "express";

import {
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
  createIPXNodeHandler,
} from "ipx";

import type { RequestHandler } from "express";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

const app = Express();

app.use("/ipx", createIPXNodeHandler(ipx) as RequestHandler);

// http://localhost:3000/ipx/w_512/picsum/1000
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
```

<!-- /automd -->

## URL Examples

Get original image:

`/_/static/buffalo.png`

Change format to `webp` and keep other things same as source:

`/f_webp/static/buffalo.png`

Automatically convert to a preferred format (avif/webp/jpeg). Uses the browsers `accept` header to negotiate:

`/f_auto/static/buffalo.png`

Keep original format (`png`) and set width to `200`:

`/w_200/static/buffalo.png`

Resize to `200x200px` using `embed` method and change format to `webp`:

`/embed,f_webp,s_200x200/static/buffalo.png`

## Custom URL Style

The `parseURL` option accepts a function that extracts the resource id and modifiers from the request URL, allowing any URL style you like. It receives the raw (still percent-encoded) request URL, so it is free to decode it however the URL style requires.

**Example:** modifiers in the filename (`/<id>@@<modifiers>.<format>`), which can be preferable when prerendering images for static hosting.

```ts
import { createIPXFetchHandler, parseIPXURL } from "ipx";

const handler = createIPXFetchHandler(ipx, {
  parseURL(url) {
    const path = decodeURIComponent(new URL(url).pathname.slice(1));

    const match = path.match(/^(.+)@@(.+)\.([^.]+)$/);
    if (!match) {
      // Not our style, fall back to the default `/<modifiers>/<id>`
      return parseIPXURL(url);
    }

    const [, id = "", modifiersString = "", format = ""] = match;
    const modifiers = Object.fromEntries(
      modifiersString.split(",").map((m) => {
        const [key = "", ...values] = m.split("_");
        return [key, values.join("_")];
      }),
    );

    return { id, modifiers: { ...modifiers, format } };
  },
});

// http://localhost:3000/static/buffalo.png@@s_200x200.webp
// http://localhost:3000/static/buffalo.png@@grayscale,w_200.webp
```

The parser may be async, and can throw an `HTTPError` (re-exported from `ipx`) to reject a request with a specific status code.

Returned values are escaped by IPX, so custom parsers don't need to do it themselves. Note this is not an access check — exactly as with the default URL style, what the resulting id is allowed to resolve to is enforced by the storage layer (`ipxFSStorage`'s directory boundary, `ipxHttpStorage`'s domain allowlist).

## Config

You can universally customize IPX configuration using `IPX_*` environment variables.

- `IPX_ALIAS`
  - Default: `{}`
- `IPX_MAX_OUTPUT_DIMENSION`
  - Default: `8192`
  - Maximum width and height (in pixels) of the output image (option: `maxOutputDimension`). Requested `width`, `height` and `resize` dimensions are clamped to it, preserving the requested aspect ratio, and `extend` edges are clamped so the extended canvas stays within it. This bounds how much memory a single request can allocate: sharp only limits the _input_ size, so without it `/enlarge,s_20000x20000/image.jpg` (or `/extend_10000_10000_10000_10000/image.jpg`) allocates gigabytes from a small source image. Set to `false` to disable, which is only safe when modifiers come from a trusted source.

### Filesystem Source Options

(enabled by default with CLI only)

#### `IPX_FS_DIR`

- Default: `.` (current working directory)

#### `IPX_FS_MAX_AGE`

- Default: `300`

### HTTP(s) Source Options

(enabled by default with CLI only)

#### `IPX_HTTP_DOMAINS`

- Default: `[]`
- Allowlist of hostnames images can be fetched from (option: `domains`). Only `http:` and `https:` URLs are allowed (anything else is rejected with `403 IPX_FORBIDDEN_PROTOCOL`), and redirects are followed **only within the allowlist**, up to 3 hops: each redirect target is re-validated and a redirect to a host that is not listed is rejected with `403 IPX_FORBIDDEN_HOST` (`502 IPX_TOO_MANY_REDIRECTS` beyond 3 hops). Previously redirects were followed blindly, which let an allowlisted host with an open redirect bounce IPX to internal addresses such as the cloud metadata service (SSRF). If an allowlisted host redirects to a CDN, add the CDN hostname to the allowlist as well. Redirect re-validation is skipped when `IPX_HTTP_ALLOW_ALL_DOMAINS` is enabled (nothing to validate) or when `redirect` is explicitly set in `IPX_HTTP_FETCH_OPTIONS`.

#### `IPX_HTTP_MAX_AGE`

- Default: `300`

#### `IPX_HTTP_FETCH_OPTIONS`

- Default: `{}`

#### `IPX_HTTP_ALLOW_ALL_DOMAINS`

- Default: `false`

## Modifiers

Modifier arguments are separated with `_` and validated before they reach sharp. Invalid input is rejected with a `400 IPX_INVALID_MODIFIER_ARG` (or `400 IPX_MISSING_MODIFIER_ARG` for a required argument) instead of failing the request. Some arguments can only be validated by libvips once it runs, which happens after the whole pipeline is set up; those surface as a `400 IPX_INVALID_MODIFIER`. Trailing arguments may be omitted to keep the sharp default, except where noted.

Colours (`background`, `tint`) accept any colour sharp understands: hex (`f00`, `ff0000`, `ff000080`) with an optional leading `#` — which cannot be used inside a URL path, so it may be dropped — or a CSS colour name (`red`). Boolean arguments accept `true` / `false` as well as the shorter `1` / `0`.

| Property       | Docs                                                            | Example                                                          | Comments                                                                                                                                                                                                                                          |
| -------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| width / w      | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/width_200/buffalo.png` or `/w_200/buffalo.png`                 | Positive integer.                                                                                                                                                                                                                                 |
| height / h     | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/height_200/buffalo.png` or `/h_200/buffalo.png`                | Positive integer.                                                                                                                                                                                                                                 |
| resize / s     | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200/buffalo.png`                                         | `{width}x{height}` of positive integers. A single value (`/s_200/`) is a square.                                                                                                                                                                   |
| kernel         | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,kernel_nearest/buffalo.png`                          | Sets `kernel` option for `resize`. One of `nearest`, `linear`, `cubic`, `mitchell`, `lanczos2`, `lanczos3` (default), `mks2013` or `mks2021`.                                                                                                      |
| fit            | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,fit_outside/buffalo.png`                             | Sets `fit` option for `resize`. One of `contain`, `cover` (default), `fill`, `inside` or `outside`.                                                                                                                                                |
| position / pos | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,pos_top/buffalo.png`                                 | Sets `position` option for `resize`. A position (`top`, `right top`, `right`, `right bottom`, `bottom`, `left bottom`, `left`, `left top`), gravity (`north`, `northeast`, ..., `center`) or strategy (`entropy`, `attention`). Since `_` separates arguments, multi-word values use `-` (`/pos_right-top/`). The numeric gravity (`0`-`8`) and strategy (`16`-`17`) constants are also accepted.  |
| trim           | [Docs](https://sharp.pixelplumbing.com/api-resize#trim)         | `/trim_100/buffalo.png`                                          | Trim threshold, a number `>= 0` (defaults to `10`).                                                                                                                                                                                               |
| extend         | [Docs](https://sharp.pixelplumbing.com/api-resize#extend)       | `/extend_10_20_10_20_mirror/buffalo.png`                         | Extend / pad / extrude one or more edges of the image. Format: `/extend_{top}_{right}_{bottom}_{left}_{extendWith}/`. Edges are integers between `0` and `10000`. Optional `extendWith`: `background` (default), `copy`, `repeat` or `mirror`. When extending with `background`, the colour comes from the `background` / `b` modifier, e.g. `/b_00ff00,extend_10_20_10_20/buffalo.png`. |
| background / b | \_                                                              | `/r_45,b_00ff00/buffalo.png`                                     | Background colour used by `extend`, `rotate`, `flatten`, `opacity` and `resize` (with `fit_contain`).                                                                                                                                     |
| extract        | [Docs](https://sharp.pixelplumbing.com/api-resize#extract)      | `/extract_{left}_{top}_{width}_{height}/buffalo.png`             | Extract/crop a region of the image. All four arguments are required; `width` and `height` must be positive.                                                                                                                                        |
| crop           | [Docs](https://sharp.pixelplumbing.com/api-resize#extract)      | `/crop_{left}_{top}_{width}_{height}/buffalo.png`                | Alias for extract. Extract/crop a region of the image.                                                                                                                                                                                            |
| format / f     | [Docs](https://sharp.pixelplumbing.com/api-output#toformat)     | `/format_webp/buffalo.png` or `/f_webp/buffalo.png`              | Supported format: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `heif`, `tiff` and `auto` (experimental only with middleware)                                                                                                                       |
| quality / q    | \_                                                              | `/quality_50/buffalo.png` or `/q_50/buffalo.png`                 | Integer between `1` and `100`.                                                                                                                                                                                                                    |
| rotate         | [Docs](https://sharp.pixelplumbing.com/api-operation#rotate)    | `/rotate_45/buffalo.png`                                         | Angle in degrees, between `-3600` and `3600`. Angles that are not a multiple of `90` are filled with the `background` / `b` colour. Without an angle (`/rotate/`) the image is auto-oriented from its EXIF tag.                                     |
| enlarge        | \_                                                              | `/enlarge,s_2000x2000/buffalo.png`                               | Allow the image to be upscaled. By default the returned image will never be larger than the source in any dimension, while preserving the requested aspect ratio.                                                                                  |
| autoorient     | [Docs](https://sharp.pixelplumbing.com/api-operation#autoorient) | `/autoorient/buffalo.png`                                       | Rotate and flip the image based on its EXIF `Orientation` tag, then remove the tag.                                                                                                                                                               |
| flip           | [Docs](https://sharp.pixelplumbing.com/api-operation#flip)      | `/flip/buffalo.png`                                              |                                                                                                                                                                                                                                                   |
| flop           | [Docs](https://sharp.pixelplumbing.com/api-operation#flop)      | `/flop/buffalo.png`                                              |                                                                                                                                                                                                                                                   |
| sharpen        | [Docs](https://sharp.pixelplumbing.com/api-operation#sharpen)   | `/sharpen_2_1_2/buffalo.png`                                     | `{sigma}_{flat}_{jagged}_{x1}_{y2}_{y3}`. `sigma` is between `0.000001` and `10`, the rest between `0` and `1000000`. Without arguments (`/sharpen/`) a mild sharpen is applied.                                                                   |
| median         | [Docs](https://sharp.pixelplumbing.com/api-operation#median)    | `/median_10/buffalo.png`                                         | Square mask size, an integer between `1` and `1000` (defaults to `3`).                                                                                                                                                                            |
| blur           | [Docs](https://sharp.pixelplumbing.com/api-operation#blur)      | `/blur_5/buffalo.png`                                            | `{sigma}_{precision}_{minAmplitude}`. `sigma` is a number between `0.3` and `1000`, `precision` one of `integer` (default), `float` or `approximate`, `minAmplitude` a number between `0.001` and `1`. Without arguments (`/blur/`) a mild blur is applied. |
| dilate         | [Docs](https://sharp.pixelplumbing.com/api-operation#dilate)    | `/dilate_3/buffalo.png`                                          | Expand foreground objects. Width in pixels, an integer between `1` and `100` (defaults to `1`). Capped below the sharp maximum, since the cost grows with the width.                                                                               |
| erode          | [Docs](https://sharp.pixelplumbing.com/api-operation#erode)     | `/erode_3/buffalo.png`                                           | Shrink foreground objects. Width in pixels, an integer between `1` and `100` (defaults to `1`). Capped below the sharp maximum, since the cost grows with the width.                                                                               |
| clahe          | [Docs](https://sharp.pixelplumbing.com/api-operation#clahe)     | `/clahe_50_50_3/buffalo.png`                                     | Contrast limiting adaptive histogram equalization, as `{width}_{height}_{maxSlope}`. `width` is required and `height` defaults to it (a square window); both are integers between `1` and `100`, capped below the sharp maximum since the cost grows with the window, and clamped to the source dimensions. `maxSlope` is an integer between `0` and `100` (defaults to `3`). |
| unflatten      | [Docs](https://sharp.pixelplumbing.com/api-operation#unflatten) | `/unflatten/buffalo.png`                                         |                                                                                                                                                                                                                                                   |
| gamma          | [Docs](https://sharp.pixelplumbing.com/api-operation#gamma)     | `/gamma_2.2_1.8/buffalo.png`                                     | `{gamma}_{gammaOut}`, each a number between `1.0` and `3.0` (defaults to `2.2`).                                                                                                                                                                  |
| negate         | [Docs](https://sharp.pixelplumbing.com/api-operation#negate)    | `/negate/buffalo.png`                                            | Optional `{alpha}` (`true` by default) controls whether the alpha channel is negated too, e.g. `/negate_false/`.                                                                                                                                   |
| normalize      | [Docs](https://sharp.pixelplumbing.com/api-operation#normalize) | `/normalize_1_99/buffalo.png`                                    | Stretch the luminance to the full dynamic range, as `{lower}_{upper}` percentiles. `lower` is a number between `0` and `99` (defaults to `1`), `upper` between `1` and `100` (defaults to `99`) and has to be greater than `lower`.                |
| threshold      | [Docs](https://sharp.pixelplumbing.com/api-operation#threshold) | `/threshold_10/buffalo.png`                                      | `{threshold}_{grayscale}`. `threshold` is an integer between `0` and `255` (defaults to `128`). Optional `grayscale` (`true` by default) converts to single channel grayscale first, e.g. `/threshold_128_false/`.                                  |
| linear         | [Docs](https://sharp.pixelplumbing.com/api-operation#linear)    | `/linear_1.2_-10/buffalo.png`                                    | Levels adjustment applying `a * input + b`, as `{a}_{b}`. `a` is the multiplier (defaults to `1`), `b` the offset (defaults to `0`).                                                                                                               |
| tint           | [Docs](https://sharp.pixelplumbing.com/api-colour#tint)         | `/tint_00ff00/buffalo.png`                                       | Tint colour.                                                                                                                                                                                                                                      |
| grayscale      | [Docs](https://sharp.pixelplumbing.com/api-colour#grayscale)    | `/grayscale/buffalo.png`                                         |                                                                                                                                                                                                                                                   |
| flatten        | [Docs](https://sharp.pixelplumbing.com/api-operation#flatten)   | `/flatten/buffalo.png`                                           | Remove alpha channel, if any, and replace with the `background` / `b` colour.                                                                                                                                                                     |
| modulate       | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/modulate_2_1.2_90_10/buffalo.png`                              | Transforms the image using `{brightness}_{saturation}_{hue}_{lightness}`. `brightness` and `saturation` are numbers `>= 0`, `hue` is an integer in degrees. Each is also available on its own (below), which is easier to read when only one is needed. |
| brightness     | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/brightness_1.25/buffalo.png`                                   | Brightness multiplier, a number `>= 0`. Required.                                                                                                                                                                                                 |
| saturation     | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/saturation_0.5/buffalo.png`                                    | Saturation multiplier, a number `>= 0`. Required.                                                                                                                                                                                                 |
| hue            | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/hue_90/buffalo.png`                                            | Hue rotation, an integer in degrees. Required.                                                                                                                                                                                                    |
| lightness      | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/lightness_10/buffalo.png`                                      | Lightness addend, a number. Required.                                                                                                                                                                                                             |
| opacity        | \_                                                              | `/opacity_0.75/buffalo.png`                                      | Opacity, a number between `0` and `1`. Required. The image is made transparent, so the output format needs an alpha channel (`png`, `webp`, `avif`). Set the `background` / `b` colour to blend into it instead and keep the output opaque, e.g. `/opacity_0.75,b_fff,f_jpeg/`. |
| animated / a   | -                                                               | `/animated/buffalo.gif` or `/a/buffalo.gif`                      | Experimental                                                                                                                                                                                                                                      |

## SVG Images

SVG images are not processed by sharp. They are sanitized, optimized with [svgo](https://github.com/svg/svgo) and served as `image/svg+xml`. Input that is not well-formed XML (an unescaped `&` is a common cause) is rejected with a `400 IPX_INVALID_SVG`.

```ts
createIPX({
  storage,
  svg: {
    // SVGO config, or `false` to disable optimization
    optimize: { multipass: true },
    // Serve SVG images unsanitized. Only for fully trusted sources!
    unsafeSkipSanitize: false,
  },
});
```

### Optimization

SVGO's `preset-default` is applied unless you configure `plugins` yourself. Output is always a re-serialized document, never byte-identical to the source: ids are renamed, elements that are neither visible nor referenced within the same file are dropped, shapes are converted to paths and `<style>` rules are inlined.

That is fine for images used as `<img src>` or as CSS backgrounds, but it can break consumers that reach into the document:

- Sprite sheets: a `<symbol id="icon">` with no `<use>` in the same file is removed, so `<use href="/sprite.svg#icon">` renders nothing.
- References by id from outside the file, since ids are renamed (`icon-home` becomes `a`).
- Selectors in a host page that inlines the SVG, since `<rect>` becomes `<path>` and class-based rules are inlined.

Use `svg: { optimize: false }` to sanitize without optimizing, or keep optimization with the structural plugins disabled (about 1% larger output for typical icons):

```ts
createIPX({
  storage,
  svg: {
    optimize: {
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: { cleanupIds: false, removeHiddenElems: false },
          },
        },
      ],
    },
  },
});
```

### Sanitization

SVG documents can carry active content, so IPX **always** sanitizes them before serving. Sanitization is independent of optimization: `svg: { optimize: false }` only disables SVGO's optimization plugins.

Removed from every SVG:

- `<script>` elements (including namespaced ones such as `<svg:script>`)
- Event handler attributes (any `on*` attribute)
- Embedded foreign documents: `<foreignObject>`, `<iframe>`, `<embed>`, `<object>`, `<base>`, `<link>` and `<meta>`
- Event handler elements: `<handler>` and `<listener>`
- SMIL animations (`<animate>`, `<animateMotion>`, `<animateTransform>` and `<set>`) that assign an `on*` attribute or an unsafe URI, which could otherwise re-introduce a handler after load
- URIs (`href`, `xlink:href` and `src`) with a scheme other than `http:`, `https:`, `mailto:`, `tel:`, `ftp:` or a non-SVG `data:image/*` — in particular `javascript:`, including obfuscated variants using entities or control characters
- The `<!DOCTYPE>` declaration and all processing instructions (`<?…?>`), which are serialized unescaped and can smuggle markup past an HTML parser

**External references are kept.** Attributes such as `<image href="https://…">`, `<use href="…">`, external fonts and `@import` inside `<style>` are preserved, since stripping them would break legitimate images. They are not a script execution vector, but they do allow the SVG to make requests to third-party origins (and thereby leak the viewer's IP address) when rendered as a document. If this matters for your threat model, host such images from a separate origin or block the requests with a Content-Security-Policy.

The bundled server sends `content-security-policy: default-src 'none'` with successful responses by default, which blocks both script execution and external references in browsers that honor it. Custom servers built on the programmatic API should send the same header, since sanitization cannot cover every future browser behavior on its own.

Sanitization can be disabled with `svg: { unsafeSkipSanitize: true }`. Only do this when every source is fully trusted: IPX will then serve SVG images with XSS payloads unchanged.

## License

[MIT](./LICENSE)
