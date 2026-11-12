import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Mismo stack que el switch de referencia (MARQ): React + Motion + Tailwind sobre Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: "public",
  build: { outDir: "dist", assetsInlineLimit: 0 },
});
