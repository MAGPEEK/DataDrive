import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 30, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 3],
    },
  },
  {
    // React components are mostly markup; they may be longer, but stay small and focused.
    files: ["apps/web/**/*.tsx"],
    rules: {
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "max-lines-per-function": "off", "max-params": "off" },
  },
);
