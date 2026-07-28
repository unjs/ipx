import { describe, it, expect } from "vitest";
import { resolve } from "node:path";

import {
  type IPXOptions,
  createIPX,
  ipxFSStorage,
  type IPXStorage,
} from "../src/index.ts";

function inlineStorage(svg: string): IPXStorage {
  return {
    name: "inline",
    getMeta: () => ({}),
    getData: () => Buffer.from(svg),
  };
}

async function processSVG(
  svg: string,
  options?: Partial<Omit<IPXOptions, "storage">>,
): Promise<string> {
  const ipx = createIPX({ storage: inlineStorage(svg), ...options });
  const { data, format } = await ipx("test.svg").process();
  expect(format).toBe("svg+xml");
  return data.toString();
}

const svgAttrs = `width="16" height="16" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`;

const xssVectors = [
  {
    name: "script element",
    svg: `<svg ${svgAttrs}><script>alert(1)</script><rect width="1" height="1"/></svg>`,
    absent: ["<script", "alert(1)"],
  },
  {
    name: "namespaced script element",
    svg: `<svg ${svgAttrs} xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>`,
    absent: ["script", "alert(1)"],
  },
  {
    name: "event handler attributes",
    svg: `<svg ${svgAttrs}><rect onclick="alert(1)" onmadeupevent="alert(2)" width="1" height="1"/></svg>`,
    absent: ["onclick", "onmadeupevent", "alert("],
  },
  {
    name: "foreignObject with iframe",
    svg: `<svg ${svgAttrs}><foreignObject width="1" height="1"><iframe src="javascript:alert(1)"/></foreignObject></svg>`,
    absent: ["foreignObject", "iframe", "javascript:"],
  },
  {
    name: "SMIL event handler injection",
    svg: `<svg ${svgAttrs}><rect width="1" height="1"><set attributeName="onload" to="alert(1)"/></rect></svg>`,
    absent: ["<set", "onload", "alert(1)"],
  },
  {
    name: "SMIL event handler injection with padded attributeName",
    svg: `<svg ${svgAttrs}><rect width="1" height="1"><set attributeName=" onload" to="alert(1)"/></rect></svg>`,
    absent: ["<set", "onload", "alert(1)"],
  },
  {
    // An HTML parser lowercases these into a live `<set attributeName="href">`
    name: "SMIL injection with uppercase names",
    svg: `<svg ${svgAttrs}><a><SET ATTRIBUTENAME="HREF" TO="javascript:alert(1)"/><circle cx="8" cy="8" r="4"/></a></svg>`,
    absent: ["SET", "javascript:", "alert(1)"],
  },
  {
    name: "SMIL href injection",
    svg: `<svg ${svgAttrs}><a><animate attributeName="xlink:href" values="javascript:alert(1)" dur="1s"/><rect width="1" height="1"/></a></svg>`,
    absent: ["<animate", "javascript:"],
  },
  {
    name: "javascript: link",
    svg: `<svg ${svgAttrs}><a href="javascript:alert(1)"><circle cx="8" cy="8" r="4"/></a></svg>`,
    absent: ["javascript:"],
    // The link is unwrapped, its contents are kept
    present: ["<circle"],
  },
  {
    name: "javascript: URI outside of links",
    svg: `<svg ${svgAttrs}><image xlink:href="java&#9;script:alert(1)" width="1" height="1"/></svg>`,
    absent: ["javascript:", "alert(1)"],
  },
  {
    name: "entity encoded javascript: URI",
    svg: `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xss "javascript:alert(1)">]><svg ${svgAttrs}><a href="&xss;"><rect width="1" height="1"/></a></svg>`,
    absent: ["javascript:", "ENTITY", "alert(1)"],
  },
  {
    name: "nested svg data URI",
    svg: `<svg ${svgAttrs}><image href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" width="1" height="1"/></svg>`,
    absent: ["data:image/svg+xml"],
  },
  {
    name: "xml-stylesheet processing instruction",
    svg: `<?xml-stylesheet type="text/xsl" href="http://evil.com/evil.xsl"?><svg ${svgAttrs}><rect width="1" height="1"/></svg>`,
    absent: ["xml-stylesheet", "evil.xsl"],
  },
  {
    // Instructions are serialized unescaped, an HTML parser ends the bogus
    // comment at the first `>` and treats the rest as markup
    name: "markup smuggled in a processing instruction",
    svg: `<?foo ><script>alert(1)</script>?><svg ${svgAttrs}><rect width="1" height="1"/></svg>`,
    absent: ["<?foo", "<script", "alert(1)"],
  },
];

// Sanitization must not depend on optimization being enabled
describe.each([
  { name: "default", options: undefined },
  { name: "optimize disabled", options: { svg: { optimize: false } } as const },
])("sanitize svg ($name)", ({ options }) => {
  it.each(xssVectors)("$name", async ({ svg, absent, present }) => {
    const output = await processSVG(svg, options);
    for (const value of absent) {
      expect(output).not.toContain(value);
    }
    for (const value of present || []) {
      expect(output).toContain(value);
    }
  });

  it("xss.svg fixture", async () => {
    const ipx = createIPX({
      storage: ipxFSStorage({ dir: resolve(__dirname, "assets") }),
      ...options,
    });
    const { data } = await ipx("xss.svg").process();
    const output = data.toString();
    expect(output).not.toContain("<script");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("javascript:");
    expect(output).toContain("<path");
  });

  it("keeps safe content", async () => {
    const output = await processSVG(
      `<svg ${svgAttrs}>` +
        `<style>.a { fill: red }</style>` +
        `<use href="#shape"/>` +
        `<image href="https://example.com/image.png" width="1" height="1"/>` +
        `<image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>` +
        `<rect id="shape" class="a" width="1" height="1">` +
        `<animate attributeName="fill" values="#f00;#00f" dur="1s"/>` +
        `</rect>` +
        `</svg>`,
      options,
    );
    // Styles may be inlined by the optimizer, but must not be dropped
    expect(output).toMatch(/fill:\s?red/);
    expect(output).toContain(`<use href="#`);
    // External references are kept by design, see readme
    expect(output).toContain(`https://example.com/image.png`);
    expect(output).toContain(`data:image/png;base64,iVBORw0KGgo=`);
    expect(output).toContain(`<animate attributeName="fill"`);
  });
});

describe("optimize svg", () => {
  // `removeComments` is part of `preset-default`, `removeTitle` is not
  const svg = `<svg ${svgAttrs}><!--comment--><title>title</title><script>alert(1)</script><rect width="1" height="1"/></svg>`;

  it("applies preset-default by default", async () => {
    const output = await processSVG(svg);
    expect(output).not.toContain("<!--comment-->");
    expect(output).toContain("<title>title</title>");
  });

  it("uses custom plugins instead of the preset", async () => {
    const output = await processSVG(svg, {
      svg: { optimize: { plugins: ["removeTitle"] } },
    });
    expect(output).not.toContain("<title>");
    expect(output).toContain("<!--comment-->");
    // Sanitization is applied before the configured plugins
    expect(output).not.toContain("<script");
  });

  it("uses no plugins when configured with an empty list", async () => {
    const output = await processSVG(svg, {
      svg: { optimize: { plugins: [] } },
    });
    expect(output).toContain("<!--comment-->");
    expect(output).toContain("<title>title</title>");
    expect(output).not.toContain("<script");
  });

  it("skips optimization when disabled", async () => {
    const output = await processSVG(svg, { svg: { optimize: false } });
    expect(output).toContain("<!--comment-->");
    expect(output).toContain("<title>title</title>");
    expect(output).not.toContain("<script");
  });

  it("throws a 400 for unparsable svg", async () => {
    // Unescaped `&` is invalid XML but common in the wild
    const svg = `<svg ${svgAttrs}><image href="https://example.com/i?a=1&b=2" width="1" height="1"/></svg>`;
    const ipx = createIPX({ storage: inlineStorage(svg) });
    await expect(ipx("test.svg").process()).rejects.toMatchObject({
      statusCode: 400,
      statusText: "IPX_INVALID_SVG",
    });
  });
});

it("svg.unsafeSkipSanitize opts out of sanitization", async () => {
  const svg = `<svg ${svgAttrs}><script>alert(1)</script></svg>`;

  // Optimization still runs
  expect(
    await processSVG(svg, { svg: { unsafeSkipSanitize: true } }),
  ).toContain("<script>alert(1)</script>");

  // With optimization disabled too, the source is served as-is
  expect(
    await processSVG(svg, {
      svg: { optimize: false, unsafeSkipSanitize: true },
    }),
  ).toBe(svg);
});
