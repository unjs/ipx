import type { CustomPlugin, XastChild, XastParent } from "svgo";

/**
 * Elements that can execute script or embed non-SVG documents.
 *
 * Matched against the local name so namespaced variants (`<svg:script>`) are
 * covered as well.
 */
const UNSAFE_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "handler", // SVG Tiny 1.2 event handler
  "listener", // SVG Tiny 1.2 event listener
  "base",
  "link",
  "meta",
]);

/**
 * SMIL elements that can rewrite attributes of their target *after* load,
 * which can be used to re-introduce event handlers or `javascript:` URIs.
 */
const ANIMATION_ELEMENTS = new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
]);

/** SMIL attributes holding the value(s) assigned to the animated attribute. */
const ANIMATION_VALUE_ATTRS = ["from", "to", "by", "values"];

/** Attributes (local names) that are resolved as URIs. */
const URI_ATTRS = new Set(["href", "src"]);

/** URI schemes that cannot execute script. */
const SAFE_URI_SCHEMES = new Set(["http", "https", "mailto", "tel", "ftp"]);

/**
 * Non-SVG image data URIs. `image/svg+xml` is excluded since it embeds another
 * (unsanitized) document.
 */
const SAFE_DATA_URI_RE = /^data:image\/(?!svg\+xml)[\w.+-]+[,;]/;

const URI_SCHEME_RE = /^([a-z][\d+.a-z-]*):/;

/** Whitespace and control characters browsers ignore when resolving a URI. */
// eslint-disable-next-line no-control-regex
const URI_IGNORED_CHARS_RE = /[\u0000-\u0020]/g;

function localName(name: string): string {
  const colonIndex = name.indexOf(":");
  return (colonIndex === -1 ? name : name.slice(colonIndex + 1)).toLowerCase();
}

function isUnsafeURI(value: string): boolean {
  const uri = value.replace(URI_IGNORED_CHARS_RE, "").toLowerCase();
  const scheme = URI_SCHEME_RE.exec(uri)?.[1];
  if (!scheme) {
    return false; // Relative URIs and fragment references
  }
  if (scheme === "data") {
    return !SAFE_DATA_URI_RE.test(uri);
  }
  return !SAFE_URI_SCHEMES.has(scheme);
}

function isUnsafeAnimation(attributes: Record<string, string>): boolean {
  // Attributes are looked up by local name since an HTML parser lowercases
  // them, turning `ATTRIBUTENAME` into a live `attributeName` when inlined
  const attrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes)) {
    attrs[localName(name)] = value;
  }

  // <set attributeName="onload" to="alert(1)" />
  // The value is trimmed, as optimizers do the same before it reaches a browser
  if (localName(attrs.attributename?.trim() || "").startsWith("on")) {
    return true;
  }
  // <animate attributeName="href" values="javascript:alert(1)" />
  return ANIMATION_VALUE_ATTRS.some((attr) =>
    // `values` is a `;` separated list
    (attrs[attr] || "").split(";").some((value) => isUnsafeURI(value)),
  );
}

function detach(node: XastChild, parent: XastParent): void {
  parent.children = parent.children.filter((child) => child !== node);
}

/**
 * An SVGO plugin that strips the parts of an SVG document that can execute
 * script when the image is served or inlined.
 *
 * It is always applied, regardless of the `svg.optimize` option. SVGO's
 * built-in `removeScripts` plugin runs alongside it as a second layer, but
 * only handles `<script>`, the known `on*` attributes and `javascript:`
 * links on `<a>`.
 *
 * External references (`<image href>`, `<use href>`, `@import` in `<style>`,
 * fonts, ...) are intentionally kept. See the security section of the readme.
 */
export const sanitizeSVGPlugin: CustomPlugin = {
  name: "ipx-sanitize",
  fn: () => ({
    // Drop the doctype. Entities of the internal subset are already expanded
    // while parsing and re-emitting the declarations would allow expansion
    // again downstream.
    doctype: {
      enter: (node, parentNode) => detach(node, parentNode),
    },
    // Drop processing instructions. `<?xml-stylesheet href="..."?>` can load an
    // external (XSLT) stylesheet, and instructions are serialized unescaped, so
    // `<?foo ><script>...</script>?>` turns into markup in an HTML parser.
    instruction: {
      enter: (node, parentNode) => detach(node, parentNode),
    },
    element: {
      enter: (node, parentNode) => {
        const name = localName(node.name);

        // Unsafe elements are removed along with their subtree
        if (UNSAFE_ELEMENTS.has(name)) {
          detach(node, parentNode);
          return;
        }

        // SMIL animations that (re)assign event handlers or unsafe URIs
        if (
          ANIMATION_ELEMENTS.has(name) &&
          isUnsafeAnimation(node.attributes)
        ) {
          detach(node, parentNode);
          return;
        }

        for (const [attr, value] of Object.entries(node.attributes)) {
          const attrName = localName(attr);
          if (
            attrName.startsWith("on") ||
            (URI_ATTRS.has(attrName) && isUnsafeURI(value))
          ) {
            delete node.attributes[attr];
          }
        }
      },
    },
  }),
};
