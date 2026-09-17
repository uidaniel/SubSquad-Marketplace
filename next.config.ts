import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Kept out of the server bundle and required from node_modules instead.
   *
   * Netlify serves every route from one function, so anything bundled into the
   * server chunk is loaded on every cold start — including on the sign-in page,
   * which needs none of it. `@react-pdf/renderer` drags in fontkit and pdfkit,
   * about 8MB, and that pushed cold starts from ~150MB to ~250MB and made
   * roughly half of them fail with an unhandled rejection.
   *
   * Listing it here means it is only read when a contract is actually
   * rendered, which is once per accepted deal rather than once per deploy.
   */
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
