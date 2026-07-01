import { defineConfig } from "vite";

// base: "./" produces relative asset URLs so the same build works both at a
// root domain (Vercel: staxx.vercel.app) and a subpath (GitHub Pages: /Staxx/).
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
