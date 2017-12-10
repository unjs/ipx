module.exports = {
  ipx: {
    input: {
      adapter: 'IPX_INPUT_ADAPTER',
      dir: 'IPX_INPUT_DIR'
    },
    cache: {
      adapter: 'IPX_CACHE_ADAPTER',
      dir: 'IPX_CACHE_DIR',
      cleanCron: 'IPX_CACHE_CLEAN_CRON',
      maxUnusedMinutes: 'IPX_CACHE_CLEAN_MINUTES'
    }
  }
}
