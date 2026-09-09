import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".venv/**",
      ".claude/**",
      "bulk_upload/**",
      "certificates/**",
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
  {
    // Standalone CommonJS scripts, run directly with `node scripts/<name>.js`
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
