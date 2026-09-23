// Determinism and boundary rules (C-02, C-05, C-06; 02_ENGINE.md §4). Engine-lint is a CI gate.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const deterministic = {
  "no-restricted-globals": ["error",
    { name: "Date", message: "No wall clock in rule code (P-07)." },
    { name: "setTimeout", message: "No timers in rule code." },
    { name: "setInterval", message: "No timers in rule code." },
    { name: "Intl", message: "Locale-dependent behaviour is forbidden in rule code." },
    { name: "crypto", message: "Randomness only via core/rng (P-09)." },
    { name: "process", message: "No host access in rule code." },
    { name: "fetch", message: "No I/O in rule code." }],
  "no-restricted-properties": ["error",
    { object: "Math", property: "random", message: "Randomness only via core/rng (P-09)." },
    { object: "Date", property: "now", message: "No wall clock in rule code." }],
  "no-restricted-syntax": ["error",
    { selector: "ForInStatement", message: "No object-key iteration in rule logic; use arrays (§4)." },
    { selector: "CallExpression[callee.property.name='localeCompare']", message: "Locale-dependent comparison." },
    { selector: "BinaryExpression[operator='/'][right.type='Literal'][right.raw=/\\./]", message: "Integer arithmetic only." }],
};

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "app/**", "backend/api/**", "**/*.config.ts", "**/scripts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { files: ["shared/engine/src/**/*.ts"], rules: deterministic },
  {
    files: ["shared/engine/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["node:*", "@tashzone/*", "ws", "pg", "react", "react-native"], message: "Engine imports only pinned pure crypto." },
      ] }],
    },
  },
  {
    // C-05: bots see views only — no game internals, no network, no server code (engine/src/bots, v1 layout)
    files: ["shared/engine/src/bots/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["node:*", "@tashzone/*", "ws", "pg", "react", "react-native"], message: "Engine imports only pinned pure crypto." },
        { group: ["../games/*", "../testing*", "../profiles/*"], message: "Bots import engine view APIs only (core/contract, core/types, core/botrng)." },
      ] }],
    },
  },
);
