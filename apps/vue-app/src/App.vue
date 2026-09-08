<script setup lang="ts">
import { onMounted, ref } from "vue";

const BASE = "https://jsonplaceholder.typicode.com";
const scenarios = ["Promise.all", "Chain", "POST", "404"] as const;
const log = ref<string[]>([]);
const fire = async (name: (typeof scenarios)[number]): Promise<void> => {
  log.value = [...log.value, `${name} fired`];
  if (name === "Promise.all")
    await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
  if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
  if (name === "POST")
    await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
  if (name === "404") await fetch(`${BASE}/todos/99999`);
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
