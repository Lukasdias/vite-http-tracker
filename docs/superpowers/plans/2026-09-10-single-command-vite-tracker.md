# Single-Command Vite Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published dashboard load all UI assets and make `vite dev` start and stop the tracker automatically through the Vite plugin.

**Architecture:** Keep the tracker server as a separate local HTTP/WebSocket sidecar, but make its runtime Node-compatible so the Vite plugin can import and start it in the same Node process. Resolve published and workspace UI asset locations explicitly; the user-facing package has no separate CLI.

**Tech Stack:** TypeScript, Vite plugin API, Node `http`/`child_process`, `ws`, Bun test runner for repository tests, Vite production build.

**Spec:** User requirement stated in conversation: one normal Vite development command; no required second `bunx` command; published UI CSS must load.

## Global Constraints

- The server must bind to `127.0.0.1` only.
- The token remains required for event ingestion and WebSocket upgrades.
- The published package must not require Bun at runtime.
- The Vite plugin starts the server during `vite dev` and closes it with Vite.
- There is no separate CLI or second command in the user-facing workflow.
- No commit or push is performed.

---

### Task 1: Lock down published UI asset resolution

**Files:**
- Modify: `packages/server/src/server.ts`
- Test: `packages/server/src/server.test.ts`

**Interfaces:**
- Preserve `startServer(opts)` and its return type.
- Add a test-visible request path that proves `/assets/index.css` is served from the published layout when the workspace layout is absent.

- [ ] **Step 1: Write a failing regression test** for static asset resolution in the published `dist/ui/dist` layout.
- [ ] **Step 2: Run the focused server test and confirm it fails because the current `../../ui/dist` path misses the published asset directory.**
- [ ] **Step 3: Resolve UI assets from both workspace and published layouts using explicit candidate directories, preserving SPA fallback behavior.**
- [ ] **Step 4: Run the focused test and confirm it passes.**
- [ ] **Step 5: Build the UI and publish output to verify the generated CSS is present at the path served by the server.**

### Task 2: Make the tracker server Node-compatible

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/package.json`
- Modify: `package.json`
- Modify: `scripts/build-publish.ts`
- Test: `packages/server/src/server.test.ts`
- Test: `packages/server/src/e2e.test.ts`

**Interfaces:**
- Preserve `ServerOptions`, `startServer`, token semantics, HTTP routes, WebSocket protocol, and `close()`.
- Replace Bun-only server/file APIs with Node-compatible APIs and `ws`.
- Remove the obsolete CLI entry point and package bin.

- [ ] **Step 1: Add a focused runtime/protocol test that starts `startServer` without relying on Bun globals and verifies HTTP plus WebSocket behavior.**
- [ ] **Step 2: Run the focused test and confirm the pre-migration implementation cannot satisfy the Node runtime boundary.**
- [ ] **Step 3: Implement the smallest Node HTTP server and WebSocket adapter preserving existing routes, auth, broadcast, snapshot, clear, and shutdown semantics.**
- [ ] **Step 4: Update package dependencies and publish rewriting for the Node runtime.**
- [ ] **Step 5: Run server tests and the publish build.**

### Task 3: Start and stop the server from the Vite plugin

**Files:**
- Modify: `packages/plugin/src/index.ts`
- Modify: `packages/plugin/package.json`
- Modify: `packages/plugin/src/index.test.ts`

**Interfaces:**
- Extend `ViteHttpTrackerOptions` with `port?: number`.
- `viteHttpTracker()` starts the sidecar from `configureServer`, logs its dashboard URL through Vite, and closes it from `httpServer` shutdown.
- `autoInject: false` disables both injection and automatic server startup.

- [ ] **Step 1: Write failing plugin tests proving automatic startup is wired only when injection is enabled and shutdown is registered.**
- [ ] **Step 2: Run the focused plugin tests and confirm they fail before the lifecycle hook exists.**
- [ ] **Step 3: Import the server entry point, start it from `configureServer`, and register idempotent shutdown handling.**
- [ ] **Step 4: Pass the configured token into the agent and server consistently, and preserve explicit `serverUrl` behavior.**
- [ ] **Step 5: Run plugin tests and a sample Vite dev smoke test.**

### Task 4: Update published package metadata and user documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Document the single-command setup as the primary workflow.
- Document `port`, `serverUrl`, and `autoInject` accurately.
- Remove all instructions for a separate CLI or second command.

- [ ] **Step 1: Update README setup and troubleshooting examples to use the Vite dev command alone.**
- [ ] **Step 2: Update runtime metadata so Bun is not an engine requirement for package consumers.**
- [ ] **Step 3: Run formatting, linting, typechecking, tests, and production publish build.**

### Verification checklist

- [ ] Published `dist/ui/dist/index.html` references an existing CSS asset.
- [ ] A request to the published server's CSS asset returns `200` and `text/css`.
- [ ] `viteHttpTracker()` starts the sidecar during Vite dev.
- [ ] Vite shutdown closes the sidecar.
- [ ] Existing token and WebSocket tests remain green.
- [ ] No user-facing setup step requires a second `bunx` command.
