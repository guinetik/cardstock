"use client";

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  codeBlockPlugin,
  headingsPlugin,
  InsertCodeBlock,
  ListsToggle,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  markdownShortcutPlugin,
  quotePlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

/**
 * Browser-only MDXEditor. Plugins are constructed here so they never run on the server.
 *
 * @param props.markdown - Issue body (no comments suffix).
 * @param props.onChange - Called with markdown as the user types.
 */
export default function IssueBodyEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (md: string) => void;
}) {
  return (
    <div className="issue-editor" data-testid="issue-body-editor">
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        contentEditableClassName="prose prose-sm max-w-none"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <ListsToggle />
                <CreateLink />
                <InsertCodeBlock />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
