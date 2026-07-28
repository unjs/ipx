# 🖼️ IPX

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/ipx?color=yellow)](https://npmjs.com/package/ipx)
[![npm downloads](https://img.shields.io/npm/dm/ipx?color=yellow)](https://npm.chart.dev/ipx)

<!-- /automd -->

High performance, secure and easy-to-use image optimizer powered by [sharp](https://github.com/lovell/sharp) and [svgo](https://github.com/svg/svgo).

Point IPX at a directory or a list of allowed domains, and every image is available in any size, format and quality straight from its URL:

```
/w_512,f_webp/photos/buffalo.png
```

Used by [Nuxt Image](https://image.nuxt.com/) and [Netlify](https://www.npmjs.com/package/@netlify/ipx) and open to everyone!

> [!NOTE]
> This is the active development branch for IPX v4. Check out [v3](https://github.com/unjs/ipx/tree/v3) for v3 docs, and [Migration from v3 to v4](#migration-from-v3-to-v4) if you are upgrading.

## Quick Start

Start a server for the images in the current directory with the `ipx` command:

```bash
npx ipx serve --dir ./
```

Using `bun`:

```bash
bunx ipx serve --dir ./
```

Then open the printed URL and add modifiers to any image path, for example `http://localhost:3000/w_200/buffalo.png`.

To embed IPX in your own app instead, see the [Programmatic API](#programmatic-api).

## Image URLs

A request URL is a list of modifiers, followed by the id of the source image:

```
/<modifiers>/<id>
```

Multiple modifiers are separated by `,` and their arguments by `_`. Use `_` alone when no modifier is needed.

| URL                                                | Result                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/_/static/buffalo.png`                            | The original image.                                                                         |
| `/w_200/static/buffalo.png`                        | Width set to `200`, original format (`png`) kept.                                           |
| `/f_webp/static/buffalo.png`                       | Format changed to `webp`, everything else kept as in the source.                            |
| `/f_auto/static/buffalo.png`                       | Best format for the client (avif/webp/jpeg), negotiated from the browser's `accept` header. |
| `/s_200x200,fit_contain,f_webp/static/buffalo.png` | Resized to fit inside `200x200px` on a background canvas and converted to `webp`.           |

The URL style is configurable, see [Custom URL Style](#custom-url-style).

## Modifiers

Modifier arguments are separated with `_` and validated before they reach sharp. Invalid input is rejected with a `400 IPX_INVALID_MODIFIER_ARG` (or `400 IPX_MISSING_MODIFIER_ARG` for a required argument) instead of failing the request. Some arguments can only be validated by libvips once it runs, which happens after the whole pipeline is set up; those surface as a `400 IPX_INVALID_MODIFIER`. Trailing arguments may be omitted to keep the sharp default, except where noted.

Colours (`background`, `tint`) accept any colour sharp understands: hex (`f00`, `ff0000`, `ff000080`) with an optional leading `#` — which cannot be used inside a URL path, so it may be dropped — or a CSS colour name (`red`). Boolean arguments accept `true` / `false` as well as the shorter `1` / `0`.

<!-- automd:ipx-operations -->

<table>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/width.jpg" alt="/w_160/sample.jpg"></div>
<div align="center"><b><code>width</code> / <code>w</code></b></div>
<code>/w_160/sample.jpg</code>
<br>
Positive integer. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/height.jpg" alt="/h_120/sample.jpg"></div>
<div align="center"><b><code>height</code> / <code>h</code></b></div>
<code>/h_120/sample.jpg</code>
<br>
Positive integer. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/resize.jpg" alt="/s_200x200/sample.jpg"></div>
<div align="center"><b><code>resize</code> / <code>s</code></b></div>
<code>/s_200x200/sample.jpg</code>
<br>
<code>{width}x{height}</code> of positive integers. A single value (<code>s_200</code>) is a square. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/kernel.jpg" alt="/s_80x80,kernel_nearest/sample.jpg"></div>
<div align="center"><b><code>kernel</code></b></div>
<code>/s_80x80,kernel_nearest/sample.jpg</code>
<br>
Sets <code>kernel</code> option for <code>resize</code>. One of <code>nearest</code>, <code>linear</code>, <code>cubic</code>, <code>mitchell</code>, <code>lanczos2</code>, <code>lanczos3</code> (default), <code>mks2013</code> or <code>mks2021</code>. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/fit.jpg" alt="/s_200x200,fit_contain,b_00ff00/sample.jpg"></div>
<div align="center"><b><code>fit</code></b></div>
<code>/s_200x200,fit_contain,b_00ff00/sample.jpg</code>
<br>
Sets <code>fit</code> option for <code>resize</code>. One of <code>contain</code>, <code>cover</code> (default), <code>fill</code>, <code>inside</code> or <code>outside</code>. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/position.jpg" alt="/s_200x200,pos_top/sample.jpg"></div>
<div align="center"><b><code>position</code> / <code>pos</code></b></div>
<code>/s_200x200,pos_top/sample.jpg</code>
<br>
Sets <code>position</code> option for <code>resize</code>. A position (<code>top</code>, <code>right top</code>, <code>right</code>, <code>right bottom</code>, <code>bottom</code>, <code>left bottom</code>, <code>left</code>, <code>left top</code>), gravity (<code>north</code>, <code>northeast</code>, ..., <code>center</code>) or strategy (<code>entropy</code>, <code>attention</code>). Since <code>_</code> separates arguments, multi-word values use <code>-</code> (<code>pos_right-top</code>). The numeric gravity (<code>0</code>-<code>8</code>) and strategy (<code>16</code>-<code>17</code>) constants are also accepted. (<a href="https://sharp.pixelplumbing.com/api-resize#resize">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/extend.jpg" alt="/extend_20_40_20_40_mirror/sample.jpg"></div>
<div align="center"><b><code>extend</code></b></div>
<code>/extend_20_40_20_40_mirror/sample.jpg</code>
<br>
Extend / pad / extrude one or more edges of the image. Format: <code>extend_{top}_{right}_{bottom}_{left}_{extendWith}</code>. Edges are integers between <code>0</code> and <code>10000</code>. Optional <code>extendWith</code>: <code>background</code> (default), <code>copy</code>, <code>repeat</code> or <code>mirror</code>. When extending with <code>background</code>, the colour comes from the <code>background</code> / <code>b</code> modifier, e.g. <code>b_00ff00,extend_20_40_20_40</code>. (<a href="https://sharp.pixelplumbing.com/api-resize#extend">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/background.jpg" alt="/rotate_45,b_00ff00/sample.jpg"></div>
<div align="center"><b><code>background</code> / <code>b</code></b></div>
<code>/rotate_45,b_00ff00/sample.jpg</code>
<br>
Background colour used by <code>extend</code>, <code>rotate</code>, <code>flatten</code>, <code>opacity</code> and <code>resize</code> (with <code>fit_contain</code>).
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/extract.jpg" alt="/extract_60_20_180_140/sample.jpg"></div>
<div align="center"><b><code>extract</code> / <code>crop</code></b></div>
<code>/extract_60_20_180_140/sample.jpg</code>
<br>
Extract/crop a region of the image, as <code>extract_{left}_{top}_{width}_{height}</code>. All four arguments are required; <code>width</code> and <code>height</code> must be positive. (<a href="https://sharp.pixelplumbing.com/api-resize#extract">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/format.webp" alt="/f_webp/sample.jpg"></div>
<div align="center"><b><code>format</code> / <code>f</code></b></div>
<code>/f_webp/sample.jpg</code>
<br>
Supported formats: <code>jpg</code>, <code>jpeg</code>, <code>png</code>, <code>webp</code>, <code>avif</code>, <code>gif</code>, <code>heif</code>, <code>tiff</code> and <code>auto</code> (experimental, only with middleware). (<a href="https://sharp.pixelplumbing.com/api-output#toformat">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/quality.jpg" alt="/q_10/sample.jpg"></div>
<div align="center"><b><code>quality</code> / <code>q</code></b></div>
<code>/q_10/sample.jpg</code>
<br>
Integer between <code>1</code> and <code>100</code>.
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/rotate.jpg" alt="/rotate_45/sample.jpg"></div>
<div align="center"><b><code>rotate</code></b></div>
<code>/rotate_45/sample.jpg</code>
<br>
Angle in degrees, between <code>-3600</code> and <code>3600</code>. Angles that are not a multiple of <code>90</code> are filled with the <code>background</code> / <code>b</code> colour. Without an angle (<code>rotate</code>) the image is auto-oriented from its EXIF tag. (<a href="https://sharp.pixelplumbing.com/api-operation#rotate">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/enlarge.jpg" alt="/enlarge,s_400x400/sample.jpg"></div>
<div align="center"><b><code>enlarge</code></b></div>
<code>/enlarge,s_400x400/sample.jpg</code>
<br>
Allow the image to be upscaled. By default the returned image will never be larger than the source in any dimension, while preserving the requested aspect ratio.
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/flip.jpg" alt="/flip/sample.jpg"></div>
<div align="center"><b><code>flip</code></b></div>
<code>/flip/sample.jpg</code>
<br>
Mirror the image vertically. (<a href="https://sharp.pixelplumbing.com/api-operation#flip">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/flop.jpg" alt="/flop/sample.jpg"></div>
<div align="center"><b><code>flop</code></b></div>
<code>/flop/sample.jpg</code>
<br>
Mirror the image horizontally. (<a href="https://sharp.pixelplumbing.com/api-operation#flop">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/sharpen.jpg" alt="/sharpen_5/sample.jpg"></div>
<div align="center"><b><code>sharpen</code></b></div>
<code>/sharpen_5/sample.jpg</code>
<br>
<code>{sigma}_{flat}_{jagged}_{x1}_{y2}_{y3}</code>. <code>sigma</code> is between <code>0.000001</code> and <code>10</code>, the rest between <code>0</code> and <code>1000000</code>. Without arguments (<code>sharpen</code>) a mild sharpen is applied. (<a href="https://sharp.pixelplumbing.com/api-operation#sharpen">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/median.jpg" alt="/median_10/sample.jpg"></div>
<div align="center"><b><code>median</code></b></div>
<code>/median_10/sample.jpg</code>
<br>
Square mask size, an integer between <code>1</code> and <code>1000</code> (defaults to <code>3</code>). (<a href="https://sharp.pixelplumbing.com/api-operation#median">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/blur.jpg" alt="/blur_5/sample.jpg"></div>
<div align="center"><b><code>blur</code></b></div>
<code>/blur_5/sample.jpg</code>
<br>
<code>{sigma}_{precision}_{minAmplitude}</code>. <code>sigma</code> is a number between <code>0.3</code> and <code>1000</code>, <code>precision</code> one of <code>integer</code> (default), <code>float</code> or <code>approximate</code>, <code>minAmplitude</code> a number between <code>0.001</code> and <code>1</code>. Without arguments (<code>blur</code>) a mild blur is applied. (<a href="https://sharp.pixelplumbing.com/api-operation#blur">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/dilate.png" alt="/dilate_5/sample-logo.png"></div>
<div align="center"><b><code>dilate</code></b></div>
<code>/dilate_5/sample-logo.png</code>
<br>
Expand foreground objects. Width in pixels, an integer between <code>1</code> and <code>100</code> (defaults to <code>1</code>). Capped below the sharp maximum, since the cost grows with the width. (<a href="https://sharp.pixelplumbing.com/api-operation#dilate">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/erode.png" alt="/erode_5/sample-logo.png"></div>
<div align="center"><b><code>erode</code></b></div>
<code>/erode_5/sample-logo.png</code>
<br>
Shrink foreground objects. Width in pixels, an integer between <code>1</code> and <code>100</code> (defaults to <code>1</code>). Capped below the sharp maximum, since the cost grows with the width. (<a href="https://sharp.pixelplumbing.com/api-operation#erode">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/clahe.jpg" alt="/clahe_20_20_5/sample.jpg"></div>
<div align="center"><b><code>clahe</code></b></div>
<code>/clahe_20_20_5/sample.jpg</code>
<br>
Contrast limiting adaptive histogram equalization, as <code>{width}_{height}_{maxSlope}</code>. <code>width</code> is required and <code>height</code> defaults to it (a square window); both are integers between <code>1</code> and <code>100</code>, capped below the sharp maximum since the cost grows with the window, and clamped to the source dimensions. <code>maxSlope</code> is an integer between <code>0</code> and <code>100</code> (defaults to <code>3</code>). (<a href="https://sharp.pixelplumbing.com/api-operation#clahe">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/flatten.jpg" alt="/flatten,b_00ff00,f_jpeg/sample-alpha.png"></div>
<div align="center"><b><code>flatten</code></b></div>
<code>/flatten,b_00ff00,f_jpeg/sample-alpha.png</code>
<br>
Remove alpha channel, if any, and replace with the <code>background</code> / <code>b</code> colour. (<a href="https://sharp.pixelplumbing.com/api-operation#flatten">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/unflatten.webp" alt="/unflatten,f_webp/sample-logo.png"></div>
<div align="center"><b><code>unflatten</code></b></div>
<code>/unflatten,f_webp/sample-logo.png</code>
<br>
Make every fully white pixel transparent, so the output format needs an alpha channel (<code>png</code>, <code>webp</code>, <code>avif</code>). (<a href="https://sharp.pixelplumbing.com/api-operation#unflatten">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/gamma.jpg" alt="/gamma_3/sample.jpg"></div>
<div align="center"><b><code>gamma</code></b></div>
<code>/gamma_3/sample.jpg</code>
<br>
<code>{gamma}_{gammaOut}</code>, each a number between <code>1.0</code> and <code>3.0</code> (defaults to <code>2.2</code>). (<a href="https://sharp.pixelplumbing.com/api-operation#gamma">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/negate.jpg" alt="/negate/sample.jpg"></div>
<div align="center"><b><code>negate</code></b></div>
<code>/negate/sample.jpg</code>
<br>
Optional <code>{alpha}</code> (<code>true</code> by default) controls whether the alpha channel is negated too, e.g. <code>negate_false</code>. (<a href="https://sharp.pixelplumbing.com/api-operation#negate">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/normalize.jpg" alt="/normalize_10_90/sample.jpg"></div>
<div align="center"><b><code>normalize</code></b></div>
<code>/normalize_10_90/sample.jpg</code>
<br>
Stretch the luminance to the full dynamic range, as <code>{lower}_{upper}</code> percentiles. <code>lower</code> is a number between <code>0</code> and <code>99</code> (defaults to <code>1</code>), <code>upper</code> between <code>1</code> and <code>100</code> (defaults to <code>99</code>) and has to be greater than <code>lower</code>. (<a href="https://sharp.pixelplumbing.com/api-operation#normalize">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/threshold.jpg" alt="/threshold_128/sample.jpg"></div>
<div align="center"><b><code>threshold</code></b></div>
<code>/threshold_128/sample.jpg</code>
<br>
<code>{threshold}_{grayscale}</code>. <code>threshold</code> is an integer between <code>0</code> and <code>255</code> (defaults to <code>128</code>). Optional <code>grayscale</code> (<code>true</code> by default) converts to single channel grayscale first, e.g. <code>threshold_128_false</code>. (<a href="https://sharp.pixelplumbing.com/api-operation#threshold">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/linear.jpg" alt="/linear_1.5_-30/sample.jpg"></div>
<div align="center"><b><code>linear</code></b></div>
<code>/linear_1.5_-30/sample.jpg</code>
<br>
Levels adjustment applying <code>a * input + b</code>, as <code>{a}_{b}</code>. <code>a</code> is the multiplier (defaults to <code>1</code>), <code>b</code> the offset (defaults to <code>0</code>). (<a href="https://sharp.pixelplumbing.com/api-operation#linear">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/tint.jpg" alt="/tint_00ff00/sample.jpg"></div>
<div align="center"><b><code>tint</code></b></div>
<code>/tint_00ff00/sample.jpg</code>
<br>
Tint colour. (<a href="https://sharp.pixelplumbing.com/api-colour#tint">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/grayscale.jpg" alt="/grayscale/sample.jpg"></div>
<div align="center"><b><code>grayscale</code></b></div>
<code>/grayscale/sample.jpg</code>
<br>
Convert to 8-bit greyscale. (<a href="https://sharp.pixelplumbing.com/api-colour#grayscale">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/modulate.jpg" alt="/modulate_1.5_2_90_10/sample.jpg"></div>
<div align="center"><b><code>modulate</code></b></div>
<code>/modulate_1.5_2_90_10/sample.jpg</code>
<br>
Transforms the image using <code>{brightness}_{saturation}_{hue}_{lightness}</code>. <code>brightness</code> and <code>saturation</code> are numbers <code>&gt;= 0</code>, <code>hue</code> is an integer in degrees. Each is also available on its own (below), which is easier to read when only one is needed. (<a href="https://sharp.pixelplumbing.com/api-operation#modulate">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/brightness.jpg" alt="/brightness_1.5/sample.jpg"></div>
<div align="center"><b><code>brightness</code></b></div>
<code>/brightness_1.5/sample.jpg</code>
<br>
Brightness multiplier, a number <code>&gt;= 0</code>. Required. (<a href="https://sharp.pixelplumbing.com/api-operation#modulate">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/saturation.jpg" alt="/saturation_0.3/sample.jpg"></div>
<div align="center"><b><code>saturation</code></b></div>
<code>/saturation_0.3/sample.jpg</code>
<br>
Saturation multiplier, a number <code>&gt;= 0</code>. Required. (<a href="https://sharp.pixelplumbing.com/api-operation#modulate">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/hue.jpg" alt="/hue_90/sample.jpg"></div>
<div align="center"><b><code>hue</code></b></div>
<code>/hue_90/sample.jpg</code>
<br>
Hue rotation, an integer in degrees. Required. (<a href="https://sharp.pixelplumbing.com/api-operation#modulate">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/lightness.jpg" alt="/lightness_30/sample.jpg"></div>
<div align="center"><b><code>lightness</code></b></div>
<code>/lightness_30/sample.jpg</code>
<br>
Lightness addend, a number. Required. (<a href="https://sharp.pixelplumbing.com/api-operation#modulate">docs</a>)
</td>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/opacity.webp" alt="/opacity_0.5,f_webp/sample.jpg"></div>
<div align="center"><b><code>opacity</code></b></div>
<code>/opacity_0.5,f_webp/sample.jpg</code>
<br>
Opacity, a number between <code>0</code> and <code>1</code>. Required. The image is made transparent, so the output format needs an alpha channel (<code>png</code>, <code>webp</code>, <code>avif</code>). Set the <code>background</code> / <code>b</code> colour to blend into it instead and keep the output opaque, e.g. <code>opacity_0.5,b_fff,f_jpeg</code>.
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><img src="./assets/operations/animated.gif" alt="/a,w_160/sample.gif"></div>
<div align="center"><b><code>animated</code> / <code>a</code></b></div>
<code>/a,w_160/sample.gif</code>
<br>
Process every frame of an animated image. Experimental.
</td>
<td valign="top" width="50%">
<div align="center"><em>No sample: the sample source has no uniform border to trim.</em></div>
<div align="center"><b><code>trim</code></b></div>
<code>/trim_30/sample.jpg</code>
<br>
Trim pixels from the edges that are within the threshold of the top-left pixel colour. Threshold is a number <code>&gt;= 0</code> (defaults to <code>10</code>). (<a href="https://sharp.pixelplumbing.com/api-resize#trim">docs</a>)
</td>
</tr>
<tr>
<td valign="top" width="50%">
<div align="center"><em>No sample: the sample source carries no EXIF <code>Orientation</code> tag.</em></div>
<div align="center"><b><code>autoorient</code></b></div>
<code>/autoorient/sample.jpg</code>
<br>
Rotate and flip the image based on its EXIF <code>Orientation</code> tag, then remove the tag. (<a href="https://sharp.pixelplumbing.com/api-operation#autoorient">docs</a>)
</td>
<td valign="top" width="50%"></td>
</tr>
</table>

<!-- /automd -->

## Programmatic API

Create an IPX instance with `createIPX()`, then either serve it directly or mount it as a handler in your own app.

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

## Config

Every option can also be set universally with an `IPX_*` environment variable, which is how the CLI is configured. Explicit options win over the environment.

### General

| Option               | Environment variable       | Default | Description                                               |
| -------------------- | -------------------------- | ------- | --------------------------------------------------------- |
| `alias`              | `IPX_ALIAS`                | `{}`    | Map URL prefixes to other prefixes or remote origins.     |
| `maxOutputDimension` | `IPX_MAX_OUTPUT_DIMENSION` | `8192`  | Maximum width and height (in pixels) of the output image. |

Requested `width`, `height` and `resize` dimensions are clamped to `maxOutputDimension`, preserving the requested aspect ratio, and `extend` edges are clamped so the extended canvas stays within it. This bounds how much memory a single request can allocate: sharp only limits the _input_ size, so without it `/enlarge,s_20000x20000/image.jpg` (or `/extend_10000_10000_10000_10000/image.jpg`) allocates gigabytes from a small source image. Set to `false` to disable, which is only safe when modifiers come from a trusted source.

### Filesystem source (`ipxFSStorage`)

Enabled by default with the CLI only.

| Option                    | Environment variable                | Default                 | Description                                            |
| ------------------------- | ----------------------------------- | ----------------------- | ------------------------------------------------------ |
| `dir`                     | `IPX_FS_DIR`                        | `.` (current directory) | Directory (or directories) files are served from.      |
| `maxAge`                  | `IPX_FS_MAX_AGE`                    | `60` (via `maxAge`)     | `cache-control` max-age, in seconds, for served files. |
| `allowSymlinksOutsideDir` | `IPX_FS_ALLOW_SYMLINKS_OUTSIDE_DIR` | `false`                 | Allows symlinks inside `dir` to resolve outside of it. |

### HTTP(s) source (`ipxHttpStorage`)

Enabled by default with the CLI only.

| Option            | Environment variable         | Default | Description                                                     |
| ----------------- | ---------------------------- | ------- | --------------------------------------------------------------- |
| `domains`         | `IPX_HTTP_DOMAINS`           | `[]`    | Allowlist of hostnames images can be fetched from.              |
| `maxAge`          | `IPX_HTTP_MAX_AGE`           | `300`   |                                                                 |
| `fetchOptions`    | `IPX_HTTP_FETCH_OPTIONS`     | `{}`    | Passed to `fetch()`.                                            |
| `allowAllDomains` | `IPX_HTTP_ALLOW_ALL_DOMAINS` | `false` | Disables the allowlist. Unsafe on a public server.              |
| `blockPrivateIPs` | `IPX_HTTP_BLOCK_PRIVATE_IPS` | `false` | Rejects hosts that are, or resolve to, a non-public IP address. |

Only `http:` and `https:` URLs are allowed (anything else is rejected with `403 IPX_FORBIDDEN_PROTOCOL`), and redirects are followed **only within the allowlist**, up to 3 hops: each redirect target is re-validated and a redirect to a host that is not listed is rejected with `403 IPX_FORBIDDEN_HOST` (`502 IPX_TOO_MANY_REDIRECTS` beyond 3 hops). Previously redirects were followed blindly, which let an allowlisted host with an open redirect bounce IPX to internal addresses such as the cloud metadata service (SSRF). If an allowlisted host redirects to a CDN, add the CDN hostname to the allowlist as well. Redirect re-validation is skipped when `allowAllDomains` is enabled without `blockPrivateIPs` (nothing to validate) or when `redirect` is explicitly set in `fetchOptions`.

#### Blocking private IP addresses

The allowlist matches hostnames, not addresses, so an allowlisted host whose DNS record points at `127.0.0.1`, `169.254.169.254` or an RFC1918 address is fetched like any other. That is intended — allowlisted domains are trusted — but `blockPrivateIPs: true` adds a second line of defense for setups where the allowlist is broad (or `allowAllDomains` is on):

```ts
ipxHttpStorage({ domains: ["cdn.example.com"], blockPrivateIPs: true });
```

The host of the requested URL **and of every redirect hop** must be a public address. IP literals are checked directly, hostnames are resolved with the OS resolver (`dns.lookup`, so `/etc/hosts` counts) and _all_ returned addresses must be public. Loopback, `0.0.0.0/8`, RFC1918, CGNAT (`100.64.0.0/10`), link-local (`169.254.0.0/16`, `fe80::/10`), unique-local (`fc00::/7`), multicast, reserved/test ranges and the IPv4-mapped/compatible IPv6 forms of all of them (`::ffff:127.0.0.1` and friends) are rejected with `403 IPX_FORBIDDEN_IP`. A host that cannot be resolved is a `502 IPX_DNS_LOOKUP_FAILED`, and a runtime without `node:net`/`node:dns` a `500 IPX_IP_CHECK_UNAVAILABLE` — the check fails closed rather than quietly turning itself off.

It is **off by default**: many deployments legitimately fetch from in-cluster origins (internal object storage, a sidecar, `localhost` in development), and enabling it by default would break them.

Two limits to be aware of. It does not close the DNS-rebinding window: the name is resolved again when the socket is opened, so a record with a very short TTL can answer with a public address during validation and a private one during the fetch. Closing that requires pinning the validated address on the connection itself, which the plain `fetch` used here does not expose. And it is not a substitute for the allowlist — a public address that happens to be reachable is still fetched.

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

## Migration from v3 to v4

- The server creation APIs have changed. See the [Programmatic API](#programmatic-api) section for examples.
- The JSON error format has changed from `{ error: string }` to `{ status, statusText, message }`.
- The `svgo` option is now `svg.optimize`. SVG images are always sanitized, even when optimization is disabled.
- SVG optimization now applies SVGO's `preset-default` unless custom `plugins` are configured (previously only the configured plugins ran), so SVG output is restructured more than before. See the [SVG Images](#svg-images) section.

## License

[MIT](./LICENSE)
