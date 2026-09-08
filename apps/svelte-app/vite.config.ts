import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({ plugins: [svelte(), viteHttpTracker()], server: { port: 5176 } });
