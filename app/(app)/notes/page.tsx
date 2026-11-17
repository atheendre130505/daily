"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { newPage, type Page } from "@/lib/types";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false, loading: () => <div className="text-muted">Loading editor…</div> });

/** /notes shows the page list; /notes?id=… opens a page (a static site can't have one URL per page). */
function NotesView() {
  const id = useSearchParams().get("id");
  if (!id) return <div className="p-10 text-muted">Pick a page on the left, or create a new one.</div>;
  return <NotePage id={id} />;
}

/** Older links were /notes/<id>; both forms open the page in place. */
function noteIdFromHref(href: string): string | null {
  return href.match(/\/notes\?id=([\w-]+)/)?.[1] ?? href.match(/\/notes\/([\w-]+)/)?.[1] ?? null;
}

function NotePage({ id }: { id: string }) {
  const router = useRouter();
  const { pages, savePage, deletePage } = useStore();
  const page = pages.find((p) => p.id === id);
  if (!page) return <div className="p-10 text-muted">Page not found.</div>;

  const trail: Page[] = [];
  for (let p = page.parent_id ? pages.find((x) => x.id === page.parent_id) : undefined; p; p = p.parent_id ? pages.find((x) => x.id === p!.parent_id) : undefined) {
    trail.unshift(p);
  }
  const kids = pages.filter((p) => p.parent_id === page.id).sort((a, b) => a.sort_order - b.sort_order);
  const latest = () => pages.find((p) => p.id === id) ?? page;

  return (
    <div className="px-4 md:px-16 py-6 md:py-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-1 text-xs text-muted mb-6 flex-wrap">
        <Link href="/notes" className="md:hidden mr-2">‹ Pages</Link>
        {trail.map((p) => (
          <span key={p.id}>
            <Link href={`/notes?id=${p.id}`} className="hover:text-text">{p.title || "Untitled"}</Link> /
          </span>
        ))}
        <div className="flex-1" />
        {page.is_template && <span className="mr-2">Template</span>}
        <button
          className="hover:text-text mr-3"
          onClick={() => {
            const sub = newPage({ parent_id: page.id });
            savePage(sub);
            router.push(`/notes?id=${sub.id}`);
          }}
        >
          + Sub-page
        </button>
        <button
          className="hover:text-text"
          onClick={() => {
            if (confirm(`Delete "${page.title || "Untitled"}" and its sub-pages?`)) {
              deletePage(page.id);
              router.push(page.parent_id ? `/notes?id=${page.parent_id}` : "/notes");
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className="mb-4 px-[54px] max-md:px-0">
        <input
          key={page.id}
          className="w-full min-w-0 bg-transparent text-3xl md:text-4xl font-bold outline-none placeholder:text-muted/50"
          defaultValue={page.title}
          placeholder="Untitled"
          autoFocus={!page.title}
          onBlur={(e) => e.target.value !== page.title && savePage({ ...latest(), title: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>

      {kids.length > 0 && (
        <ul className="mb-4 px-[54px] max-md:px-0 space-y-1">
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={`/notes?id=${k.id}`} className="text-sm underline decoration-line underline-offset-4 hover:decoration-text">
                {k.title || "Untitled"}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Links to other notes open in place (like Notion); other links keep the editor's behaviour. */}
      <div
        onClickCapture={(e) => {
          const href = (e.target as HTMLElement).closest("a")?.getAttribute("href") ?? "";
          const target = noteIdFromHref(href);
          if (target) {
            e.preventDefault();
            e.stopPropagation();
            router.push(`/notes?id=${target}`);
          }
        }}
      >
        <Editor
          key={page.id}
          page={page}
          onChange={(content, plain) => savePage({ ...latest(), content, plain_text: plain }, { record: false })}
          createSubpage={() => {
            const sub = newPage({ parent_id: page.id });
            savePage(sub);
            return { id: sub.id, title: sub.title };
          }}
        />
      </div>
    </div>
  );
}

export default function NotesIndex() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <NotesView />
    </Suspense>
  );
}
