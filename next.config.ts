import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Kept out of the server bundle and required from node_modules instead.
   *
   * Netlify serves every route from one function, so anything bundled into the
   * server chunk is loaded on every cold start — including on the sign-in page,
   * which needs none of it. `@react-pdf/renderer` drags in fontkit and pdfkit,
   * about 8MB.
   */
  serverExternalPackages: ["@react-pdf/renderer"],

  /**
   * Ship pdfkit's font files, which nothing can infer are needed.
   *
   * pdfkit builds the path to its standard fonts at runtime, so Next's file
   * tracer never sees a reference to them and leaves them out of the function.
   * The failure is a long way from the cause: the sign-in page 502s with
   * "Cannot find module .../standard-fonts/Helvetica.cjs", because Next loads
   * the server-actions manifest at boot and that resolves the contract module
   * even though nothing on that page renders a PDF.
   */
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pdfkit/js/**/*",
      "./node_modules/fontkit/**/*",
    ],
  },
};

export default nextConfig;
