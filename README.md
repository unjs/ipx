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

### Programatic Usage

You can use IPX as a Connect/Express middleware or directly use ipx api.

```js
import { createIPX, createIPXMiddleware } from 'ipx'

const ipx = createIPX(/* options */)
const app = express()
app.use('/image', createIPXMiddleware(ipx))
```

### Examples

Change format to `webp` and keep other things same as source:

`http://cdn.example.com/static/buffalo.png?format=webp`

Keep original format (`png`) and set width to `200`:

`http://cdn.example.com/static/buffalo.png?width=200`

Resize to `200x300px` using `embed` method and change format to `webp`:

`http://cdn.example.com/static/buffalo.png?embed&format=webp&size=200x300`


<h2 align="center">Config</h2>

Config can be customized using `IPX_*` environment variables.

- `IPX_DIR`
  - Default: `.` (current working directory)

- `IPX_DOMAINS`
  - Default: `[]`

<h2 align="center">License</h2>

MIT
