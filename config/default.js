module.exports = {
  ipx: {
    input: {
      adapter: 'file.js',
      dir: 'storage'
    },
    cache: {
      adapter: 'file.js',
      dir: 'cache',
      cleanCron: '* * * * * *',
      maxUnusedMinutes: 2
    }
  }
}
