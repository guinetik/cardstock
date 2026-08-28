# Issue body editor

The card detail page renders issue body Markdown as HTML until the user selects
**Edit**. Editing loads `@mdxeditor/editor` in a client-only dynamic chunk and
supports headings, emphasis, lists, links, inline code, and code blocks.

Saving calls `updateCardBody`, which replaces only the issue body while
preserving the comments suffix and any unparsed leftover content. Cancel
restores the server-provided Markdown without writing.

The editor uses the `.issue-editor` paper skin in
`src/styles/components/paper.css`. All editor radii resolve through
`--radius-input`.
