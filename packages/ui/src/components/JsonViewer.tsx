import { useState } from "react";
import type { ReactNode } from "react";
import { jsonString, kindOf } from "../json.js";
import type { JsonKind } from "../json.js";

export interface JsonViewerProps {
  value: unknown;
  defaultDepth?: number;
}

interface Override {
  open: boolean;
}

interface NodeContext {
  isOpen: (path: string, depth: number) => boolean;
  toggle: (path: string, depth: number) => void;
}

type Entry = { key: string; value: unknown };

function entriesOf(value: unknown): Entry[] {
  if (Array.isArray(value)) return value.map((v, i) => ({ key: String(i), value: v }));
  return Object.entries(value as Record<string, unknown>).map(([key, v]) => ({ key, value: v }));
}

function Scalar({ value, kind }: { value: unknown; kind: JsonKind }) {
  if (kind === "string") return <span className="j-string">"{String(value)}"</span>;
  if (kind === "number") return <span className="j-number">{String(value)}</span>;
  if (kind === "boolean") return <span className="j-bool">{String(value)}</span>;
  return <span className="j-null">null</span>;
}

function Container({
  value,
  kind,
  path,
  depth,
  prefix,
  ctx,
}: {
  value: unknown;
  kind: JsonKind;
  path: string;
  depth: number;
  prefix?: ReactNode;
  ctx: NodeContext;
}) {
  const open = ctx.isOpen(path, depth);
  const entries = entriesOf(value);
  const openBrace = kind === "array" ? "[" : "{";
  const closeBrace = kind === "array" ? "]" : "}";
  const label = open ? "" : ` ${entries.length} ${kind}`;

  return (
    <>
      <div
        className="flex cursor-pointer items-start"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => ctx.toggle(path, depth)}
      >
        <span className="mr-1 inline-block w-3 shrink-0 text-center font-mono text-base-content/50">
          {open ? "▾" : "▸"}
        </span>
        <span className="whitespace-pre-wrap break-all">
          {prefix}
          <span className="j-punct">{openBrace}</span>
          <span className="text-base-content/40">{label}</span>
          {!open && <span className="j-punct">{closeBrace}</span>}
        </span>
      </div>
      {open && (
        <>
          {entries.map((entry, i) => (
            <Entry
              key={entry.key}
              entry={entry}
              depth={depth + 1}
              path={`${path}.${i}`}
              ctx={ctx}
            />
          ))}
          <div style={{ paddingLeft: depth * 14 + 20 }} className="j-punct">
            {closeBrace}
          </div>
        </>
      )}
    </>
  );
}

function Entry({
  entry,
  depth,
  path,
  ctx,
}: {
  entry: Entry;
  depth: number;
  path: string;
  ctx: NodeContext;
}) {
  const { key, value } = entry;
  const kind = kindOf(value);
  const keyEl = <span className="j-key">{key}</span>;
  const prefix = (
    <>
      {keyEl}
      <span className="j-punct">: </span>
    </>
  );

  if (kind === "object" || kind === "array") {
    return (
      <Container value={value} kind={kind} path={path} depth={depth} prefix={prefix} ctx={ctx} />
    );
  }

  const nested = jsonString(value);
  if (nested !== undefined) {
    const open = ctx.isOpen(path, depth);
    return (
      <>
        <div
          className="flex cursor-pointer items-start"
          style={{ paddingLeft: depth * 14 }}
          onClick={() => ctx.toggle(path, depth)}
        >
          <span className="mr-1 inline-block w-3 shrink-0 text-center font-mono text-base-content/50">
            {open ? "▾" : "▸"}
          </span>
          <span className="whitespace-pre-wrap break-all">
            {prefix}
            <span className="j-string">"{truncateString(String(value), 40)}"</span>
            <span className="ml-1 rounded-sm bg-base-200 px-1 text-[9px] uppercase tracking-wide text-base-content/45">
              json
            </span>
          </span>
        </div>
        {open && (
          <>
            <RenderNode
              value={JSON.parse(nested) as unknown}
              depth={depth + 1}
              path={`${path}.json`}
              ctx={ctx}
            />
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex items-start" style={{ paddingLeft: depth * 14 }}>
      <span className="inline-block w-4 shrink-0" />
      <span className="whitespace-pre-wrap break-all">
        {prefix}
        <Scalar value={value} kind={kind} />
      </span>
    </div>
  );
}

function RenderNode({
  value,
  depth,
  path,
  ctx,
}: {
  value: unknown;
  depth: number;
  path: string;
  ctx: NodeContext;
}) {
  const kind = kindOf(value);
  if (kind === "object" || kind === "array") {
    return <Container value={value} kind={kind} path={path} depth={depth} ctx={ctx} />;
  }
  return (
    <div className="flex items-start" style={{ paddingLeft: depth * 14 }}>
      <span className="inline-block w-4 shrink-0" />
      <span className="whitespace-pre-wrap break-all">
        <Scalar value={value} kind={kind} />
      </span>
    </div>
  );
}

function truncateString(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function JsonViewer({ value, defaultDepth = 3 }: JsonViewerProps) {
  const [depth, setDepth] = useState(defaultDepth);
  const [overrides, setOverrides] = useState<Map<string, Override>>(() => new Map());

  const ctx: NodeContext = {
    isOpen: (path, d) => {
      const o = overrides.get(path);
      if (o) return o.open;
      return d < depth;
    },
    toggle: (path, d) => {
      setOverrides((prev) => {
        const next = new Map(prev);
        const open = ctx.isOpen(path, d);
        next.set(path, { open: !open });
        return next;
      });
    },
  };

  const reset = (d: number) => {
    setDepth(d);
    setOverrides(new Map());
  };

  return (
    <div className="json-viewer">
      <div className="mb-1 flex items-center gap-1 text-[10px]">
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => reset(Infinity)}>
          expand all
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => reset(0)}>
          collapse
        </button>
      </div>
      <RenderNode value={value} depth={0} path="$0" ctx={ctx} />
    </div>
  );
}
