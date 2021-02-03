import { createError } from './utils'

// https://sharp.pixelplumbing.com/#formats
// (gif and svg are not supported as output)
export const SUPPORTED_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'tiff']

const MAX_SIZE = 2048
const ARG_SEP = '_'
const ARG_RE = /^[a-z0-9]+$/i
const NUM_RE = /^[1-9][0-9]*$/

const VArg = (arg: string) => {
  if (!ARG_RE.test(arg)) {
    throw createError('Invalid argument: ' + arg, 400)
  }
  return arg
}

const VMax = (max: number) => (num: string) => {
  if (!NUM_RE.test(num)) {
    throw createError('Invalid numeric argument: ' + num, 400)
  }
  return Math.min(parseInt(num), max) || null
}

const VSize = VMax(MAX_SIZE)

export function parseArgs (args: string, mappers: Function[]) {
  const vargs = args.split(ARG_SEP)
  return mappers.map((v, i) => v(vargs[i]))
}

export function applyHandler (ctx, pipe, key, val) {
  const handler = Handlers[key]
  if (!handler) {
    return false
  }
  const args = handler.args && parseArgs(val, handler.args)
  return handler.apply(ctx, pipe, ...args)
}

export interface Handler {
  args: Function[]
  apply: (context: any, pipe: any, ...args: any[]) => any
}

const format: Handler = {
  args: [VArg],
  apply: (_context, pipe, format) => {
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw createError('Unsupported format ' + format + ' (supported: ' + SUPPORTED_FORMATS.join(', ') + ')', 400)
    }
    return pipe.toFormat(format, {
      quality: _context.quality || 80
    })
  }
}

const resize: Handler = {
  args: [VSize, VSize],
  apply: (context, pipe, width, height, fit) => {
    return pipe.resize(width, height, {
      fit: fit || context.fit || 'cover'
    })
  }
}

const HEX_RE = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
const SHORTHEX_RE = /^([a-f\d])([a-f\d])([a-f\d])$/i
const background: Handler = {
  args: [VArg],
  apply: (_context, pipe, background) => {
    if (!background.startsWith('#') && (HEX_RE.test(background) || SHORTHEX_RE.test(background))) {
      background = '#' + background
    }
    return pipe.flatten({ background })
  }
}

const quality: Handler = {
  args: [VMax(100)],
  apply: (context, _pipe, quality) => { context.quality = quality }
}

const fit: Handler = {
  args: [VArg],
  apply: (context, _pipe, fit) => { context.fit = fit }
}

const width: Handler = {
  args: [VSize],
  apply: (_context, pipe, width) => pipe.resize(width, null)
}

const height: Handler = {
  args: [VSize],
  apply: (_context, pipe, height) => pipe.resize(null, height)
}

const max: Handler = {
  args: [],
  apply: (_context, pipe) => pipe.max()
}

const min: Handler = {
  args: [],
  apply: (_context, pipe) => pipe.min()
}

const Handlers = {
  background,
  bg: background,
  quality,
  q: quality,
  fit,
  width,
  w: width,
  height,
  h: height,
  max,
  min,
  resize,
  s: resize,
  format,
  f: format
}
