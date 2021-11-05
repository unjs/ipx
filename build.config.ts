import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  emitCJS: true,
  inlineDependencies: true,
  entries: [
    'src/index',
    'src/cli'
  ]
})
