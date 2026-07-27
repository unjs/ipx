/**
 * Single source of truth for the modifiers table in `README.md`.
 *
 * Each operation carries the modifiers used for **both** the example URL shown
 * in the table and the sample output generated from it, so a documented example
 * that IPX would reject cannot survive a `pnpm gen:operations` run.
 *
 * Run `pnpm gen:operations` after editing this file: it regenerates
 * `assets/operations/` and the `automd:ipx-operations` block in `README.md`.
 */

/** Source images the samples are generated from (see `gen-operations.ts`). */
export const SOURCES = {
  /** Opaque photo, the default for most operations. */
  photo: "sample.jpg",
  /** Same photo with transparent corners, for operations that need an alpha channel. */
  alpha: "sample-alpha.png",
  /** Logo on a white background, for operations acting on shapes or white pixels. */
  logo: "sample-logo.png",
  /** Animated GIF, for the `animated` modifier. */
  animated: "sample.gif",
} as const;

export type SourceName = keyof typeof SOURCES;

/** Width the `photo` and `alpha` sources are generated at (height follows the aspect ratio). */
export const SOURCE_WIDTH = 320;

/** Directory (relative to the repo root) holding the generated samples. */
export const OUTPUT_DIR = "assets/operations";

/** Directory holding the generated source images the samples are made from. */
export const SOURCE_DIR = `${OUTPUT_DIR}/sources`;

export interface Operation {
  /** Modifier name, as used in the URL. */
  name: string;

  /** Additional names accepted for the same modifier. */
  aliases?: string[];

  /** Link to the documentation of the underlying sharp operation. */
  docs?: string;

  /**
   * Modifiers used for the example URL and for the generated sample.
   *
   * May include unrelated modifiers when the operation needs them to be
   * visible (e.g. `resize` for `fit`, or `f_webp` to keep an alpha channel).
   */
  example: string;

  /** Source image the sample is generated from. */
  source?: SourceName;

  /** Explanation of the accepted arguments. */
  notes?: string;

  /**
   * Why no sample is generated, for operations whose effect a static sample
   * cannot show. Shown in place of the sample.
   */
  noSample?: string;
}

const RESIZE_DOCS = "https://sharp.pixelplumbing.com/api-resize#resize";
const EXTRACT_DOCS = "https://sharp.pixelplumbing.com/api-resize#extract";
const operationDocs = (anchor: string) =>
  `https://sharp.pixelplumbing.com/api-operation#${anchor}`;
const colourDocs = (anchor: string) =>
  `https://sharp.pixelplumbing.com/api-colour#${anchor}`;

export const OPERATIONS: Operation[] = [
  {
    name: "width",
    aliases: ["w"],
    docs: RESIZE_DOCS,
    example: "w_160",
    notes: "Positive integer.",
  },
  {
    name: "height",
    aliases: ["h"],
    docs: RESIZE_DOCS,
    example: "h_120",
    notes: "Positive integer.",
  },
  {
    name: "resize",
    aliases: ["s"],
    docs: RESIZE_DOCS,
    example: "s_200x200",
    notes:
      "`{width}x{height}` of positive integers. A single value (`s_200`) is a square.",
  },
  {
    name: "kernel",
    docs: RESIZE_DOCS,
    example: "s_80x80,kernel_nearest",
    notes:
      "Sets `kernel` option for `resize`. One of `nearest`, `linear`, `cubic`, `mitchell`, `lanczos2`, `lanczos3` (default), `mks2013` or `mks2021`.",
  },
  {
    name: "fit",
    docs: RESIZE_DOCS,
    example: "s_200x200,fit_contain,b_00ff00",
    notes:
      "Sets `fit` option for `resize`. One of `contain`, `cover` (default), `fill`, `inside` or `outside`.",
  },
  {
    name: "position",
    aliases: ["pos"],
    docs: RESIZE_DOCS,
    example: "s_200x200,pos_top",
    notes:
      "Sets `position` option for `resize`. A position (`top`, `right top`, `right`, `right bottom`, `bottom`, `left bottom`, `left`, `left top`), gravity (`north`, `northeast`, ..., `center`) or strategy (`entropy`, `attention`). Since `_` separates arguments, multi-word values use `-` (`pos_right-top`). The numeric gravity (`0`-`8`) and strategy (`16`-`17`) constants are also accepted.",
  },
  {
    name: "trim",
    docs: "https://sharp.pixelplumbing.com/api-resize#trim",
    example: "trim_30",
    notes:
      "Trim pixels from the edges that are within the threshold of the top-left pixel colour. Threshold is a number `>= 0` (defaults to `10`).",
    noSample: "the sample source has no uniform border to trim",
  },
  {
    name: "extend",
    docs: "https://sharp.pixelplumbing.com/api-resize#extend",
    example: "extend_20_40_20_40_mirror",
    notes:
      "Extend / pad / extrude one or more edges of the image. Format: `extend_{top}_{right}_{bottom}_{left}_{extendWith}`. Edges are integers between `0` and `10000`. Optional `extendWith`: `background` (default), `copy`, `repeat` or `mirror`. When extending with `background`, the colour comes from the `background` / `b` modifier, e.g. `b_00ff00,extend_20_40_20_40`.",
  },
  {
    name: "background",
    aliases: ["b"],
    example: "rotate_45,b_00ff00",
    notes:
      "Background colour used by `extend`, `rotate`, `flatten`, `opacity` and `resize` (with `fit_contain`).",
  },
  {
    name: "extract",
    aliases: ["crop"],
    docs: EXTRACT_DOCS,
    example: "extract_60_20_180_140",
    notes:
      "Extract/crop a region of the image, as `extract_{left}_{top}_{width}_{height}`. All four arguments are required; `width` and `height` must be positive.",
  },
  {
    name: "format",
    aliases: ["f"],
    docs: "https://sharp.pixelplumbing.com/api-output#toformat",
    example: "f_webp",
    notes:
      "Supported formats: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `heif`, `tiff` and `auto` (experimental, only with middleware).",
  },
  {
    name: "quality",
    aliases: ["q"],
    example: "q_10",
    notes: "Integer between `1` and `100`.",
  },
  {
    name: "rotate",
    docs: operationDocs("rotate"),
    example: "rotate_45",
    notes:
      "Angle in degrees, between `-3600` and `3600`. Angles that are not a multiple of `90` are filled with the `background` / `b` colour. Without an angle (`rotate`) the image is auto-oriented from its EXIF tag.",
  },
  {
    name: "enlarge",
    example: "enlarge,s_400x400",
    notes:
      "Allow the image to be upscaled. By default the returned image will never be larger than the source in any dimension, while preserving the requested aspect ratio.",
  },
  {
    name: "autoorient",
    docs: operationDocs("autoorient"),
    example: "autoorient",
    notes:
      "Rotate and flip the image based on its EXIF `Orientation` tag, then remove the tag.",
    noSample: "the sample source carries no EXIF `Orientation` tag",
  },
  {
    name: "flip",
    docs: operationDocs("flip"),
    example: "flip",
    notes: "Mirror the image vertically.",
  },
  {
    name: "flop",
    docs: operationDocs("flop"),
    example: "flop",
    notes: "Mirror the image horizontally.",
  },
  {
    name: "sharpen",
    docs: operationDocs("sharpen"),
    example: "sharpen_5",
    notes:
      "`{sigma}_{flat}_{jagged}_{x1}_{y2}_{y3}`. `sigma` is between `0.000001` and `10`, the rest between `0` and `1000000`. Without arguments (`sharpen`) a mild sharpen is applied.",
  },
  {
    name: "median",
    docs: operationDocs("median"),
    example: "median_10",
    notes:
      "Square mask size, an integer between `1` and `1000` (defaults to `3`).",
  },
  {
    name: "blur",
    docs: operationDocs("blur"),
    example: "blur_5",
    notes:
      "`{sigma}_{precision}_{minAmplitude}`. `sigma` is a number between `0.3` and `1000`, `precision` one of `integer` (default), `float` or `approximate`, `minAmplitude` a number between `0.001` and `1`. Without arguments (`blur`) a mild blur is applied.",
  },
  {
    name: "dilate",
    docs: operationDocs("dilate"),
    example: "dilate_5",
    source: "logo",
    notes:
      "Expand foreground objects. Width in pixels, an integer between `1` and `100` (defaults to `1`). Capped below the sharp maximum, since the cost grows with the width.",
  },
  {
    name: "erode",
    docs: operationDocs("erode"),
    example: "erode_5",
    source: "logo",
    notes:
      "Shrink foreground objects. Width in pixels, an integer between `1` and `100` (defaults to `1`). Capped below the sharp maximum, since the cost grows with the width.",
  },
  {
    name: "clahe",
    docs: operationDocs("clahe"),
    example: "clahe_20_20_5",
    notes:
      "Contrast limiting adaptive histogram equalization, as `{width}_{height}_{maxSlope}`. `width` is required and `height` defaults to it (a square window); both are integers between `1` and `100`, capped below the sharp maximum since the cost grows with the window, and clamped to the source dimensions. `maxSlope` is an integer between `0` and `100` (defaults to `3`).",
  },
  {
    name: "flatten",
    docs: operationDocs("flatten"),
    example: "flatten,b_00ff00,f_jpeg",
    source: "alpha",
    notes:
      "Remove alpha channel, if any, and replace with the `background` / `b` colour.",
  },
  {
    name: "unflatten",
    docs: operationDocs("unflatten"),
    example: "unflatten,f_webp",
    source: "logo",
    notes:
      "Make every fully white pixel transparent, so the output format needs an alpha channel (`png`, `webp`, `avif`).",
  },
  {
    name: "gamma",
    docs: operationDocs("gamma"),
    example: "gamma_3",
    notes:
      "`{gamma}_{gammaOut}`, each a number between `1.0` and `3.0` (defaults to `2.2`).",
  },
  {
    name: "negate",
    docs: operationDocs("negate"),
    example: "negate",
    notes:
      "Optional `{alpha}` (`true` by default) controls whether the alpha channel is negated too, e.g. `negate_false`.",
  },
  {
    name: "normalize",
    docs: operationDocs("normalize"),
    example: "normalize_10_90",
    notes:
      "Stretch the luminance to the full dynamic range, as `{lower}_{upper}` percentiles. `lower` is a number between `0` and `99` (defaults to `1`), `upper` between `1` and `100` (defaults to `99`) and has to be greater than `lower`.",
  },
  {
    name: "threshold",
    docs: operationDocs("threshold"),
    example: "threshold_128",
    notes:
      "`{threshold}_{grayscale}`. `threshold` is an integer between `0` and `255` (defaults to `128`). Optional `grayscale` (`true` by default) converts to single channel grayscale first, e.g. `threshold_128_false`.",
  },
  {
    name: "linear",
    docs: operationDocs("linear"),
    example: "linear_1.5_-30",
    notes:
      "Levels adjustment applying `a * input + b`, as `{a}_{b}`. `a` is the multiplier (defaults to `1`), `b` the offset (defaults to `0`).",
  },
  {
    name: "tint",
    docs: colourDocs("tint"),
    example: "tint_00ff00",
    notes: "Tint colour.",
  },
  {
    name: "grayscale",
    docs: colourDocs("grayscale"),
    example: "grayscale",
    notes: "Convert to 8-bit greyscale.",
  },
  {
    name: "modulate",
    docs: operationDocs("modulate"),
    example: "modulate_1.5_2_90_10",
    notes:
      "Transforms the image using `{brightness}_{saturation}_{hue}_{lightness}`. `brightness` and `saturation` are numbers `>= 0`, `hue` is an integer in degrees. Each is also available on its own (below), which is easier to read when only one is needed.",
  },
  {
    name: "brightness",
    docs: operationDocs("modulate"),
    example: "brightness_1.5",
    notes: "Brightness multiplier, a number `>= 0`. Required.",
  },
  {
    name: "saturation",
    docs: operationDocs("modulate"),
    example: "saturation_0.3",
    notes: "Saturation multiplier, a number `>= 0`. Required.",
  },
  {
    name: "hue",
    docs: operationDocs("modulate"),
    example: "hue_90",
    notes: "Hue rotation, an integer in degrees. Required.",
  },
  {
    name: "lightness",
    docs: operationDocs("modulate"),
    example: "lightness_30",
    notes: "Lightness addend, a number. Required.",
  },
  {
    name: "opacity",
    example: "opacity_0.5,f_webp",
    notes:
      "Opacity, a number between `0` and `1`. Required. The image is made transparent, so the output format needs an alpha channel (`png`, `webp`, `avif`). Set the `background` / `b` colour to blend into it instead and keep the output opaque, e.g. `opacity_0.5,b_fff,f_jpeg`.",
  },
  {
    name: "animated",
    aliases: ["a"],
    example: "a,w_160",
    source: "animated",
    notes: "Process every frame of an animated image. Experimental.",
  },
];

// --------- Rendering ---------

/** The file name a sample is written to and referenced by in the README. */
export function sampleFile(operation: Operation): string {
  return `${operation.name}.${sampleFormat(operation)}`;
}

/**
 * Output format of a sample, derived from the example modifiers so that the
 * table can be rendered (by automd) without touching the generated files.
 */
export function sampleFormat(operation: Operation): string {
  const requested = /(?:^|,)(?:f|format)_([^,]+)/.exec(operation.example)?.[1];
  const format = requested || sourceFormat(operation);
  return format === "jpeg" ? "jpg" : format;
}

function sourceFormat(operation: Operation): string {
  return SOURCES[operation.source || "photo"].split(".").pop() as string;
}

/** Number of operations per row of the grid. */
const GRID_COLUMNS = 2;

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The grid is raw HTML (markdown has no grid layout), which GitHub does not
 * parse as markdown, so inline code spans are converted by hand.
 */
function inlineHTML(markdown: string): string {
  return escapeHTML(markdown).replaceAll(
    /`([^`]+)`/g,
    (_, code: string) => `<code>${code}</code>`,
  );
}

function names(operation: Operation): string {
  return [operation.name, ...(operation.aliases || [])]
    .map((name) => `<code>${name}</code>`)
    .join(" / ");
}

/** Renders one operation: name, sample, example URL and notes. */
function renderCell(operation: Operation): string {
  const url = `/${operation.example}/${SOURCES[operation.source || "photo"]}`;
  const sample = operation.noSample
    ? `<em>No sample: ${inlineHTML(operation.noSample)}.</em>`
    : `<img src="./${OUTPUT_DIR}/${sampleFile(operation)}" alt="${escapeHTML(url)}">`;
  const description = [
    operation.notes && inlineHTML(operation.notes),
    operation.docs && `(<a href="${operation.docs}">docs</a>)`,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `<td valign="top" width="50%">`,
    `<div align="center">${sample}</div>`,
    `<div align="center"><b>${names(operation)}</b></div>`,
    `<code>${escapeHTML(url)}</code>`,
    ...(description ? [`<br>`, description] : []),
    `</td>`,
  ].join("\n");
}

/** Renders the contents of the `automd:ipx-operations` block in `README.md`. */
export function renderOperations(): string {
  // Operations without a sample go last, so the grid of images is unbroken.
  const ordered = [
    ...OPERATIONS.filter((operation) => !operation.noSample),
    ...OPERATIONS.filter((operation) => operation.noSample),
  ];

  const rows: string[] = [];
  for (let i = 0; i < ordered.length; i += GRID_COLUMNS) {
    const cells = ordered
      .slice(i, i + GRID_COLUMNS)
      .map((operation) => renderCell(operation));
    // Keeps the last row aligned when the number of operations is odd.
    while (cells.length < GRID_COLUMNS) {
      cells.push(`<td valign="top" width="50%"></td>`);
    }
    rows.push(`<tr>\n${cells.join("\n")}\n</tr>`);
  }

  return `<table>\n${rows.join("\n")}\n</table>`;
}
