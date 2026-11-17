"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { newPage, type Page } from "@/lib/types";

export function PageTree() {
  const { pages, savePage } = useStore();
  const router = useRouter();
  const params = { id: useSearchParams().get("id") ?? undefined };
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const children = useMemo(() => {
    const m = new Map<string | null, Page[]>();
    for (const p of pages.filter((p) => !p.daily_date)) {
      m.set(p.parent_id, [...(m.get(p.parent_id) ?? []), p]);
    }
    for (const l of m.values()) l.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [pages]);

  const dailies = pages.filter((p) => p.daily_date).sort((a, b) => b.daily_date!.localeCompare(a.daily_date!));

  const add = (parent: string | null) => {
    const p = newPage({ parent_id: parent });
    savePage(p);
    if (parent) setOpen((s) => new Set(s).add(parent));
    router.push(`/notes?id=${p.id}`);
  };

  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const results = q.trim()
    ? pages.filter((p) => (p.title + " " + p.plain_text).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30)
    : null;

  const renderNode = (p: Page, depth: number): React.ReactNode => {
    const kids = children.get(p.id) ?? [];
    const isOpen = open.has(p.id);
    return (
      <li key={p.id}>
        <div className={`group flex items-center rounded-md text-sm hover:bg-panel-2 ${params.id === p.id ? "bg-panel-2" : ""}`} style={{ paddingLeft: depth * 12 }}>
          <button className="w-5 h-6 text-muted text-xs shrink-0" onClick={() => toggleOpen(p.id)}>
            {kids.length ? (isOpen ? "▾" : "▸") : "•"}
          </button>
          <Link href={`/notes?id=${p.id}`} className="flex-1 truncate py-1">
            {p.title || "Untitled"}
          </Link>
          <button className="px-1.5 text-muted md:opacity-0 group-hover:opacity-100" title="Add sub-page" onClick={() => add(p.id)}>
            +
          </button>
        </div>
        {isOpen && kids.length > 0 && <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
      {results ? (
        <ul className="space-y-0.5">
          {results.map((p) => (
            <li key={p.id}>
              <Link href={`/notes?id=${p.id}`} className="block rounded-md px-2 py-1 text-sm hover:bg-panel-2 truncate" onClick={() => setQ("")}>
                {p.title || "Untitled"}
              </Link>
            </li>
          ))}
          {!results.length && <li className="text-sm text-muted px-2">No matches</li>}
        </ul>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-xs text-muted">
            Pages
            <button className="hover:text-text" onClick={() => add(null)}>+ New page</button>
          </div>
          <ul>{(children.get(null) ?? []).map((p) => renderNode(p, 0))}</ul>
          {dailies.length > 0 && (
            <>
              <div className="px-1 text-xs text-muted pt-2">Daily notes</div>
              <ul>
                {dailies.slice(0, 14).map((p) => (
                  <li key={p.id}>
                    <Link href={`/notes?id=${p.id}`} className={`block rounded-md px-2 py-1 text-sm hover:bg-panel-2 truncate ${params.id === p.id ? "bg-panel-2" : ""}`}>
                      {p.title || "Untitled"}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
