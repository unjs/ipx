import { normalize, filterEmpty } from './utils'

export const img = ({
  baseURL = '',
  basePath = '',
  opts,
  adapter = 'local',
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
    _format,
    _adapter = ''
  ) => {
    const optsStr = filterEmpty([].concat(opts, _opts ? normalize(_opts) : [])).join(',')
    return (baseURL + '/' + (_adapter || adapter) + '/' + (_format || format) + '/' + optsStr + '/' + basePath + '/' + path).replace(/\/\//g, '/')
  }

  // Attach all presets
  if (presets) {
    Object.keys(presets).forEach((key) => {
      const preset = presets[key]
      const presetOpts = normalize(preset.opts)
      fn[key] = (path, _opts, _format, _adapter = '') => fn(path, _opts || presetOpts, _format || preset.format, _adapter || preset.adapter)
    })
  }

  return fn
}
