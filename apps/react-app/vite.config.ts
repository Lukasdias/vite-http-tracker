import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({
  plugins: [react(), viteHttpTracker()],
  server: { port: 5173 },
});
