import type { RecordGroup } from "./graph.js";

export interface DomainGroup {
  domain: string;
  color: string;
  groups: RecordGroup[];
}

export const UNKNOWN_DOMAIN = "(unknown)";

export const DOMAIN_COLORS = [
  "#4ad295",
  "#54a7ff",
  "#c07af0",
  "#ff6b6b",
  "#ffb84d",
  "#f0e14a",
  "#4dd0e1",
  "#f06292",
  "#aed581",
  "#7986cb",
  "#ff8a65",
  "#9575cd",
];

export function domainOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || UNKNOWN_DOMAIN;
  } catch {
    const m = url.match(/^https?:\/\/([^/?#]+)/i);
    if (m?.[1]) return m[1];
    return UNKNOWN_DOMAIN;
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function partitionByDomain(groups: RecordGroup[]): DomainGroup[] {
  const byDomain = new Map<string, RecordGroup[]>();
  for (const g of groups) {
    const d = domainOf(g.canonical.url);
    const list = byDomain.get(d) ?? [];
    list.push(g);
    byDomain.set(d, list);
  }
  const entries = [...byDomain.entries()].map(([domain, gs]) => ({
    domain,
    groups: [...gs].sort((a, b) => a.canonical.seq - b.canonical.seq),
  }));
  entries.sort((a, b) => {
    const aSeq = Math.min(...a.groups.map((g) => g.canonical.seq));
    const bSeq = Math.min(...b.groups.map((g) => g.canonical.seq));
    if (aSeq !== bSeq) return aSeq - bSeq;
    return a.domain.localeCompare(b.domain);
  });
  return entries.map((e, i) => ({
    ...e,
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length] ?? "#3a3f4b",
  }));
}
