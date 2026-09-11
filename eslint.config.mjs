import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".claude/**",
      "certificates/**",
      // Separate project, not webapp source — see wikipoell-ingest/README.md
      "wikipoell-ingest/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  prettier,
  {
    rules: {
      semi: ["error", "always"],
      "no-extra-semi": "error",
      "semi-spacing": ["error", { before: false, after: true }],
      // `const { dropMe, ...rest } = obj` is the idiom used across this
      // codebase to omit keys; `_name` marks a binding that exists only to
      // be discarded.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
