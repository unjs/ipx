const Boom = require('boom')

const MAX_SIZE = 2048

const argRegex = /^[a-z0-9]+$/i
const numRegex = /^[1-9][0-9]*$/

const VArg = arg => {
  if (!argRegex.test(arg)) {
    throw Boom.badRequest('Invalid argument: ' + arg)
  }
  return arg
}

const VMax = max => num => {
  if (!numRegex.test(num)) {
    throw Boom.badRequest('Invalid numeric argument: ' + num)
  }
  return Math.min(parseInt(num), max) || null
}

const VSize = VMax(MAX_SIZE)

module.exports = {
  VArg,
  VMax,
  VSize
}
