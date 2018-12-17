function env (name, defaultValue) {
  return process.env[name] || defaultValue
}
export default function getConfig () {
  return {
    port: env('IPX_PORT', env('PORT', 3000)),
    input: {
      adapter: env('IPX_INPUT_ADAPTER', 'fs'),
      dir: env('IPX_INPUT_DIR', 'storage')
    },
    cache: {
      adapter: env('IPX_CACHE_ADAPTER', 'fs'),
      dir: env('IPX_CACHE_DIR', 'cache'),
      cleanCron: env('IPX_CACHE_CLEAN_CRON', '0 0 3 * * *'),
      maxUnusedMinutes: env('IPX_CACHE_CLEAN_MINUTES', 24 * 60)
    }
  }
}
