<script setup lang="ts">
import { onMounted, ref } from "vue";

const BASE = "https://jsonplaceholder.typicode.com";
const DELAYED = "https://httpbin.org/delay/3";
const scenarios = [
  "Promise.all",
  "Chain",
  "POST",
  "404",
  "Network error",
  "Timeout",
  "HTTP pool",
  "SSE stream",
  "WebSocket stream",
] as const;
const log = ref<string[]>([]);
const poolFetch = (poolId: string, url: string) =>
  fetch(url, { headers: { "x-http-tracker-pool-id": poolId } });
const sse = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const source = new EventSource("https://stream.wikimedia.org/v2/stream/recentchange");
    let count = 0;
    const timer = window.setTimeout(() => {
      source.close();
      resolve();
    }, 5000);
    source.onmessage = () => {
      count += 1;
      if (count >= 2) {
        window.clearTimeout(timer);
        source.close();
        resolve();
      }
    };
    source.onerror = () => {
      window.clearTimeout(timer);
      source.close();
      reject(new Error("SSE connection failed"));
    };
  });
const websocket = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://echo.websocket.events");
    const timer = window.setTimeout(() => {
      socket.close();
      resolve();
    }, 5000);
    socket.onopen = () => socket.send("vite-http-tracker");
    socket.onmessage = () => {
      window.clearTimeout(timer);
      socket.close();
      resolve();
    };
    socket.onerror = () => {
      window.clearTimeout(timer);
      socket.close();
      reject(new Error("WebSocket connection failed"));
    };
  });
const fire = async (name: (typeof scenarios)[number]): Promise<void> => {
  log.value = [...log.value, `${name} fired`];
  if (name === "Promise.all")
    await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
  if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
  if (name === "POST")
    await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
  if (name === "404") await fetch(`${BASE}/todos/99999`);
  if (name === "Network error") await fetch("http://127.0.0.1:4999/unavailable");
  if (name === "Timeout") {
    const controller = new AbortController();
    window.setTimeout(() => controller.abort(), 250);
    await fetch(DELAYED, { signal: controller.signal });
  }
  if (name === "HTTP pool")
    await Promise.all([1, 2, 3].map((id) => poolFetch("users", `${BASE}/users/${id}`)));
  if (name === "SSE stream") await sse();
  if (name === "WebSocket stream") await websocket();
};
onMounted(() => void fire("Promise.all"));
</script>

<template>
  <main>
    <h1>vite-http-tracker · Vue</h1>
    <p>Dashboard: <code>http://localhost:4000/?token=dev</code></p>
    <p>Click a scenario to emit HTTP calls.</p>
    <button v-for="scenario in scenarios" :key="scenario" @click="fire(scenario)">
      {{ scenario }}
    </button>
    <ul>
      <li v-for="line in log" :key="line">{{ line }}</li>
    </ul>
  </main>
</template>
