import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { httpTracker } from "@http-tracker/plugin";

export default defineConfig({
  plugins: [react(), httpTracker()],
  server: { port: 5173 },
});
