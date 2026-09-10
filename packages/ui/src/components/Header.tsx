import { Logo } from "./Logo.js";
import { isLocale, useI18n } from "../i18n.js";

export interface HeaderProps {
  connected: boolean;
  total: number;
  visible: number;
  batches: number;
  duplicates: number;
}

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

export function Header({ connected, total, visible, batches, duplicates }: HeaderProps) {
  const { locale, locales, localeLabels, setLocale, t } = useI18n();
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

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <ConnectionBadge connected={connected} />

          <label className="sr-only" htmlFor="language-select">
            {t("language")}
          </label>
          <select
            id="language-select"
            className="select select-sm select-bordered w-40 max-w-40 truncate overflow-hidden bg-base-100 text-base-content text-ellipsis whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={locale}
            title={localeLabels[locale]}
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
        </div>
      </div>
    </header>
  );
}
