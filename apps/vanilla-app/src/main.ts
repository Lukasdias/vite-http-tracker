const BASE = "https://jsonplaceholder.typicode.com";
const scenarios = ["Promise.all", "Chain", "POST", "404"] as const;
const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing app root");
const log = document.createElement("ul");
app.innerHTML = `<h1>vite-http-tracker · Vanilla</h1><p>Dashboard: <code>http://localhost:4000/?token=dev</code></p><p>Click a scenario to emit HTTP calls.</p>`;
for (const name of scenarios) {
  const button = document.createElement("button");
  button.textContent = name;
  button.onclick = () => void fire(name);
  app.append(button);
}
app.append(log);

async function fire(name: (typeof scenarios)[number]): Promise<void> {
  const entry = document.createElement("li");
  entry.textContent = `${name} fired`;
  log.append(entry);
  if (name === "Promise.all")
    await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
  if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
  if (name === "POST")
    await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
  if (name === "404") await fetch(`${BASE}/todos/99999`);
}

void fire("Promise.all");
