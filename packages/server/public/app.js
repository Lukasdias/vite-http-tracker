const rows = document.getElementById("rows");
const token = new URLSearchParams(location.search).get("token") ?? "dev";
const ws = new WebSocket(`ws://127.0.0.1:${location.port}/ws?token=${token}`);

ws.onopen = () => console.log("connected");
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === "snapshot") msg.records.forEach(render);
  else if (msg.type === "records") msg.records.forEach(render);
  else if (msg.type === "clear") rows.innerHTML = "";
};

function render(r) {
  const tr = document.createElement("tr");
  const mk = (x) => {
    const t = document.createElement("td");
    t.textContent = x;
    return t;
  };
  const m = document.createElement("td");
  m.className = "m " + (["GET", "POST", "PUT", "DELETE"].includes(r.method) ? r.method : "OTHER");
  m.textContent = r.method;
  tr.append(
    mk(new Date(r.startTime).toLocaleTimeString()),
    m,
    mk(r.url),
    mk(String(r.status)),
    mk(String(r.duration)),
  );
  rows.append(tr);
}

document.getElementById("clear").onclick = () => ws.send(JSON.stringify({ type: "clear", token }));
