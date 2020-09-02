import { IPXOperation, IPXOperations } from './types'
import { VSize } from './utils'

export default <IPXOperations>{
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
    args: [],
    handler: (context, pipe) => pipe.embed()
  },

  max: {
    name: 'max',
    args: [],
    handler: (context, pipe) => pipe.max()
  },

  min: {
    name: 'min',
    args: [],
    handler: (context, pipe) => pipe.min()
  }
}
