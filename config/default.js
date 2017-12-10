module.exports = {
  ipx: {
    input: {
      adapter: 'fs.js',
      dir: 'storage'
    },
    cache: {
      adapter: 'fs.js',
      dir: 'cache',
      cleanCron: '0 0 3 * * *',
      maxUnusedMinutes: 24 * 60
    }
  }
}
