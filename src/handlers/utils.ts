import destr from 'destr'
import type { Handler } from '../types'
import * as Handlers from './handlers'

export function VArg (arg: string) {
  return destr(arg)
}

export function parseArgs (args: string, mappers: Function[]) {
  const vargs = args.split('_')
  return mappers.map((v, i) => v(vargs[i]))
}

export function getHandler (key): Handler {
  return Handlers[key]
}

export function applyHandler (ctx, pipe, handler: Handler, argsStr: string) {
  const args = handler.args ? parseArgs(argsStr, handler.args) : []
  return handler.apply(ctx, pipe, ...args)
}
