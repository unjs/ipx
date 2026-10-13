import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: ['image-meta']
  },
  entries: ["src/index", "src/cli"],
});
