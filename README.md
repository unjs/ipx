# IPX

[![NPM Vernion](https://flat.badgen.net/npm/v/ipx)](https://www.npmjs.com/package/ipx)
[![NPM Downloads](https://flat.badgen.net/npm/dt/ipx)](https://www.npmjs.com/package/ipx)
[![Package Size](https://flat.badgen.net/packagephobia/install/ipx)](https://packagephobia.now.sh/result?p=ipx)

High performance, secure and easy to use image proxy based on [sharp](https://github.com/lovell/sharp) and [libvips](https://github.com/libvips/libvips).

<h2 align="center">Usage</h2>

### Quick Start

You can use `ipx` command to start server using:

```bash
$ npx ipx
```

The default server directory is the current working directory.

### Programatic Usage

You can use IPX as a Connect/Express middleware or directly use ipx api.

```js
import { createIPX, createIPXMiddleware } from "ipx";

const ipx = createIPX(/* options */);
const app = express();
app.use("/image", createIPXMiddleware(ipx));
```

### Examples

> The examples assume that a `static` folder with `buffalo.png` file is present in the directory where IPX server is running.

Change format to `webp` and keep other things same as source:

`http://localhost:3000/static/buffalo.png?format=webp`

Keep original format (`png`) and set width to `200`:

`http://localhost:3000/static/buffalo.png?width=200`

Resize to `200px` using `embed` method and change format to `webp`:

`http://localhost:3000/static/buffalo.png?embed&format=webp&resize=200`

### Modifiers

| Property  | Reference                                                      | Example                                          | Comments                                                |
| --------- | :------------------------------------------------------------- | :----------------------------------------------- | :------------------------------------------------------ |
| width     | \_                                                             | `http://localhost:3000/buffalo.png?width=200`    |
| height    | \_                                                             | `http://localhost:3000/buffalo.png?height=200`   |
| trim      | [Ref](https://sharp.pixelplumbing.com/api-resize#trim)         | `http://localhost:3000/buffalo.png?trim=100`     |
| format    | [Ref](https://sharp.pixelplumbing.com/api-output#toformat)     | `http://localhost:3000/buffalo.png?format=webp`  | Supported format: jpg, jpeg, png, webp, avif, gif, heif |
| quality   | \_                                                             | `http://localhost:3000/buffalo.png?quality=50`   | Accepted values: 0 to 100                               |
| rotate    | [Ref](https://sharp.pixelplumbing.com/api-operation#rotate)    | `http://localhost:3000/buffalo.png?rotate=45`    |
| flip      | [Ref](https://sharp.pixelplumbing.com/api-operation#flip)      | `http://localhost:3000/buffalo.png?flip`         |
| flop      | [Ref](https://sharp.pixelplumbing.com/api-operation#flop)      | `http://localhost:3000/buffalo.png?flop`         |
| sharpen   | [Ref](https://sharp.pixelplumbing.com/api-operation#sharpen)   | `http://localhost:3000/buffalo.png?sharpen=30`   |
| median    | [Ref](https://sharp.pixelplumbing.com/api-operation#median)    | `http://localhost:3000/buffalo.png?median=10`    |
| gamma     | [Ref](https://sharp.pixelplumbing.com/api-operation#gamma)     | `http://localhost:3000/buffalo.png?gamma=3`      |
| negate    | [Ref](https://sharp.pixelplumbing.com/api-operation#negate)    | `http://localhost:3000/buffalo.png?negate`       |
| normalize | [Ref](https://sharp.pixelplumbing.com/api-operation#normalize) | `http://localhost:3000/buffalo.png?normalize`    |
| threshold | [Ref](https://sharp.pixelplumbing.com/api-operation#threshold) | `http://localhost:3000/buffalo.png?threshold=10` |
| tint      | [Ref](https://sharp.pixelplumbing.com/api-colour#tint)         | `http://localhost:3000/buffalo.png?tint=1098123` |
| grayscale | [Ref](https://sharp.pixelplumbing.com/api-colour#grayscale)    | `http://localhost:3000/buffalo.png?grayscale`    |
| animated  | -                                                              | `http://localhost:3000/buffalo.gif?animated`     | Experimental                                            |

### Config

Config can be customized using `IPX_*` environment variables.

- `IPX_DIR`

  - Default: `.` (current working directory)

- `IPX_DOMAINS`
  - Default: `[]`

<h2 align="center">License</h2>

MIT
