"use client";

import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { codeBlockOptions } from "@blocknote/code-block";

/**
 * Callout: a highlighted note on a faint grey background with a bar on the left (monochrome).
 * Older callouts may carry an emoji; it's no longer shown.
 */
const createCallout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: { emoji: { default: "" }, tone: { default: "default" } },
    content: "inline",
  },
  {
    render: ({ contentRef }) => (
      <div
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 4,
          background: "rgba(255,255,255,0.055)",
          borderLeft: "3px solid rgba(255,255,255,0.55)",
        }}
      >
        <div ref={contentRef} style={{ minWidth: 0 }} />
      </div>
    ),
  },
);

/** The editor's block set: everything BlockNote has, plus callouts and syntax-highlighted code. */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    callout: createCallout(),
  },
});

export type AppEditor = typeof schema.BlockNoteEditor;
