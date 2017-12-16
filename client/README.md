## IPX JS Client

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
const getImage = img({
  baseURL = 'https://cdn.example.com',
  basePath = 'uploads',
  opts = [], // default opts
  format = 'webp'
})

// getImage: (path, opts?, format?) => URL

getImage('posts/ipx.jpg', { w: 200 }) // => https://cdn.example.com/webp/w_200/uploads/posts/ipx.jpg
```
