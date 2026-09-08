import { defineConfig } from "vite";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({ plugins: [viteHttpTracker()], server: { port: 5178 } });
