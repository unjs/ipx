<div align="center">
<img src="./logo.png" alt="IPX Logo" />
</div>

[![Docker Pulls](https://img.shields.io/docker/pulls/pooya/ipx.svg?style=flat-square)]()
[![Docker Automated build](https://img.shields.io/docker/automated/pooya/ipx.svg?style=flat-square)]()
[![Docker Build Status](https://img.shields.io/docker/build/pooya/ipx.svg?style=flat-square)]()

> High performance, secure and easy to use image proxy based on [Sharp](https://github.com/lovell/sharp) and [libvips](https://github.com/jcupitt/libvips).

✅ Fast and minimal as possible.    
✅ Easy deployment.    
✅ Configurable operations.    
✅ Built-in secure cache with human readable entries and resistant against duplicates.    
✅ Remote agnostic cache and input adapters.    
✅ Smart and auto cache cleaning.    
✅ Twelve factor friendly.    
✅ Client libraries for URL generation.    

<h2 align="center">Clients</h2>

- [JS Client](./client/js/README.md) for Node.js and Browser.

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

<h2 align="center">Docker deployment</h2>

Latest docker image is automatically built under [pooya/ipx](https://hub.docker.com/r/pooya/ipx).

Quick start:

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
  image: pooya/ipx
  volumes:
    - ./storage:/app/storage:ro
    - ./cache:/app/cache
  ports:
    - 3000:3000
```

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

Config can be customized using `IPX_*` environment variables or `config/local.js` file. Here are defaults:

```js
  ipx: {
    input: {
      adapter: 'IPX_INPUT_ADAPTER', // Default: fs.js
      dir: 'IPX_INPUT_DIR' // Default: storage
    },
    cache: {
      adapter: 'IPX_CACHE_ADAPTER', // Default: fs.js
      dir: 'IPX_CACHE_DIR', // Default: cache
      cleanCron: 'IPX_CACHE_CLEAN_CRON', // Default: 0 0 3 * * * (every night at 3:00 AM)
      maxUnusedMinutes: 'IPX_CACHE_CLEAN_MINUTES' // Default: 24 * 60 (24 hours)
    }
  }
```

<h2 align="center">License</h2>

MIT - Pooya Parsa
