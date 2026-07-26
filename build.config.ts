import { defineBuildConfig } from "obuild/config";
import { createRequire } from "node:module";
import { minifySync } from "oxc-minify";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["./src/index.ts", "./src/cli.ts"],
      rolldown: {
        resolve: {
          alias: {
            // ESM (/lib) variant uses createRequire in nested deps which cannot be bundled
            svgo: createRequire(import.meta.url).resolve("svgo"),
          },
        },
        plugins: [
          {
            name: "dist-minify",
            renderChunk(code, chunk) {
              if (chunk.fileName.includes("libs/")) {
                return minifySync(chunk.fileName, code).code;
              }
            },
          },
        ],
      },
    },
  ],
});
