import type { DomainNode } from "../graph.js";
import type { RecordFilter } from "../graph.js";
import { useI18n } from "../i18n.js";
import { FilterCombobox } from "./FilterCombobox.js";

export interface LegendProps {
  domains: DomainNode[];
  domainOptions: string[];
  filter: RecordFilter;
  onFilterChange: (filter: RecordFilter) => void;
  onClose: () => void;
}

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OTHER"];
const transports = ["fetch", "xhr", "sse", "websocket"] as const;

export function Legend({ domains, domainOptions, filter, onFilterChange, onClose }: LegendProps) {
  const { t } = useI18n();
  const hasFilters = Boolean(
    filter.domains?.length ||
    filter.methods?.length ||
    filter.transports?.length ||
    filter.status ||
    filter.url,
  );
  if (!domainOptions.length && !hasFilters) return null;
  return (
    <div className="absolute bottom-4 left-4 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-box border border-base-300 bg-base-100/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-3 space-y-2 border-b border-base-300 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            {t("filters")}
          </h3>
          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onFilterChange({})}
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
        <FilterCombobox
          label={t("domains")}
          placeholder={t("allDomains")}
          options={domainOptions}
          selected={filter.domains ?? []}
          onChange={(domains) => onFilterChange({ ...filter, domains, domain: undefined })}
        />
        <div className="grid grid-cols-2 gap-2">
          <FilterCombobox
            label={t("methods")}
            placeholder={t("allMethods")}
            options={methods}
            selected={filter.methods ?? []}
            onChange={(methods) => onFilterChange({ ...filter, methods, method: undefined })}
          />
          <FilterCombobox
            label={t("transport")}
            placeholder={t("allTransports")}
            options={transports}
            selected={filter.transports ?? []}
            onChange={(selected) =>
              onFilterChange({ ...filter, transports: selected, transport: undefined })
            }
          />
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
              {t("status")}
            </span>
            <input
              className="input input-sm input-bordered w-full bg-base-100 text-base-content"
              value={filter.status ?? ""}
              placeholder="404"
              onChange={(event) =>
                onFilterChange({ ...filter, status: event.target.value || undefined })
              }
              aria-label={t("status")}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
              URL
            </span>
            <input
              className="input input-sm input-bordered w-full bg-base-100 text-base-content"
              value={filter.url ?? ""}
              placeholder={t("searchUrl")}
              onChange={(event) =>
                onFilterChange({ ...filter, url: event.target.value || undefined })
              }
              aria-label="URL"
              autoComplete="off"
            />
          </label>
        </div>
      </div>
      {domains.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {t("domains")}
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onClose}
              aria-label={t("closeLegend")}
            >
              ×
            </button>
          </div>
          <ul className="space-y-1.5">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-base-200 ${filter.domains?.includes(d.domain) ? "bg-primary/10 text-primary" : ""}`}
                  onClick={() => {
                    const next = filter.domains?.includes(d.domain)
                      ? (filter.domains ?? []).filter((domain) => domain !== d.domain)
                      : [...(filter.domains ?? []), d.domain];
                    onFilterChange({ ...filter, domains: next, domain: undefined });
                  }}
                >
                  <span
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate font-mono">{d.domain}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 border-t border-base-300 pt-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          {t("signals")}
        </h3>
        <ul className="space-y-1.5 text-xs text-base-content/75">
          <li className="flex items-center gap-2">
            <span className="badge badge-error badge-xs" />
            {t("failure")}
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-warning badge-xs" />
            {t("timeout")}
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-info badge-xs" />
            {t("pool")}
          </li>
          <li className="flex items-center gap-2">
            <span className="badge badge-ghost badge-xs">SSE/WS</span>
            {t("transport")}
          </li>
        </ul>
      </div>
    </div>
  );
}
