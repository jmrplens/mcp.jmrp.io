/**
 * A minimal Markdown reader for what MCP servers actually answer.
 *
 * WHY IT EXISTS. The text inside `result.content[].text` is not loose prose:
 * libgen's `search` answers a pipe table with a download link per row. Served
 * as raw JSON that arrives with its newlines escaped (`\n`, `\"`) on a single
 * line, which is precisely the format in which a table stops being a table.
 * Laying it out is not decoration.
 *
 * WHY NOT A LIBRARY. A full parser is tens of kilobytes on an island that is
 * currently small, to cover syntax these responses never use. What is here is
 * what they do use, and nothing else.
 *
 * WHY IT RETURNS DATA, NOT HTML. The output is a block tree that
 * `Markdown.tsx` turns into Preact nodes. No HTML is ever built as a string
 * and `innerHTML` is never touched: the text rendered here is written by a
 * third party (the Library Genesis mirror, GitLab), so the route by which
 * markup could get in simply does not exist.
 */

/** A run of text with its formatting, within one line. */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string };

/** One block of the document. */
export type Block =
  | { kind: "heading"; level: number; spans: Inline[] }
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "code"; lang?: string; text: string }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] };

/**
 * Schemes a link is allowed to use.
 *
 * An allowlist on purpose. A third party writes these texts, so a
 * `javascript:` inside a `[text](…)` is a real possibility rather than a
 * hypothesis; anything not listed here renders as text and stops being a
 * link at all.
 */
const SAFE_SCHEME = /^(https?:|mailto:)/i;

/**
 * Line recognition is done by hand, not with regular expressions.
 *
 * The first version used them and every one was flagged for super-linear
 * backtracking. On text this project controls that would be a theoretical
 * worry; here the input is written by a third party — a Library Genesis
 * mirror, a GitLab instance — and rendered in the reader's browser, which is
 * exactly the setting where a catastrophic backtrack stops being theoretical.
 * Scanning characters is linear by construction, and for grammar this small
 * it is no harder to read.
 */

/** A token found in a line: where it runs, and which delimiter opened it. */
type Token = { at: number; end: number; opener: string };

/**
 * Reads a code span starting at `i`, if one closes.
 *
 * @param line The line being scanned.
 * @param i Index of the backtick.
 * @returns The token, or undefined when nothing closes it.
 */
function codeAt(line: string, i: number): Token | undefined {
  const close = line.indexOf("`", i + 1);
  return close > i ? { at: i, end: close + 1, opener: "`" } : undefined;
}

/**
 * Reads a link starting at `i`, if it is one.
 *
 * @param line The line being scanned.
 * @param i Index of the opening bracket.
 * @returns The token, or undefined.
 */
function linkAt(line: string, i: number): Token | undefined {
  const rb = line.indexOf("]", i + 1);
  if (rb <= i || line[rb + 1] !== "(") return undefined;
  const rp = line.indexOf(")", rb + 2);
  // No spaces inside the target: that is what separates a link from a square
  // bracket that merely happens to be followed by a parenthesis.
  if (rp <= rb || line.slice(rb + 2, rp).includes(" ")) return undefined;
  return { at: i, end: rp + 1, opener: "[" };
}

/**
 * Reads bold or italic starting at `i`, if it closes.
 *
 * @param line The line being scanned.
 * @param i Index of the asterisk.
 * @returns The token, or undefined.
 */
function emphasisAt(line: string, i: number): Token | undefined {
  const mark = line.startsWith("**", i) ? "**" : "*";
  const close = line.indexOf(mark, i + mark.length);
  return close > i
    ? { at: i, end: close + mark.length, opener: mark }
    : undefined;
}

/**
 * Finds the next inline token at or after `from`.
 *
 * The three readers are separate functions rather than branches in the loop:
 * inline they put this one past the complexity the project allows, and each
 * delimiter's rule reads better stated on its own.
 *
 * @param line The line being scanned.
 * @param from Where to start looking.
 * @returns The token, or undefined if there is none.
 */
function nextToken(line: string, from: number): Token | undefined {
  for (let i = from; i < line.length; i++) {
    const ch = line[i];
    let hit: Token | undefined;
    switch (ch) {
      case "`": {
        hit = codeAt(line, i);
        break;
      }
      case "[": {
        hit = linkAt(line, i);
        break;
      }
      case "*": {
        hit = emphasisAt(line, i);
        break;
      }
      // No default: any other character is ordinary text.
    }
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Splits one line into its formatted runs.
 *
 * @param line The line, with its block marker already stripped.
 * @returns The runs, in order.
 */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;

  while (i < line.length) {
    const hit = nextToken(line, i);
    if (!hit) break;
    if (hit.at > i) out.push({ kind: "text", text: line.slice(i, hit.at) });
    const token = line.slice(hit.at, hit.end);

    switch (hit.opener) {
      case "`": {
        out.push({ kind: "code", text: token.slice(1, -1) });

        break;
      }
      case "[": {
        const cut = token.indexOf("](");
        const href = token.slice(cut + 2, -1);
        out.push(
          SAFE_SCHEME.test(href)
            ? { kind: "link", text: token.slice(1, cut), href }
            : { kind: "text", text: token },
        );

        break;
      }
      case "**": {
        out.push({ kind: "strong", text: token.slice(2, -2) });

        break;
      }
      default: {
        out.push({ kind: "em", text: token.slice(1, -1) });
      }
    }

    i = hit.end;
  }

  if (i < line.length) out.push({ kind: "text", text: line.slice(i) });
  return out;
}

/**
 * Splits a table row into its cells.
 *
 * @param line The row, pipes included.
 * @returns The parsed cells.
 */
function parseRow(line: string): Inline[][] {
  let body = line.trim();
  if (body.startsWith("|")) body = body.slice(1);
  if (body.endsWith("|")) body = body.slice(0, -1);
  return body.split("|").map((cell) => parseInline(cell.trim()));
}

/**
 * Reads the heading level, if the line is one.
 *
 * @param line The line.
 * @returns Level and text, or undefined.
 */
function matchHeading(
  line: string,
): { level: number; text: string } | undefined {
  let level = 0;
  while (level < line.length && line[level] === "#") level++;
  if (level === 0 || level > 6) return undefined;
  if (line[level] !== " ") return undefined;
  return { level, text: line.slice(level + 1).trim() };
}

/**
 * Reads a bullet item, if the line is one.
 *
 * @param line The line.
 * @returns The item's text, or undefined.
 */
function matchBullet(line: string): string | undefined {
  const body = line.trimStart();
  const mark = body[0];
  if (mark !== "-" && mark !== "*") return undefined;
  if (body[1] !== " ") return undefined;
  return body.slice(2).trim();
}

/**
 * Reads a numbered item, if the line is one.
 *
 * @param line The line.
 * @returns The item's text, or undefined.
 */
function matchNumbered(line: string): string | undefined {
  const body = line.trimStart();
  let i = 0;
  while (i < body.length && body[i] >= "0" && body[i] <= "9") i++;
  if (i === 0) return undefined;
  const sep = body[i];
  if (sep !== "." && sep !== ")") return undefined;
  if (body[i + 1] !== " ") return undefined;
  return body.slice(i + 2).trim();
}

/** Whether the line opens or closes a code fence. */
function isFence(line: string): boolean {
  return line.trimStart().startsWith("```");
}

/**
 * Whether the line is a table's separator row.
 *
 * A separator is made only of dashes, colons, pipes and spaces, and has at
 * least one dash. Checking the characters is what tells a real separator from
 * a line of prose that happens to contain a pipe.
 *
 * @param line The line.
 * @returns True when it separates a header from its rows.
 */
function isTableRule(line: string): boolean {
  let dashes = 0;
  for (const ch of line.trim()) {
    if (ch === "-") dashes++;
    else if (ch !== ":" && ch !== "|" && ch !== " ") return false;
  }
  return dashes > 0;
}

/** What a block reader hands back: the block, and where it stopped. */
type Taken = { block: Block; next: number };

/**
 * Reads a fenced code block, copying it verbatim.
 *
 * @param lines Every line of the document.
 * @param start Index of the opening fence.
 * @returns The block and the index after the closing fence.
 */
function takeCode(lines: string[], start: number): Taken {
  const lang = lines[start].trim().slice(3).trim();
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !isFence(lines[i])) {
    body.push(lines[i]);
    i++;
  }
  return {
    block: { kind: "code", lang: lang || undefined, text: body.join("\n") },
    next: i + 1,
  };
}

/**
 * Reads a table: a header row, the separator, then rows until the pipes stop.
 *
 * @param lines Every line of the document.
 * @param start Index of the header row.
 * @returns The block and the index after the last row.
 */
function takeTable(lines: string[], start: number): Taken {
  const head = parseRow(lines[start]);
  let i = start + 2;
  const rows: Inline[][][] = [];
  while (i < lines.length && lines[i].includes("|")) {
    rows.push(parseRow(lines[i]));
    i++;
  }
  return { block: { kind: "table", head, rows }, next: i };
}

/**
 * Reads a run of list items of one kind.
 *
 * @param lines Every line of the document.
 * @param start Index of the first item.
 * @param ordered Whether the list is numbered.
 * @returns The block and the index after the last item.
 */
function takeList(lines: string[], start: number, ordered: boolean): Taken {
  const read = ordered ? matchNumbered : matchBullet;
  const items: Inline[][] = [];
  let i = start;
  while (i < lines.length) {
    const text = read(lines[i]);
    if (text === undefined) break;
    items.push(parseInline(text));
    i++;
  }
  return { block: { kind: "list", ordered, items }, next: i };
}

/** Whether a line opens a block of its own, so a paragraph has to stop. */
function opensBlock(line: string): boolean {
  return (
    matchHeading(line) !== undefined ||
    isFence(line) ||
    matchBullet(line) !== undefined ||
    matchNumbered(line) !== undefined
  );
}

/**
 * Reads a paragraph: up to the blank line, or up to the next block.
 *
 * @param lines Every line of the document.
 * @param start Index of the first line.
 * @returns The block and the index after the paragraph.
 */
function takeParagraph(lines: string[], start: number): Taken {
  const para: string[] = [];
  let i = start;
  while (i < lines.length && lines[i].trim() !== "") {
    if (opensBlock(lines[i]) && para.length > 0) break;
    para.push(lines[i]);
    i++;
  }
  return {
    block: { kind: "paragraph", spans: parseInline(para.join(" ")) },
    next: i,
  };
}

/**
 * Picks the reader for whatever block starts at `i`.
 *
 * @param lines Every line of the document.
 * @param i Index of the first line of the block.
 * @returns The block and where it ended.
 */
function takeBlock(lines: string[], i: number): Taken {
  const line = lines[i];

  if (isFence(line)) return takeCode(lines, i);

  const heading = matchHeading(line);
  if (heading) {
    return {
      block: {
        kind: "heading",
        level: heading.level,
        spans: parseInline(heading.text),
      },
      next: i + 1,
    };
  }

  // A header row alone is not a table — without the dashes underneath it is
  // just a paragraph that happens to contain pipes, and it stays one.
  if (line.includes("|") && i + 1 < lines.length && isTableRule(lines[i + 1])) {
    return takeTable(lines, i);
  }

  if (matchBullet(line) !== undefined) return takeList(lines, i, false);
  if (matchNumbered(line) !== undefined) return takeList(lines, i, true);
  return takeParagraph(lines, i);
}

/**
 * Turns Markdown text into blocks.
 *
 * The per-block readers are separate functions rather than branches inline
 * here: as one loop this ran well past the complexity the project allows, and
 * each of them is independently readable anyway.
 *
 * @param src The text exactly as the server sent it.
 * @returns The blocks, in the order they appear.
 */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    const taken = takeBlock(lines, i);
    blocks.push(taken.block);
    i = taken.next;
  }

  return blocks;
}
