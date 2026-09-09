import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: false,
  build: {
    outDir: "public/dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/client/main.ts"),
      name: "SkiFreeClient",
      formats: ["es"],
      fileName: () => "bundle.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    target: "esnext",
    minify: "esbuild"
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"]
  }
});
