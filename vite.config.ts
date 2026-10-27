import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages publishes this repository at /simple-sales-tracker/.
  base: "/simple-sales-tracker/",
  plugins: [react()],
});
