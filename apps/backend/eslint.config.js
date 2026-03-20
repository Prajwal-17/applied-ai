import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config} */

export default {
  ...config,
  rules: {
    files: ["**/*.ts", "**/*.tsx"],
    "@typescript-eslint/ban-ts-comment": ["error"],
    ...config.rules,
  },
};
