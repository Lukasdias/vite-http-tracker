import { useEffect } from "react";

const BASE = "https://jsonplaceholder.typicode.com";

export function App() {
  useEffect(() => {
    void fetch(`${BASE}/todos/1`).then((r) => r.json());
    void fetch(`${BASE}/users/1`).then((r) => r.json());
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>http-tracker sample</h1>
      <p>Open the dashboard at http://localhost:4000 (?token=dev).</p>
      <p>
        Strict Mode is on, so each fetch in this effect fires <strong>twice</strong> (mount →
        unmount → re-mount) — a good demonstration of the Strict-Mode duplicate signal.
      </p>
    </main>
  );
}
