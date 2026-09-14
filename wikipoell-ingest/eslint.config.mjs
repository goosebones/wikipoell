import js from "@eslint/js";
import globals from "globals";

// Standalone Node tooling — no React, no Next, no browser. Rules here answer to
// plain Node, which is why this project does not share the webapp's config.
// Binaries resolve from the repo root's node_modules, so nothing extra to install.
export default [
  {
    ignores: [".venv/**", "legacy/data/**", "legacy/the-library/**"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,
    },
    rules: {
      semi: ["error", "always"],
      // `const { dropMe, ...rest } = obj` is the idiom used to omit keys;
      // `_name` marks a binding that exists only to be discarded.
      "no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Scripts are CommonJS, run directly with node. (.mjs keeps its own default,
    // so this must not be a blanket setting — it would break this config file.)
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
  },
  {
    // The only ESM .js in the project.
    files: ["legacy/agent-review/review.js"],
    languageOptions: { sourceType: "module" },
  },
];
