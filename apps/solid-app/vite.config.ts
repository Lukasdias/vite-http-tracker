import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteHttpTracker } from "@vite-http-tracker/plugin";

export default defineConfig({ plugins: [solid(), viteHttpTracker()], server: { port: 5175 } });
