import type { ConnectionState } from "./transport.js";

export interface IndicatorOptions {
  logoUrl: string;
  dashboardUrl: string;
}

const TAG_NAME = "vite-http-tracker-indicator";

const labels: Record<ConnectionState, string> = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
};

export interface ConnectionIndicator {
  setState: (state: ConnectionState) => void;
  remove: () => void;
}

export function mountIndicator(options: IndicatorOptions): ConnectionIndicator | undefined {
  if (typeof document === "undefined" || !document.body) return undefined;

  const host = document.createElement(TAG_NAME);
  host.style.display = "contents";
  const root = host.attachShadow({ mode: "open" });
  const link = document.createElement("a");
  const image = document.createElement("img");
  const status = document.createElement("span");

  link.href = options.dashboardUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = "vite-http-tracker: Connecting";
  link.setAttribute("aria-label", "vite-http-tracker: Connecting");
  image.src = options.logoUrl;
  image.alt = "vite-http-tracker";
  status.setAttribute("role", "status");
  status.textContent = labels.connecting;
  link.append(image, status);
  root.append(
    Object.assign(document.createElement("style"), {
      textContent:
        ':host { all: initial; } a { position: fixed; z-index: 2147483647; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid #334155; border-radius: 999px; background: #0f172a; color: #cbd5e1; font: 12px system-ui, sans-serif; text-decoration: none; box-shadow: 0 3px 12px #0006; } img { width: 16px; height: 16px; } span::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #f5a623; } a[data-state="connected"] span::before { background: #4ad295; } a[data-state="disconnected"] span::before { background: #ef6b73; }',
    }),
    link,
  );
  document.body.append(host);

  const setState = (state: ConnectionState): void => {
    const label = labels[state];
    status.textContent = label;
    link.dataset.state = state;
    link.title = `vite-http-tracker: ${label}`;
    link.setAttribute("aria-label", `vite-http-tracker: ${label}`);
  };
  return { setState, remove: () => host.remove() };
}
