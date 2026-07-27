/**
 * Regenerates the modifier samples in `assets/operations/` and the
 * `automd:ipx-operations` table in `README.md`.
 *
 * Everything under `assets/operations/` is generated: the source images are
 * derived from the (committed) test assets and every sample is produced by
 * running the real IPX pipeline over `scripts/operations.ts`, so a documented
 * example that IPX rejects fails this script instead of shipping to the README.
 *
 * Usage: `pnpm gen:operations`
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { automd } from "automd";
import sharp from "sharp";

import { createIPX, ipxFSStorage } from "../src/index.ts";
import { parseIPXURL } from "../src/server.ts";
import * as handlers from "../src/handlers/handlers.ts";

import {
  OPERATIONS,
  OUTPUT_DIR,
  SOURCES,
  SOURCE_DIR,
  SOURCE_WIDTH,
  sampleFile,
  sampleFormat,
  type Operation,
} from "./operations.ts";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(rootDir, OUTPUT_DIR);
const sourceDir = join(rootDir, SOURCE_DIR);

// Modifiers applied by `createIPX` itself rather than by a handler.
const NON_HANDLER_MODIFIERS = new Set(["format", "f", "animated", "a"]);

/**
 * Fails when a modifier is missing from (or misspelled in) `operations.ts`, so
 * that the table cannot silently fall behind `src/handlers/handlers.ts`.
 */
function checkCoverage(): void {
  const documented = new Set(
    OPERATIONS.flatMap((operation) => [
      operation.name,
      ...(operation.aliases || []),
    ]),
  );
  const supported = new Set([
    ...Object.keys(handlers),
    ...NON_HANDLER_MODIFIERS,
  ]);

  const missing = [...supported].filter((name) => !documented.has(name));
  const unknown = [...documented].filter((name) => !supported.has(name));

  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      [
        missing.length > 0 && `Undocumented modifiers: ${missing.join(", ")}`,
        unknown.length > 0 && `Unknown modifiers: ${unknown.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

/**
 * Generates the source images the samples are made from.
 *
 * They are scaled down to keep the README (and the repository) small: the
 * effect of an operation has to be visible at the size the sample is displayed.
 */
async function generateSources(): Promise<void> {
  const photo = await sharp(join(rootDir, "test/assets/bliss.jpg"))
    .resize(SOURCE_WIDTH)
    .jpeg({ quality: 80 })
    .toBuffer();
  await writeFile(join(sourceDir, SOURCES.photo), photo);

  // Rounded corners cut out of the photo, so that operations working on the
  // alpha channel (`flatten`, ...) have something to show.
  const { width = SOURCE_WIDTH, height = SOURCE_WIDTH } =
    await sharp(photo).metadata();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="48" ry="48"/></svg>`,
  );
  await sharp(photo)
    .composite([{ input: mask, blend: "dest-in" }])
    // A palette keeps the committed source small; it is only a docs sample.
    .png({ palette: true })
    .toFile(join(sourceDir, SOURCES.alpha));

  // Rasterized (IPX serves SVG sources as SVG, so it cannot be one) on a white
  // background, so that `unflatten` has white pixels to remove.
  await sharp(join(rootDir, "test/assets/nuxt.svg"), { density: 300 })
    .resize(SOURCE_WIDTH)
    .flatten({ background: "#ffffff" })
    // No palette: dithering would show up as noise in the `dilate` / `erode` samples.
    .png()
    .toFile(join(sourceDir, SOURCES.logo));

  await sharp(join(rootDir, "test/assets/giphy.gif"), { animated: true })
    .resize(SOURCE_WIDTH / 2)
    .gif()
    .toFile(join(sourceDir, SOURCES.animated));
}

async function generateSample(
  ipx: ReturnType<typeof createIPX>,
  operation: Operation,
): Promise<void> {
  const source = SOURCES[operation.source || "photo"];

  // Parsed with the real URL parser, so the documented example is exactly what
  // a request to the server would apply.
  const { id, modifiers } = parseIPXURL(
    `http://localhost/${operation.example}/${source}`,
  );

  const { data, format } = await ipx(id, modifiers).process();

  const expected = sampleFormat(operation);
  if (format !== (expected === "jpg" ? "jpeg" : expected)) {
    throw new Error(
      `Unexpected output format for \`${operation.name}\`: got \`${format}\`, expected \`${expected}\``,
    );
  }

  await writeFile(join(outputDir, sampleFile(operation)), data);
}

async function main(): Promise<void> {
  checkCoverage();

  // The whole directory is generated, so it is rebuilt from scratch to drop
  // samples of modifiers that no longer exist.
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });

  await generateSources();
  console.log(`Generated ${Object.keys(SOURCES).length} sources`);

  const ipx = createIPX({ storage: ipxFSStorage({ dir: sourceDir }) });

  const samples = OPERATIONS.filter((operation) => !operation.noSample);
  for (const operation of samples) {
    await generateSample(ipx, operation);
  }
  console.log(`Generated ${samples.length} samples in ${OUTPUT_DIR}/`);

  // Renders the table via the `ipx-operations` generator in `automd.config.ts`.
  const { results } = await automd({ dir: rootDir });
  for (const result of results) {
    console.log(
      `${result.hasChanged ? "Updated" : "Unchanged"}: ${result.output}`,
    );
  }
}

await main();
