import type { RecordFilter } from "../graph.js";

export interface FilterBarProps {
  filter: RecordFilter;
  onChange: (filter: RecordFilter) => void;
  showEdges: boolean;
  onShowEdges: (v: boolean) => void;
  onClear: () => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OTHER"];

export function FilterBar({ filter, onChange, showEdges, onShowEdges, onClear }: FilterBarProps) {
  return (
    <div className="flex items-end gap-2 p-3">
      <label className="form-control">
        <span className="label-text mb-1 text-xs text-base-content/70">Method</span>
        <select
          className="select select-bordered select-sm"
          value={filter.method ?? ""}
          onChange={(e) => onChange({ ...filter, method: e.target.value || undefined })}
        >
          <option value="">All</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="form-control">
        <span className="label-text mb-1 text-xs text-base-content/70">Status</span>
        <input
          className="input input-bordered input-sm"
          value={filter.status ?? ""}
          placeholder="e.g. 404"
          onChange={(e) => onChange({ ...filter, status: e.target.value || undefined })}
        />
      </label>
      <label className="form-control flex-1">
        <span className="label-text mb-1 text-xs text-base-content/70">URL</span>
        <input
          className="input input-bordered input-sm w-full"
          value={filter.url ?? ""}
          placeholder="Search path"
          onChange={(e) => onChange({ ...filter, url: e.target.value || undefined })}
        />
      </label>
      <label className="flex items-center gap-2 pb-1.5">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={showEdges}
          onChange={(e) => onShowEdges(e.target.checked)}
        />
        <span className="text-xs text-base-content/70">Sequence edges</span>
      </label>
      <button type="button" className="btn btn-sm" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
