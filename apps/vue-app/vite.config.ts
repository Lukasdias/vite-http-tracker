import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({
  plugins: [vue(), viteHttpTracker()],
  server: { port: 5174 },
});
