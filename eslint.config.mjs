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
