export const filterEmpty = arr => arr.filter(o => o && o.length)
export const normalizeObject = o => Object.keys(o).map(k => [].concat(k, o[k]).join('_'))
export const normalizeArray = a => a.join('_')
export const normalize = o => typeof o === 'string' ? [o] : (Array.isArray(o) ? normalizeArray(o) : normalizeObject(o))
