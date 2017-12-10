module.exports = {
  ipx: {
    input: {
      adapter: 'IPX_INPUT_ADAPTER', // Default: fs.js
      dir: 'IPX_INPUT_DIR' // Default: storage
    },
    cache: {
      adapter: 'IPX_CACHE_ADAPTER', // Default: fs.js
      dir: 'IPX_CACHE_DIR', // Default: cache
      cleanCron: 'IPX_CACHE_CLEAN_CRON', // Default: 0 0 3 * * * (every night at 3:00 AM)
      maxUnusedMinutes: 'IPX_CACHE_CLEAN_MINUTES' // Default: 24 * 60 (24 hours)
    }
  }
}
