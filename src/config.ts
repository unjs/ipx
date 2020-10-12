import defu from 'defu'
import { IPXOptions } from './types'

function env (name: string, defaultValue: any) {
  return process.env[name] || defaultValue
}
const defaults = {
  port: env('IPX_PORT', env('PORT', 3000)),
  inputs: [],
  cache: {
    adapter: env('IPX_CACHE_ADAPTER', 'fs'),
    dir: env('IPX_CACHE_DIR', 'cache'),
    cleanCron: env('IPX_CACHE_CLEAN_CRON', '0 0 3 * * *'),
    maxUnusedMinutes: env('IPX_CACHE_CLEAN_MINUTES', 24 * 60)
  }
}
export default function getConfig (options: Partial<IPXOptions>): IPXOptions {
  const config: IPXOptions = defu(options, defaults)
  if (!config.inputs.length) {
    config.inputs = [
      {
        name: env('IPX_INPUT_NAME', 'local'),
        adapter: env('IPX_INPUT_ADAPTER', 'fs'),
        dir: env('IPX_INPUT_DIR', 'storage')
      }
    ]
  }
  return config
}
