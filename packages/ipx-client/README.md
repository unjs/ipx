<div align="center">
<img src="../../logo.png" alt="IPX Logo" />
</div>

[![NPM Vernion](https://flat.badgen.net/npm/v/ipx-client/latest)](https://www.npmjs.com/package/ipx-client)
[![NPM Downloads](https://flat.badgen.net/npm/dt/ipx-client/latest)](https://www.npmjs.com/package/ipx-client)
[![Bundle Size](https://flat.badgen.net/bundlephobia/minzip/ipx-client)](https://bundlephobia.com/result?p=ipx-client)

IPX Client for Node.js and Browser

> See [IPX](https://github.com/pi0/ipx) for more information.

Install package:

```bash
npm i ipx-client
yarn install ipx-client
```

Import client:

```js
import { img } from 'ipx-client'

const { img } = require('ipx-client')
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
