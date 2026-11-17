"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef } from "react";
import { SuggestionMenuController, getDefaultReactSlashMenuItems, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu, type Block, type PartialBlock } from "@blocknote/core";
import { syntaxHighlighter } from "@blocknote/code-block";
import type { Page } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { schema, type AppEditor } from "./editorSchema";

/** Pasted / dropped files go to your Supabase Storage. */
async function uploadFile(file: File): Promise<string> {
  const sb = supabaseBrowser();
  const { data: u } = await sb.auth.getUser();
  const path = `${u.user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb.storage.from("images").upload(path, file);
  if (error) throw error;
  return sb.storage.from("images").getPublicUrl(path).data.publicUrl;
}

type MarkdownPlaceholder = { type: "__markdown__"; markdown: string };

/** Extra "/" menu entries on top of BlockNote's defaults. */
function extraSlashItems(editor: AppEditor, createSubpage: () => { id: string; title: string }) {
  return [
    {
      title: "Callout",
      subtext: "Highlighted note with an emoji",
      aliases: ["callout", "note", "tip", "info", "warning"],
      group: "Basic blocks",
      icon: <span style={{ fontSize: 15, fontWeight: 700 }}>!</span>,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout" }),
    },
    {
      title: "Page",
      subtext: "New sub-page inside this one, with a link to it",
      aliases: ["page", "subpage", "sub-page", "new page"],
      group: "Basic blocks",
      icon: <span style={{ fontSize: 15, fontWeight: 700 }}>P</span>,
      onItemClick: () => {
        const p = createSubpage();
        insertOrUpdateBlockForSlashMenu(editor, {
          type: "paragraph",
          content: [{ type: "link", href: `/notes?id=${p.id}`, content: `→ ${p.title || "Untitled"}` }],
        });
      },
    },
  ];
}

export default function Editor({
  page,
  onChange,
  createSubpage,
}: {
  page: Page;
  onChange: (content: Block[], plainText: string) => void;
  createSubpage: () => { id: string; title: string };
}) {
  const first = page.content[0] as MarkdownPlaceholder | undefined;
  const isMarkdown = first?.type === "__markdown__";
  const editor = useCreateBlockNote(
    {
      schema,
      extensions: [syntaxHighlighter],
      initialContent: !isMarkdown && page.content.length ? (page.content as PartialBlock[] as never) : undefined,
      uploadFile,
      // Like Notion: pasted Markdown becomes formatted blocks; pasted web/Notion content keeps its formatting;
      // pasted images and files are uploaded.
      pasteHandler: ({ defaultPasteHandler }) => defaultPasteHandler({ prioritizeMarkdownOverHTML: false, plainTextAsMarkdown: true }),
    },
    [page.id],
  ) as AppEditor;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pages imported from Notion arrive as markdown; convert once and save as blocks.
  useEffect(() => {
    if (!isMarkdown) return;
    const blocks = editor.tryParseMarkdownToBlocks(first!.markdown);
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph" }]);
    onChange(editor.document as Block[], first!.markdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <BlockNoteView
      editor={editor}
      theme="dark"
      slashMenu={false}
      onChange={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(editor.document as Block[], editor.blocksToMarkdownLossy()), 600);
      }}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems([...getDefaultReactSlashMenuItems(editor), ...extraSlashItems(editor, createSubpage)], query)
        }
      />
    </BlockNoteView>
  );
}
