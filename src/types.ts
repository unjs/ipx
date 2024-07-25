import type { ImageMeta } from "image-meta";
import type { Sharp, Color, KernelEnum } from "sharp";

// ---- Handlers ----

export interface HandlerContext {
  /**
   * Optional quality setting for the output image, affects compression in certain formats.
   * @optional
   */
  quality?: number;

  /**
   * Specifies the method to fit the image to the dimensions provided, e.g., 'contain', 'cover'.
   * @optional
   */
  fit?: "contain" | "cover" | "fill" | "inside" | "outside";

  /**
   * The position used for cropping or positioning, specified as a number or string.
   * @optional
   */
  position?: number | string;

  /**
   * Background colour to be used if necessary, provided as a colour object. See {@link Color}.
   * @optional
   */
  background?: Color;

  /**
   * Specifies whether to enlarge the image if it is smaller than the desired size.
   * @optional
   */
  enlarge?: boolean;

  /**
   * The type of kernel to use for image operations such as resizing. See {@link KernelEnum}.
   * @optional
   */
  kernel?: keyof KernelEnum;

  /**
   * Metadata about the image being processed.
   */
  meta: ImageMeta;
}

export interface Handler {
  /**
   * An array of functions that convert the given string arguments into usable forms.
   */
  args: ((argument: string) => any)[];

  /**
   * Defines the order in which this handler should be applied relative to other handlers.
   * @optional
   */
  order?: number;

  /**
   * Function to apply the effects of this handler to the image pipeline.
   * @param {HandlerContext} context - The current image processing context. See {@link HandlerContext}.
   * @param {Sharp} pipe - The Sharp instance to use for image processing. See {@link Sharp}.
   * @param {...any} arguments_ - Transformed arguments to use in the handler.
   */
  apply: (context: HandlerContext, pipe: Sharp, ...arguments_: any[]) => any;
}

// ---- Storage ----

export type IPXStorageMeta = {
  /**
   * The modification time of the stored item.
   * @optional
   */
  mtime?: Date | number | string;

  /**
   * The maximum age (in seconds) at which the stored item should be considered fresh.
   * @optional
   */
  maxAge?: number | string;
};

/**
 * Options specific to image saving operations.
 */
export type IPXStorageOptions = Record<string, unknown>;

type MaybePromise<T> = T | Promise<T>;

export interface IPXStorage {
  /**
   * A descriptive name for the storage type.
   */
  name: string;

  /**
   * Retrieves metadata for an image identified by 'id'.
   * @param {string} id - The identifier for the image.
   * @param {IPXStorageOptions} [opts] - Optional metadata retrieval options. See {@link IPXStorageOptions}.
   * @returns {MaybePromise<IPXStorageMeta | undefined>} A promise or direct return of the metadata, or undefined if not found. See {@link IPXStorageMeta}.
   */
  getMeta: (
    id: string,
    opts?: IPXStorageOptions,
  ) => MaybePromise<IPXStorageMeta | undefined>;

  /**
   * Get the actual data for an image identified by 'id'.
   * @param {string} id - The identifier for the image.
   * @param {IPXStorageOptions} [opts] - Optional options for the data retrieval. See {@link IPXStorageOptions}.
   * @returns {MaybePromise<ArrayBuffer | undefined>} A promise or direct return of the image data as an ArrayBuffer, or undefined if not found. See {@link ArrayBuffer}.
   */
  getData: (
    id: string,
    opts?: IPXStorageOptions,
  ) => MaybePromise<ArrayBuffer | undefined>;
}
