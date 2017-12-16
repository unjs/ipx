const filterEmpty = arr => arr.filter(o => o && o.length)
const normalizeObject = o => Object.keys(o).map(k => [].concat(k, o[k]).join('_'))
const normalizeArray = a => a.map(normalize).join('_')
const normalize = filterEmpty(o => typeof o === 'string' ? [o] : (Array.isArray(o) ? normalizeArray(o) : normalizeObject(o)))

export const img = ({
  baseURL = '',
  basePath = '',
  opts = [],
  format = '_',
  presets = null
}) => {
  // Normalize default opts
  opts = normalize(opts)

  // Create fn
  const fn = (
    path,
    _opts = [],
    _format = format
  ) => {
    const optsStr = [].concat(opts, normalize(_opts)).join(',')
    return (baseURL + '/' + format + '/' + optsStr + '/' + basePath + '/' + path).replace(/\/\//g, '/')
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
