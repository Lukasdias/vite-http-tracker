import type { ReactNode } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  EnterFullScreenIcon,
  LayersIcon,
  Link2Icon,
  MagnifyingGlassIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@radix-ui/react-icons";
import { Logo } from "./Logo.js";
import type { Orientation, RecordFilter } from "../graph.js";
import { isLocale, useI18n } from "../i18n.js";

export interface HeaderProps {
  connected: boolean;
  filter: RecordFilter;
  onChange: (filter: RecordFilter) => void;
  showEdges: boolean;
  onShowEdges: (v: boolean) => void;
  showLegend: boolean;
  onShowLegend: (v: boolean) => void;
  orientation: Orientation;
  onOrientation: (o: Orientation) => void;
  onClear: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  total: number;
  visible: number;
  batches: number;
  duplicates: number;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OTHER"];

const icon = "size-3.5";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3">
      <div className="font-mono text-sm font-semibold leading-none tabular-nums">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-widest text-base-content/45">
        {label}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  danger,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  const base =
    "grid size-7 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  let state =
    "border-base-300 bg-base-200/40 text-base-content/70 hover:bg-base-200 hover:text-base-content";
  if (active) state = "border-primary/50 bg-primary/15 text-primary";
  if (danger) state = "border-error/30 bg-error/10 text-error hover:bg-error/20";
  return (
    <button
      className={`${base} ${state}`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200/50 px-2.5 py-1.5">
      <span className="relative flex size-2">
        {connected ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        ) : null}
        <span
          className={`relative inline-flex size-2 rounded-full ${connected ? "bg-success" : "bg-warning"}`}
        />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-base-content/70">
        {connected ? t("live") : t("offline")}
      </span>
    </div>
  );
}

export function Header({
  connected,
  filter,
  onChange,
  showEdges,
  onShowEdges,
  showLegend,
  onShowLegend,
  orientation,
  onOrientation,
  onClear,
  onFitView,
  onZoomIn,
  onZoomOut,
  total,
  visible,
  batches,
  duplicates,
}: HeaderProps) {
  const { locale, locales, localeLabels, setLocale, t } = useI18n();
  const hasFilters = Boolean(filter.method || filter.transport || filter.status || filter.url);
  return (
    <header className="relative z-20 shrink-0 border-b border-base-300/70 bg-base-100/90 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5">
        <div className="mr-2 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl border border-base-300 bg-gradient-to-br from-base-200 to-base-300 text-primary shadow-sm">
            <Logo className="size-6" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-sm font-semibold tracking-tight">vite-http-tracker</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-base-content/50">
              request graph
            </div>
          </div>
        </div>

        <div className="flex items-center divide-x divide-base-300/60">
          <Stat value={total} label={t("requests")} />
          <Stat value={visible} label={t("shown")} />
          <Stat value={batches} label={t("batches")} />
          <Stat value={duplicates} label={t("dupes")} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1.5">
            <select
              className="select select-sm select-bordered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={filter.method ?? ""}
              onChange={(e) => onChange({ ...filter, method: e.target.value || undefined })}
              aria-label={t("allMethods")}
            >
              <option value="">{t("allMethods")}</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="select select-sm select-bordered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={filter.transport ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                const transport =
                  value === "fetch" || value === "xhr" || value === "sse" || value === "websocket"
                    ? value
                    : undefined;
                onChange({ ...filter, transport });
              }}
              aria-label={t("allTransports")}
            >
              <option value="">{t("allTransports")}</option>
              <option value="fetch">{t("transportHttp")}</option>
              <option value="xhr">XHR</option>
              <option value="sse">{t("transportSse")}</option>
              <option value="websocket">{t("transportWebsocket")}</option>
            </select>
            <input
              className="input input-sm input-bordered w-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={filter.status ?? ""}
              placeholder="404"
              onChange={(e) => onChange({ ...filter, status: e.target.value || undefined })}
              aria-label="Status"
            />
            <label className="input input-sm input-bordered flex w-40 items-center gap-1.5 text-base-content/60 focus-within:ring-2 focus-within:ring-primary">
              <MagnifyingGlassIcon className="size-3.5" />
              <input
                className="min-w-0 grow bg-transparent p-0 text-base-content focus:outline-none focus:ring-0"
                value={filter.url ?? ""}
                placeholder={t("searchUrl")}
                onChange={(e) => onChange({ ...filter, url: e.target.value || undefined })}
                aria-label="URL"
              />
            </label>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => onChange({})}
              >
                {t("clearFilters")}
              </button>
            )}
          </div>

          <ToolButton
            active={showEdges}
            onClick={() => onShowEdges(!showEdges)}
            title={t("showTimelineEdges")}
          >
            <Link2Icon className={icon} />
          </ToolButton>

          <ToolButton
            active={showLegend}
            onClick={() => onShowLegend(!showLegend)}
            title={t("showDomainLegend")}
          >
            <LayersIcon className={icon} />
          </ToolButton>

          <div className="flex gap-1">
            <ToolButton
              active={orientation === "horizontal"}
              onClick={() => onOrientation("horizontal")}
              title={t("horizontalOrientation")}
            >
              <ArrowRightIcon className={icon} />
            </ToolButton>
            <ToolButton
              active={orientation === "vertical"}
              onClick={() => onOrientation("vertical")}
              title={t("verticalOrientation")}
            >
              <ArrowDownIcon className={icon} />
            </ToolButton>
          </div>

          <div className="flex gap-1">
            <ToolButton onClick={onZoomOut} title={t("zoomOut")}>
              <ZoomOutIcon className={icon} />
            </ToolButton>
            <ToolButton onClick={onFitView} title={t("fitView")}>
              <EnterFullScreenIcon className={icon} />
            </ToolButton>
            <ToolButton onClick={onZoomIn} title={t("zoomIn")}>
              <ZoomInIcon className={icon} />
            </ToolButton>
          </div>

          <ConnectionBadge connected={connected} />

          <label className="sr-only" htmlFor="language-select">
            {t("language")}
          </label>
          <select
            id="language-select"
            className="select select-sm select-bordered w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={locale}
            onChange={(event) => {
              if (isLocale(event.target.value)) setLocale(event.target.value);
            }}
            aria-label={t("language")}
          >
            {locales.map((option) => (
              <option key={option} value={option}>
                {localeLabels[option]}
              </option>
            ))}
          </select>

          <ToolButton danger onClick={onClear} title={t("clearRequests")}>
            <TrashIcon className={icon} />
          </ToolButton>
        </div>
      </div>
    </header>
  );
}
