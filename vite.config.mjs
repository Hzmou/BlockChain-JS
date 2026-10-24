import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: path.resolve(projectRoot, "public/build"),
    rollupOptions: {
      input: path.resolve(projectRoot, "public/app.js"),
      output: {
        entryFileNames: "app.js",
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
      },
    },
  },
});
