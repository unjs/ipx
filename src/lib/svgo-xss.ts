import type { CustomPlugin } from "svgo";

// Source: https://github.com/svg/svgo/pull/1664 by @cakeinpanic

/**
 * Remove possible XSS attacks
 *
 * Sometimes it's not enough just to remove <script> tag, XSS may be hidden under event listeners
 * @author Katya Pavlenko
 *
 * @type {import('../lib/types').Plugin<void>}
 */
export default {
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
            for (const [name] of Object.entries(node.attributes)) {
              if (name === event) {
                delete node.attributes[name];
              }
            }
          }
        },
      },
    };
  },
} satisfies CustomPlugin;

const ALL_EVENTS = [
  "onbegin",
  "onend",
  "onrepeat",
  "onabort",
  "onerror",
  "onresize",
  "onscroll",
  "onunload",
  "onbegin",
  "onend",
  "onrepeat",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncuechange",
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
  "onended",
  "onerror",
  "onfocus",
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
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
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
  "onvolumechange",
  "onwaiting",
  "oncopy",
  "oncut",
  "onpaste",
  "onactivate",
  "onfocusin",
  "onfocusout",
];
