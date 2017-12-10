# 🖼 IPX

High performance, secure and easy to use image proxy based on [Sharp](https://github.com/lovell/sharp) and [libvips](https://github.com/jcupitt/libvips).

**WARNING:: THIS PROJECT AND DOCS ARE STILL WIP!**

## Project goals

- Fast and minimal as possible.
- Configurable operations.
- Built-in secure cache with human readable entries and resistant against duplicates.
- Remote agnostic cache and input adapters.
- Smart and auto cache cleaning.
- Twelve factor friendly.

## API

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


## Operations

Operation    |  Arguments            | Example     | Description
-------------|-----------------------|-------------|---------------------------------------------------------
`s`          | `width`, `height`     | s:200:300   | Resize image.
`w`          | `width`               | w:200       | Change image with.
`h`          | `height`              | h:200       | Change image height.
`embed`      | -                     | embed       | Preserving aspect ratio, resize the image to the maximum `width` or `height` specified then embed on a background of the exact `width` and `height` specified.
`max`        | -                     | max         | Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to the `width` and `height` specified.
`min`        | -                     | min         | Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to the width and height specified.

## Config

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

## License

MIT - Pooya Parsa
