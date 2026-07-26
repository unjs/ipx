import unjs from "eslint-config-unjs";

// https://github.com/unjs/eslint-config
export default unjs({
  ignores: [
  "alias"
],
  rules: {
  "unicorn/prefer-top-level-await": 0,
  "unicorn/no-process-exit": 0,
  "unicorn/prevent-abbreviations": 0,
  "unicorn/no-null": 0,
  "no-undef": 0
},
});