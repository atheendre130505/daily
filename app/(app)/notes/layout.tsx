"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageTree } from "@/components/PageTree";
import { PanelButton, useUI } from "@/lib/ui";

function NotesFrame({ children }: { children: React.ReactNode }) {
  const id = useSearchParams().get("id");
  const { treeOpen, setTreeOpen } = useUI();
  return (
    <div className="md:flex min-h-dvh">
      {/* On phones the tree is the index page; on desktop it is a side panel that can be hidden. */}
      <div
        className={`${id ? "hidden" : "block"} ${treeOpen ? "md:block" : "md:hidden"} md:w-72 shrink-0 md:border-r border-line p-3 md:h-dvh md:overflow-y-auto md:sticky md:top-0`}
      >
        <div className="hidden md:flex justify-end -mt-1 mb-1">
          <PanelButton onClick={() => setTreeOpen(false)} title="Hide pages (Ctrl+\ hides everything)">«</PanelButton>
        </div>
        <PageTree />
      </div>
      <div className={`${id ? "block" : "hidden md:block"} flex-1 min-w-0 relative`}>
        {!treeOpen && (
          <PanelButton onClick={() => setTreeOpen(true)} title="Show pages" className="absolute top-3 left-3 z-30 border border-line bg-panel">
            »
          </PanelButton>
        )}
        {children}
      </div>
    </div>
  );
}

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <NotesFrame>{children}</NotesFrame>
    </Suspense>
  );
}
