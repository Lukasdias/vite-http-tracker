import type { DomainNode } from "../graph.js";

export interface LegendProps {
  domains: DomainNode[];
  onClose: () => void;
}

export function Legend({ domains, onClose }: LegendProps) {
  if (!domains.length) return null;
  return (
    <div className="absolute bottom-4 left-4 z-30 w-56 rounded-box border border-base-300 bg-base-100/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Domains
        </h3>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onClose}
          aria-label="Close legend"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-xs">
            <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="truncate font-mono text-base-content/80">{d.domain}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
