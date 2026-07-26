import { describe, it, expect } from "vitest";
import { resolve } from "pathe";

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
    name: "SMIL href injection",
    svg: `<svg ${svgAttrs}><a><animate attributeName="xlink:href" values="javascript:alert(1)" dur="1s"/><rect width="1" height="1"/></a></svg>`,
    absent: ["<animate", "javascript:"],
  },
  {
    name: "javascript: link",
    svg: `<svg ${svgAttrs}><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>`,
    absent: ["javascript:"],
    present: ["<rect"],
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
];

// Sanitization must not depend on optimization being enabled
describe.each([
  { name: "svgo enabled", options: undefined },
  { name: "svgo disabled", options: { svgo: false } as const },
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
    expect(output).toContain(`<style>`);
    expect(output).toContain(`<use href="#shape"/>`);
    // External references are kept by design, see readme
    expect(output).toContain(`https://example.com/image.png`);
    expect(output).toContain(`data:image/png;base64,iVBORw0KGgo=`);
    expect(output).toContain(`<animate attributeName="fill"`);
  });
});
