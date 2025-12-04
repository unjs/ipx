# 🖼️ IPX

<!-- automd:badges -->

[![npm version](https://img.shields.io/npm/v/ipx)](https://npmjs.com/package/ipx)
[![npm downloads](https://img.shields.io/npm/dm/ipx)](https://npm.chart.dev/ipx)

<!-- /automd -->

> [!NOTE]
> This is the active development branch for IPX v3. Check out [v3](https://github.com/unjs/ipx/tree/v3) for older docs.

High performance, secure and easy-to-use image optimizer powered by [sharp](https://github.com/lovell/sharp) and [svgo](https://github.com/svg/svgo).

Used by [Nuxt Image](https://image.nuxt.com/) and [Netlify](https://www.npmjs.com/package/@netlify/ipx) and open to everyone!

## Using CLI

You can use `ipx` command to start server.

Using `npx`:

```bash
npx ipx serve --dir ./
```

Using `bun`

```bash
bun x npx ipx serve --dir ./
```

The default serve directory is the current working directory.

## Programmatic API

You can use IPX as a middleware or directly use IPX interface.

```ts
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
```

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

**Example:** Using with [express](https://expressjs.com):

<!-- automd:file code src="./examples/express.ts" -->

```ts [express.ts]
import Express from "express";

import {
  createIPX,
  ipxFSStorage,
  ipxHttpStorage,
  createIPXNodeHandler,
} from "ipx";

const ipx = createIPX({
  storage: ipxFSStorage({ dir: "./public" }),
  httpStorage: ipxHttpStorage({ domains: ["picsum.photos"] }),
  alias: { "/picsum": "https://picsum.photos" },
});

const app = Express();

app.use("/ipx", createIPXNodeHandler(ipx));

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

## Config

You can universally customize IPX configuration using `IPX_*` environment variables.

- `IPX_ALIAS`
  - Default: `{}`

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

#### `IPX_HTTP_MAX_AGE`

- Default: `300`

#### `IPX_HTTP_FETCH_OPTIONS`

- Default: `{}`

#### `IPX_HTTP_ALLOW_ALL_DOMAINS`

- Default: `false`

## Modifiers

| Property       | Docs                                                            | Example                                              | Comments                                                                                                                                                          |
| -------------- | :-------------------------------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| width / w      | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/width_200/buffalo.png` or `/w_200/buffalo.png`     |
| height / h     | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/height_200/buffalo.png` or `/h_200/buffalo.png`    |
| resize / s     | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200/buffalo.png`                             |
| kernel         | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,kernel_nearest/buffalo.png`              | Supported kernel: `nearest`, `cubic`, `mitchell`, `lanczos2` and `lanczos3` (default).                                                                            |
| fit            | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,fit_outside/buffalo.png`                 | Sets `fit` option for `resize`.                                                                                                                                   |
| position / pos | [Docs](https://sharp.pixelplumbing.com/api-resize#resize)       | `/s_200x200,pos_top/buffalo.png`                     | Sets `position` option for `resize`.                                                                                                                              |
| trim           | [Docs](https://sharp.pixelplumbing.com/api-resize#trim)         | `/trim_100/buffalo.png`                              |
| extend         | [Docs](https://sharp.pixelplumbing.com/api-resize#extend)       | `/extend_{top}_{right}_{bottom}_{left}/buffalo.png`  | Extend / pad / extrude one or more edges of the image with either the provided background colour or pixels derived from the image.                                |
| background / b | \_                                                              | `/r_45,b_00ff00/buffalo.png`                         |
| extract        | [Docs](https://sharp.pixelplumbing.com/api-resize#extract)      | `/extract_{left}_{top}_{width}_{height}/buffalo.png` | Extract/crop a region of the image.                                                                                                                               |
| crop           | [Docs](https://sharp.pixelplumbing.com/api-resize#extract)      | `/crop_{left}_{top}_{width}_{height}/buffalo.png`    | Alias for extract. Extract/crop a region of the image.                                                                                                            |
| format / f     | [Docs](https://sharp.pixelplumbing.com/api-output#toformat)     | `/format_webp/buffalo.png` or `/f_webp/buffalo.png`  | Supported format: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `heif`, `tiff` and `auto` (experimental only with middleware)                                      |
| quality / q    | \_                                                              | `/quality_50/buffalo.png` or `/q_50/buffalo.png`     | Accepted values: 0 to 100                                                                                                                                         |
| rotate         | [Docs](https://sharp.pixelplumbing.com/api-operation#rotate)    | `/rotate_45/buffalo.png`                             |
| enlarge        | \_                                                              | `/enlarge,s_2000x2000/buffalo.png`                   | Allow the image to be upscaled. By default the returned image will never be larger than the source in any dimension, while preserving the requested aspect ratio. |
| flip           | [Docs](https://sharp.pixelplumbing.com/api-operation#flip)      | `/flip/buffalo.png`                                  |
| flop           | [Docs](https://sharp.pixelplumbing.com/api-operation#flop)      | `/flop/buffalo.png`                                  |
| sharpen        | [Docs](https://sharp.pixelplumbing.com/api-operation#sharpen)   | `/sharpen_30/buffalo.png`                            |
| median         | [Docs](https://sharp.pixelplumbing.com/api-operation#median)    | `/median_10/buffalo.png`                             |
| blur           | [Docs](https://sharp.pixelplumbing.com/api-operation#blur)      | `/blur_5/buffalo.png`                                |
| gamma          | [Docs](https://sharp.pixelplumbing.com/api-operation#gamma)     | `/gamma_3/buffalo.png`                               |
| negate         | [Docs](https://sharp.pixelplumbing.com/api-operation#negate)    | `/negate/buffalo.png`                                |
| normalize      | [Docs](https://sharp.pixelplumbing.com/api-operation#normalize) | `/normalize/buffalo.png`                             |
| threshold      | [Docs](https://sharp.pixelplumbing.com/api-operation#threshold) | `/threshold_10/buffalo.png`                          |
| tint           | [Docs](https://sharp.pixelplumbing.com/api-colour#tint)         | `/tint_1098123/buffalo.png`                          |
| grayscale      | [Docs](https://sharp.pixelplumbing.com/api-colour#grayscale)    | `/grayscale/buffalo.png`                             |
| flatten        | [Docs](https://sharp.pixelplumbing.com/api-operation#flatten)   | `/flatten/buffalo.png`                               | Remove alpha channel, if any, and replace with background colour.                                                                                                 |
| modulate       | [Docs](https://sharp.pixelplumbing.com/api-operation#modulate)  | `/modulate_brightness_saturation_hue/buffalo.png`    | Transforms the image using brightness, saturation and hue rotation.                                                                                               |
| crop           | [Docs](https://sharp.pixelplumbing.com/api-resize#extract)      | `/crop_{left}_{top}_{width}_{height}/buffalo.png`    | Alias for extract. Extract/crop a region of the image.                                                                                                            |
| animated / a   | -                                                               | `/animated/buffalo.gif` or `/a/buffalo.gif`          | Experimental                                                                                                                                                      |

## License

[MIT](./LICENSE)
