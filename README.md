<div align="center">
<img src="./logo.png" alt="IPX Logo" />
</div>

[![Docker Pulls](https://flat.badgen.net/docker/pulls/pooya/ipx)](https://hub.docker.com/r/pooya/ipx)
[![NPM Vernion](https://flat.badgen.net/npm/v/ipx)](https://www.npmjs.com/package/ipx)
[![NPM Downloads](https://flat.badgen.net/npm/dt/ipx)](https://www.npmjs.com/package/ipx)
[![Package Size](https://flat.badgen.net/packagephobia/install/ipx)](https://packagephobia.now.sh/result?p=ipx)

High performance, secure and easy to use image proxy based on [sharp](https://github.com/lovell/sharp) and [libvips](https://github.com/jcupitt/libvips).

- Easy deployment
- Configurable operations
- Built-in secure cache with human readable entries and resistant against duplicates
- Adapter based cache and input
- Auto cache cleaner
- Twelve factor friendly
- Client SDK for URL generation

<h2 align="center">Usage</h2>

### Using NPM package

You can use `ipx` command to start server using:

```bash
$ npx ipx
```

### Docker Image

Latest docker image is automatically built under [pooya/ipx](https://hub.docker.com/r/pooya/ipx).

Run a test server:

```bash
docker run \
  -it \
  --rm \
  --volume ./storage:/app/storage:ro \
  --volume ./cache:/app/cache \
  --port 3000:3000
  pooya/ipx
```

Using docker-compose:

```yml
version: '3'
services:
  ipx:
    image: pooya/ipx
    volumes:
      - ./storage:/app/storage:ro
      - ./cache:/app/cache
    ports:
      - 3000:3000
```


### Programatic Usage

You can use IPX as a Connect/Express middleware or directly use IPX class.

```js
import { IPX, IPXMiddleware } from 'ipx'

const ipx = new IPX(/* options */)

const app = express()
app.use('/image', IPXMiddleware(ipx))
```

<h2 align="center">API</h2>

**`/{format}/{operations}/{src}`**

Operations are separated by a colon `,` (Example: `op1,op2`) and their arguments separated using underscore `_` (Example: `s_200_300`)

ََ‍‍Use `_` value in place for `{format}` or `{operations}` to keep original values of source image.

Possible values for format: `jpeg`,`webp` or `png`.

### Examples

Just change format to `webp` and keep other things same as source:

`http://cdn.example.com/webp/_/avatars/buffalo.png`

Keep original format (`png`) and set width to `200`:

`http://cdn.example.com/_/w_200/avatars/buffalo.png`

Resize to `200x300px` using `embed` method and change format to `jpg`:

`http://cdn.example.com/jpg/s_200_300,embed/avatars/buffalo.png`


<h2 align="center">Operations</h2>

Operation    |  Arguments            | Example     | Description
-------------|-----------------------|-------------|---------------------------------------------------------
`s`          | `width`, `height`     | s_200_300   | Resize image.
`w`          | `width`               | w_200       | Change image with.
`h`          | `height`              | h_200       | Change image height.
`embed`      | -                     | embed       | Preserving aspect ratio, resize the image to the maximum `width` or `height` specified then embed on a background of the exact `width` and `height` specified.
`max`        | -                     | max         | Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to the `width` and `height` specified.
`min`        | -                     | min         | Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to the width and height specified.

<h2 align="center">Config</h2>

Config can be customized using `IPX_*` environment variables.

- `IPX_PORT` (or `PORT`)
  Default: `3000`

- `IPX_INPUT_ADAPTER`
  - Default: `fs`

- `IPX_INPUT_DIR`
  - Default: `storage`

- `IPX_CACHE_ADAPTER`
  - Default: `fs`

- `IPX_CACHE_DIR`
  - Default: `cache`

- `IPX_CACHE_CLEAN_CRON`
  - Default: `0 0 3 * * *` (every night at 3:00 AM)

- `IPX_CACHE_CLEAN_MINUTES`
  - Default: `24 * 60` (24 hours)

## Client

Import client:

```js
import { img } from 'ipx/client'

const { img } = require('ipx/client')
```

`img()` is a factory function to configure base options:

```js
// getImage: (path, opts?, format?) => URL
const getImage = img({
  baseURL = 'https://cdn.example.com',
  basePath = 'uploads',
  opts = [], // Default opts
  format = 'jpg',
  presets: {
    chrome400: {
      format: 'webp',
      opts: { s: ['400', '400']}
    }
  }
})

getImage('posts/ipx.png', { w: 200 }) // => https://cdn.example.com/jpg/w_200/uploads/posts/ipx.png

getImage.chrome400('posts/ipx.png') // => https://cdn.example.com/webp/s_400_400/uploads/posts/ipx.png
```


<h2 align="center">License</h2>

MIT - Pooya Parsa
