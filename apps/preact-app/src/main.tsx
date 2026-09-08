import { useEffect, useState } from "preact/hooks";
import { render } from "preact";

const BASE = "https://jsonplaceholder.typicode.com";
const scenarios = ["Promise.all", "Chain", "POST", "404"] as const;
function App() {
  const [log, setLog] = useState<string[]>([]);
  const fire = async (name: (typeof scenarios)[number]): Promise<void> => {
    setLog((entries) => [...entries, `${name} fired`]);
    if (name === "Promise.all")
      await Promise.all([fetch(`${BASE}/todos/1`), fetch(`${BASE}/posts/1`)]);
    if (name === "Chain") await fetch(`${BASE}/todos/3`).then(() => fetch(`${BASE}/albums/1`));
    if (name === "POST")
      await fetch(`${BASE}/posts`, { method: "POST", body: JSON.stringify({ title: "hi" }) });
    if (name === "404") await fetch(`${BASE}/todos/99999`);
  };
  useEffect(() => void fire("Promise.all"), []);
  return (
    <main>
      <h1>vite-http-tracker · Preact</h1>
      <p>
        Dashboard: <code>http://localhost:4000/?token=dev</code>
      </p>
      <p>Click a scenario to emit HTTP calls.</p>
      {scenarios.map((scenario) => (
        <button key={scenario} onClick={() => void fire(scenario)}>
          {scenario}
        </button>
      ))}
      <ul>
        {log.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </main>
  );
}

render(<App />, document.getElementById("app")!);
