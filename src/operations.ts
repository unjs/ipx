import { IPXOperations } from './types'
import { VArg, VMax, VSize } from './utils'

export default <IPXOperations>{
  format: {
    name: 'format',
    args: [VArg],
    handler: (_context, pipe, format) => pipe.toFormat(format, {
      quality: _context.quality || 80
    })
  },
  s: {
    name: 'resize',
    args: [VSize, VSize],
    order: true,
    handler: (_context, pipe, width, height, fit) => pipe.resize(width, height, {
      fit: fit || _context.fit || 'cover',
      background: _context.background || { r: 0, g: 0, b: 0, alpha: 0 }
    })
  },
  b: {
    name: 'background',
    args: [VArg],
    handler: (_context, _pipe, model, background) => {
      if (!background) {
        background = model
      }
      if (model === 'hex') {
        background = '#' + background
      }
      _context.background = background
    }
  },
  q: {
    name: 'quality',
    args: [VMax(100)],
    handler: (_context, _pipe, quality) => {
      _context.quality = quality
    }
  },
  f: {
    name: 'fit',
    args: [VArg],
    handler: (_context, _pipe, fit) => {
      _context.fit = fit
    }
  },
  w: {
    name: 'width',
    args: [VSize],
    handler: (_context, pipe, width) => pipe.resize(width, null)
  },

  h: {
    name: 'height',
    args: [VSize],
    handler: (_context, pipe, height) => pipe.resize(null, height)
  },

  embed: {
    name: 'embed',
    args: [],
    handler: (_context, pipe) => pipe.embed()
  },

  max: {
    name: 'max',
    args: [],
    handler: (_context, pipe) => pipe.max()
  },

  min: {
    name: 'min',
    args: [],
    handler: (_context, pipe) => pipe.min()
  }
}
