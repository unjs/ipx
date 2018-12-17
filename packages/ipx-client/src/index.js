import { normalize, filterEmpty } from './utils'

export const img = ({
  baseURL = '',
  basePath = '',
  opts,
  format = '_',
  presets
}) => {
  // Normalize default opts
  opts = opts ? normalize(opts) : []

  // Patch baseURL
  baseURL = baseURL.replace('://', ':///')

  // Create fn
  const fn = (
    path,
    _opts,
    _format
  ) => {
    const optsStr = filterEmpty([].concat(opts, _opts ? normalize(_opts) : [])).join(',')
    return (baseURL + '/' + (_format || format) + '/' + optsStr + '/' + basePath + '/' + path).replace(/\/\//g, '/')
  }

  // Attach all presets
  if (presets) {
    Object.keys(presets).forEach(key => {
      const preset = presets[key]
      const presetOpts = normalize(preset.opts)
      fn[key] = (path, _opts, _format) => fn(path, _opts || presetOpts, _format || preset.format)
    })
  }

  return fn
}
