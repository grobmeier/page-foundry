/* Copyright 2026 Christian Grobmeier. Licensed under Apache-2.0. */
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin, obsidianmd },
    rules: {
      "no-control-regex": "error",
      "no-useless-escape": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "obsidianmd/no-global-this": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/prefer-create-el": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/settings-tab/prefer-setting-definitions": "error",
    },
  },
];
