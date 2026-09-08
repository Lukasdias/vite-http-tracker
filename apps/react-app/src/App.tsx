import { useEffect, useState } from "react";

const BASE = "https://jsonplaceholder.typicode.com";
const DELAYED = "https://httpbin.org/delay/3";
const json = (r: Response) => r.json();
const poolFetch = (poolId: string, url: string) =>
  fetch(url, { headers: { "x-http-tracker-pool-id": poolId } }).then(json);

function sseScenario(): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = new EventSource("https://stream.wikimedia.org/v2/stream/recentchange");
    let messages = 0;
    const timer = window.setTimeout(() => {
      source.close();
      resolve();
    }, 5000);
    source.onmessage = () => {
      messages += 1;
      if (messages >= 2) {
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
}

function websocketScenario(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://echo.websocket.events");
    const timer = window.setTimeout(() => {
      socket.close();
      resolve();
    }, 5000);
    socket.onopen = () => socket.send(JSON.stringify({ source: "vite-http-tracker" }));
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
}

const scenarios = {
  all: () =>
    Promise.all([fetch(`${BASE}/todos/1`).then(json), fetch(`${BASE}/posts/1`).then(json)]),
  allSettled: () =>
    Promise.allSettled([
      fetch(`${BASE}/comments/1`).then(json),
      fetch(`${BASE}/users/1`).then(json),
    ]),
  chain: () =>
    fetch(`${BASE}/todos/3`)
      .then(json)
      .then(() => fetch(`${BASE}/albums/1`))
      .then(json),
  deepChain: () =>
    fetch(`${BASE}/users/2`)
      .then(json)
      .then(() => fetch(`${BASE}/photos/1`))
      .then(json)
      .then(() => fetch(`${BASE}/todos/5`)),
  post: () =>
    fetch(`${BASE}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "hi", body: "x", userId: 1 }),
    }).then(json),
  notFound: () => fetch(`${BASE}/todos/99999`).then(json),
  error: () => fetch("http://127.0.0.1:4999/unavailable").then(json),
  timeout: async () => {
    const controller = new AbortController();
    window.setTimeout(() => controller.abort(), 250);
    await fetch(DELAYED, { signal: controller.signal });
  },
  pool: () => Promise.all([1, 2, 3].map((id) => poolFetch("users", `${BASE}/users/${id}`))),
  sse: sseScenario,
  websocket: websocketScenario,
} as const;

type ScenarioKey = keyof typeof scenarios;

const labels: Record<ScenarioKey, string> = {
  all: "Promise.all",
  allSettled: "Promise.allSettled",
  chain: "Chain",
  deepChain: "Deep chain",
  post: "POST",
  notFound: "404",
  error: "Network error",
  timeout: "Timeout",
  pool: "HTTP pool",
  sse: "SSE stream",
  websocket: "WebSocket stream",
};

export function App() {
  const [log, setLog] = useState<string[]>([]);

  // Demonstrate Strict Mode ×2 on load: an effect fires twice in dev.
  useEffect(() => {
    void scenarios.all();
  }, []);

  const fire = async (key: ScenarioKey) => {
    setLog((l) => [...l, `${labels[key]} fired`]);
    try {
      await scenarios[key]();
    } catch {
      setLog((l) => [...l, `${labels[key]} error`]);
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>vite-http-tracker sample</h1>
      <p>
        Open the dashboard at <code>http://localhost:4000/?token=dev</code>.
      </p>
      <p style={{ color: "#888" }}>
        On load, a <code>Promise.all</code> runs inside an effect (Strict Mode doubles it → ×2
        groups). Click a scenario to fire it on demand.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "1rem 0" }}>
        {(Object.keys(scenarios) as ScenarioKey[]).map((key) => (
          <button
            key={key}
            onClick={() => fire(key)}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      <ul style={{ fontFamily: "monospace", fontSize: "12px", color: "#666" }}>
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
