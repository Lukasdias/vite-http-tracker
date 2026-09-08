import { render } from "solid-js/web";
import { createSignal, onMount, For } from "solid-js";

const BASE = "https://jsonplaceholder.typicode.com";
const scenarios = ["Promise.all", "Chain", "POST", "404"] as const;
function App() {
  const [log, setLog] = createSignal<string[]>([]);
  const fire = async (name: (typeof scenarios)[number]): Promise<void> => {
    setLog((entries) => [...entries, `${name} fired`]);
    if (name === "Promise.all")
      await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
    if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
    if (name === "POST")
      await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
    if (name === "404") await fetch(`${BASE}/todos/99999`);
  };
  onMount(() => void fire("Promise.all"));
  return (
    <main>
      <h1>vite-http-tracker · Solid</h1>
      <p>
        Dashboard: <code>http://localhost:4000/?token=dev</code>
      </p>
      <p>Click a scenario to emit HTTP calls.</p>
      <For each={scenarios}>
        {(scenario) => <button onClick={() => void fire(scenario)}>{scenario}</button>}
      </For>
      <ul>
        <For each={log()}>{(line) => <li>{line}</li>}</For>
      </ul>
    </main>
  );
}

render(() => <App />, document.getElementById("root")!);
