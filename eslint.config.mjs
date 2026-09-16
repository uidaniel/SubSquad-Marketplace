import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next ships as a legacy shareable config in 15; FlatCompat is the
// supported bridge to flat config. (create-next-app generated the 16 form, which
// does not resolve against the pinned version.)
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      ".trigger/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
