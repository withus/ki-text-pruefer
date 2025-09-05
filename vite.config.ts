import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// GitHub Pages liefert das Projekt unter /ki-text-pruefer/ aus
export default defineConfig({
  base: "/ki-text-pruefer/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
