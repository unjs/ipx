import { VSize } from './utils'

export default {
  s: {
    name: 'resize',
    args: [ VSize, VSize ],
    handler: (context, pipe, width, height) => pipe.resize(width, height)
  },

  w: {
    name: 'width',
    args: [ VSize ],
    handler: (context, pipe, width) => pipe.resize(width, null)
  },

  h: {
    name: 'height',
    args: [ VSize ],
    handler: (context, pipe, height) => pipe.resize(null, height)
  },

  embed: {
    name: 'embed',
    handler: (context, pipe) => pipe.embed()
  },

  max: {
    name: 'max',
    handler: (context, pipe) => pipe.max()
  },

  min: {
    name: 'min',
    handler: (context, pipe) => pipe.min()
  }
}
