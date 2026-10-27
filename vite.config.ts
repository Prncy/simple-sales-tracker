import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this project from /simple-sales-tracker/, not the domain root.
  base: "/simple-sales-tracker/",
  plugins: [react()],
});
