## IPX client

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
  format = 'webp'
})

getImage('posts/ipx.jpg', { w: 200 }) // => https://cdn.example.com/webp/w_200/uploads/posts/ipx.jpg
```
