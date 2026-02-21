import { defineBuildConfig } from "obuild/config";
import { minifySync } from "oxc-minify";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["./src/index.ts", "./src/cli.ts"],
      rolldown: {
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
