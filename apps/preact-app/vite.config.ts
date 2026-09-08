import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({ plugins: [preact(), viteHttpTracker()], server: { port: 5177 } });
