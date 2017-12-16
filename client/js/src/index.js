const normalizeObject = o => Object.keys(o).map(k => [].concat(k, o[k]).join('_'))
const normalizeArray = a => a.map(normalize).join('_')
const normalize = o => typeof o === 'string' ? [o] : (Array.isArray(o) ? normalizeArray(o) : normalizeObject(o))

export const img = ({
  baseURL = '',
  basePath = '',
  opts = [],
  format = '_'
}) => (
  path,
  _opts,
  _format
) => {
  const optsStr = []
    .concat(normalize(opts))
    .concat(normalize(_opts))
    .filter(o => o && o.length)
    .join(',')

  return (baseURL + '/' + format + '/' + optsStr + '/' + basePath + '/' + path).replace(/\/\//g, '/')
}
