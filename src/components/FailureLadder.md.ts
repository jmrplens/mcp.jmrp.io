/**
 * Markdown twin of `FailureLadder.astro`, for the `.md` pages.
 *
 * Same input as the component, minus what is presentation only (the bead
 * tones and the dashed rail — see the component's props): the twin gets the
 * text, and nothing the text does not already say. The page twins are built
 * from `src/lib/page-markdown.ts`, not from the rendered HTML, which is why a
 * figure that lives in a component needs this second renderer — the same
 * split jmrp.io keeps between `<Component>.astro` and `<Component>.md.ts`.
 *
 * The types live here rather than in the `.astro` file because a `.ts`
 * module can be imported from both sides; the component imports them from
 * here.
 */

/** One rung of the ladder. */
export interface LadderStep {
  /** When it applies, short enough for a column: `0`, `2–3 min`, `next call`. */
  at: string;
  /** The word a reader scans for: `Retried`, `Out of rotation`, `Home`. */
  state: string;
  /** One line of how, or of what has to be true for the step to happen. */
  note: string;
}

/** A titled sequence of rungs — what happens after one kind of failure. */
export interface Ladder {
  title: string;
  steps: readonly LadderStep[];
}

/**
 * Renders the ladder as a bold title over a numbered list: one item per
 * rung, the state first (it is what the reader scans for), then the moment
 * in parentheses, then the note.
 *
 * @param ladder The ladder to render.
 * @returns A markdown block, without trailing newline.
 */
export function failureLadderMarkdown(ladder: Ladder): string {
  const rungs = ladder.steps
    .map((step, i) => `${i + 1}. **${step.state}** (${step.at}) — ${step.note}`)
    .join("\n");
  return `**${ladder.title}**\n\n${rungs}`;
}
