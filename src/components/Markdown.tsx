import type { JSX } from "preact";

import type { Block, Inline } from "../lib/md";
import { parseMarkdown } from "../lib/md";

/**
 * Renders the tree `md.ts` produces as Preact nodes.
 *
 * Everything drawn here is text written by a third party — the Library
 * Genesis mirror, GitLab — so nothing is assembled as HTML: every block comes
 * from JSX and the text goes in as a child, which is how Preact escapes it.
 * `innerHTML` does not appear in this file, and that is the point.
 */

/**
 * Renders the formatted runs of one line.
 *
 * @param props.spans The runs, already parsed.
 * @returns The matching nodes.
 */
function Spans({ spans }: Readonly<{ spans: Inline[] }>) {
  return (
    <>
      {spans.map((s, i) => {
        const key = `${s.kind}-${i}`;
        switch (s.kind) {
          case "code": {
            return <code key={key}>{s.text}</code>;
          }
          case "strong": {
            return <strong key={key}>{s.text}</strong>;
          }
          case "em": {
            return <em key={key}>{s.text}</em>;
          }
          case "link": {
            // They leave the site and a third party wrote them: same
            // treatment as any external link on the other pages.
            return (
              <a
                key={key}
                href={s.href}
                target="_blank"
                rel="external noopener noreferrer"
              >
                {s.text}
              </a>
            );
          }
          default: {
            return <span key={key}>{s.text}</span>;
          }
        }
      })}
    </>
  );
}

/**
 * Renders one block.
 *
 * @param props.block The block to render.
 * @returns The matching node.
 */
function BlockNode({ block }: Readonly<{ block: Block }>) {
  switch (block.kind) {
    case "heading": {
      // The level comes from a third party's text, so it is clamped to
      // h3..h6: this island lives inside a page that already has its h1 and
      // h2s, and a `#` in a response must not rewrite the page's outline.
      const Tag =
        `h${Math.min(6, block.level + 2)}` as keyof JSX.IntrinsicElements;
      return (
        <Tag>
          <Spans spans={block.spans} />
        </Tag>
      );
    }
    case "code": {
      return (
        <pre>
          <code>{block.text}</code>
        </pre>
      );
    }
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={`item-${i}`}>
          <Spans spans={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "table": {
      return (
        // The results table is wider than a phone and cannot shrink without
        // ceasing to be a table, so it scrolls inside its own box rather
        // than stretching the page.
        <div className="md-table-scroll">
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={`h-${i}`}>
                    <Spans spans={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={`r-${r}`}>
                  {row.map((cell, c) => (
                    <td key={`c-${c}`}>
                      <Spans spans={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default: {
      return (
        <p>
          <Spans spans={block.spans} />
        </p>
      );
    }
  }
}

/**
 * Renders a whole Markdown text.
 *
 * `source` is optional so the caller does not have to narrow it. The panel
 * only mounts this when there IS readable text, but that condition lives in a
 * helper, which puts it out of reach of the type checker — taking the
 * undefined here keeps the check honest without a guard at the call site.
 *
 * @param props.source The text exactly as the server sent it.
 * @returns The rendered document, or nothing when there is no text.
 */
export default function Markdown({ source }: Readonly<{ source?: string }>) {
  if (!source) return null;
  const blocks = parseMarkdown(source);
  return (
    <div className="md">
      {blocks.map((b, i) => (
        <BlockNode
          key={`b-${i}`}
          block={b}
        />
      ))}
    </div>
  );
}
