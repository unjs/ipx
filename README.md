# 🖼 IPX

High performance, secure and easy to use and image proxy based on [Sharp](https://github.com/lovell/sharp) and [libvips](https://github.com/jcupitt/libvips).

**WARNING:: THIS PROJECT AND DOCS ARE STILL WIP!**

## Project goals

- Fast and minimal as possible.
- Configurable operations.
- Built-in secure cache with human readable entries and resistant against duplicates.
- Remote agnostic cache and input adapters.
- Smart and auto cache cleaning.

## API

**`/{format}/{operations}/{src}`**

Example: `http://cdn.example.com/webp/w:200/avatars/bafollo.png`

ََ‍‍Use `_` value in place for `{format}` or `{operations}` to keep original values of source image.

Possible values for format: `jpeg`,`webp` or `png`.

## Operations

Operation    |  Arguments            | Example     | Description
-------------|-----------------------|-------------|---------------------------------------------------------
`f`          | `format`              | f:webp      | Change format. 
`s`          | `width`, `height`     | s:200:300   | Resize image.
`w`          | `width`               | w:200       | Change image with.
`h`          | `height`              | h:200       | Change image height.
`embed`      | -                     | embed       | Preserving aspect ratio, resize the image to the maximum `width` or `height` specified then embed on a background of the exact `width` and `height` specified.
`max`        | -                     | max         | Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to the `width` and `height` specified.
`min`        | -                     | min         | Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to the width and height specified.

## License

MIT - Pooya Parsa
