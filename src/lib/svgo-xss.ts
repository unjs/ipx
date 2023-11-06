import type { CustomPlugin } from "svgo";

/**
 * Remove possible XSS attacks.
 *
 * * Remove <script> elements.
 * * Removes known event attributes.
 * * Removes JavaScript URIs.
 *
 * @author Katya Pavlenko (@cakeinpanic)
 *
 * Based on https://github.com/svg/svgo/blob/main/plugins/removeScriptElement.js
 */
export const xss = {
  name: "removeXSS",
  fn() {
    return {
      element: {
        enter: (node, parentNode) => {
          if (node.name === "script") {
            // Avoid splice to not break for loops
            parentNode.children = parentNode.children.filter(
              (child) => child !== node,
            );
            return;
          }
          for (const event of ALL_EVENTS) {
            if (node.attributes[event] != null) {
              delete node.attributes[event];
            }
          }
        },
        exit: (node, parentNode) => {
          if (node.name !== "a") {
            return;
          }

          for (const attr of Object.keys(node.attributes)) {
            if (attr === "href" || attr.endsWith(":href")) {
              if (
                node.attributes[attr] == null ||
                !node.attributes[attr].trimStart().startsWith("javascript:")
              ) {
                continue;
              }

              const index = parentNode.children.indexOf(node);
              parentNode.children.splice(index, 1, ...node.children);

              for (const child of node.children) {
                Object.defineProperty(child, "parentNode", {
                  writable: true,
                  value: parentNode,
                });
              }
            }
          }
        },
      },
    };
  },
} satisfies CustomPlugin;

const ALL_EVENTS = [
  "onabort",
  "onactivate",
  "onbegin",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncopy",
  "oncuechange",
  "oncut",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onend",
  "onended",
  "onerror",
  "onfocus",
  "onfocusin",
  "onfocusout",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onmousewheel",
  "onpaste",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onrepeat",
  "onreset",
  "onresize",
  "onscroll",
  "onseeked",
  "onseeking",
  "onselect",
  "onshow",
  "onstalled",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "onunload",
  "onvolumechange",
  "onwaiting",
  "onzoom",
];
