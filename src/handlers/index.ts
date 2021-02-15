import * as Handlers from './handlers'
import { parseArgs } from './utils'

export function applyHandler (ctx, pipe, key, val) {
  const handler = Handlers[key]
  if (!handler) { return }
  const args = handler.args && parseArgs(val, handler.args)
  return handler.apply(ctx, pipe, ...args)
}
