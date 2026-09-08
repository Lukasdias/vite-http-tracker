<script lang="ts">
  const BASE = "https://jsonplaceholder.typicode.com";
  const scenarios = ["Promise.all", "Chain", "POST", "404"] as const;
  let log = $state<string[]>([]);
  async function fire(name: (typeof scenarios)[number]): Promise<void> {
    log = [...log, `${name} fired`];
    if (name === "Promise.all") await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
    if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
    if (name === "POST") await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
    if (name === "404") await fetch(`${BASE}/todos/99999`);
  }
  void fire("Promise.all");
</script>

<main><h1>vite-http-tracker · Svelte</h1><p>Dashboard: <code>http://localhost:4000/?token=dev</code></p><p>Click a scenario to emit HTTP calls.</p>{#each scenarios as scenario}<button onclick={() => void fire(scenario)}>{scenario}</button>{/each}<ul>{#each log as line}<li>{line}</li>{/each}</ul></main>
