/**
 * How the fine-grained line of an action reads, for both of its renderings:
 * the domain page and its Markdown twin.
 *
 * The data is the `fine_grained` block of each action's gitlab://tools/{id}
 * detail, committed as src/data/surface/gitlab-fine-grained.json. Its reading
 * is the upstream table's ("Fine-grained permissions" in the gitlab-mcp-server
 * documentation): a line holds every one of its permissions at one of its
 * boundaries, an alternative holds all of its lines, and any one alternative
 * is enough. The page writes the same with the connectives it already uses for
 * alternative parameters: "+" between the lines one alternative needs, "or"
 * between alternatives.
 *
 * Alternatives that are one line each and differ only in where it is held are
 * written as that one line with all their boundaries: the server publishes
 * `search.code` as three alternatives, `Global Search: Use` at project, at
 * group, at user, and "Global Search: Use at project, group or user" says
 * exactly the same, since a line is held at any one of its boundaries.
 * Likewise, the lines of one alternative held at the same single boundary are
 * written as one line with all their permissions: "Work Item: Read and Work
 * Item: Delete at group" for the two lines `group.group_milestone_delete`
 * needs. Lines with several boundaries are never joined that way, because
 * each may be held at a different one.
 *
 * One function produces the sequence and each rendering only decides how a
 * permission name looks, so the page and the twin cannot say two different
 * things. Pure, no node:fs, and it takes the page's strings as an argument
 * rather than importing them, so the unit tests load it as it is.
 */
import type {
  FineGrainedAlternative,
  FineGrainedEntry,
  FineGrainedNeed,
} from "../data/surface";
import type { Lang } from "../i18n/ui";
import type { serversPage } from "../i18n/ui/servers-page";

/** The servers-page strings of one language: `serversPage[lang]`. */
export type FineGrainedStrings = (typeof serversPage)[Lang];

/** A run of plain text, or a permission name in GitLab's own words. */
export type FineGrainedSegment = string | { permission: string };

/**
 * "A", "A and B", "A, B and C": commas between the items, the connective
 * before the last one.
 *
 * @param items The items, already as segments.
 * @param last The connective before the last item, in the page's language.
 * @returns The segments, the items kept apart from the punctuation.
 */
function list(items: FineGrainedSegment[], last: string): FineGrainedSegment[] {
  return items.flatMap((item, i) => {
    if (i === 0) return [item];
    const joiner = i === items.length - 1 ? ` ${last} ` : ", ";
    return [joiner, item];
  });
}

/**
 * Folds the lines of one alternative held at the same single boundary into
 * one line with all their permissions, where the first of them stood. Lines
 * with several boundaries are kept apart: each may be met at a different one,
 * and one line would demand they all be met at the same.
 *
 * @param needs The alternative's lines, as the server published them.
 * @returns The same lines, with those folded.
 */
function foldLines(needs: FineGrainedNeed[]): FineGrainedNeed[] {
  const folded: FineGrainedNeed[] = [];
  const byBoundary = new Map<string, FineGrainedNeed>();
  for (const need of needs) {
    const line = need.at.length === 1 ? byBoundary.get(need.at[0]) : undefined;
    if (line) {
      for (const p of need.permissions) {
        if (!line.permissions.includes(p)) line.permissions.push(p);
      }
      continue;
    }
    const copy = { permissions: [...need.permissions], at: [...need.at] };
    if (need.at.length === 1) byBoundary.set(need.at[0], copy);
    folded.push(copy);
  }
  return folded;
}

/**
 * Folds the alternatives that are one line each and hold the same
 * permissions into one line with their boundaries together, each group where
 * its first member stood. Everything else is kept as it is.
 *
 * @param alternatives The entry's alternatives, as the server published them.
 * @returns The same alternatives, with those lines folded.
 */
function foldBoundaries(
  alternatives: FineGrainedAlternative[],
): FineGrainedAlternative[] {
  const folded: FineGrainedAlternative[] = [];
  const byPermissions = new Map<string, FineGrainedNeed>();
  for (const alternative of alternatives) {
    if (
      "not_judged_by_grant" in alternative ||
      alternative.needs.length !== 1
    ) {
      folded.push(alternative);
      continue;
    }
    const [need] = alternative.needs;
    const key = JSON.stringify(need.permissions);
    const line = byPermissions.get(key);
    if (line) {
      for (const b of need.at) if (!line.at.includes(b)) line.at.push(b);
      continue;
    }
    const copy = { permissions: need.permissions, at: [...need.at] };
    byPermissions.set(key, copy);
    folded.push({ needs: [copy] });
  }
  return folded;
}

/**
 * One line: "Project: Read at project", "Access Request: Delete at group or
 * user", "Global Search: Use at project, group or user".
 *
 * @param need The line.
 * @param t The page's strings.
 * @returns The line's segments.
 */
function lineSegments(
  need: FineGrainedNeed,
  t: FineGrainedStrings,
): FineGrainedSegment[] {
  const names = need.permissions.map((permission) => ({ permission }));
  const where = need.at.map((b) => t.domainFineGrainedBoundary[b]);
  return [
    ...list(names, t.domainFineGrainedAnd),
    ` ${t.domainFineGrainedAt} `,
    ...list(where, t.domainAnyOfJoiner),
  ];
}

/**
 * One alternative: its lines joined by "+", "no permission" when it has none,
 * or the note that the grant does not judge it.
 *
 * @param alternative The alternative.
 * @param t The page's strings.
 * @returns The alternative's segments.
 */
function alternativeSegments(
  alternative: FineGrainedAlternative,
  t: FineGrainedStrings,
): FineGrainedSegment[] {
  if ("not_judged_by_grant" in alternative) {
    return [t.domainFineGrainedNotJudged];
  }
  if (alternative.needs.length === 0) return [t.domainFineGrainedNone];
  return alternative.needs.flatMap((need, i) => [
    ...(i > 0 ? [" + "] : []),
    ...lineSegments(need, t),
  ]);
}

/**
 * The whole fine-grained line of one action, without its label.
 *
 * @param entry The action's entry in the fine-grained snapshot.
 * @param t The page's strings: `serversPage[lang]`.
 * @returns The segments, ready for either rendering.
 */
export function fineGrainedSegments(
  entry: FineGrainedEntry,
  t: FineGrainedStrings,
): FineGrainedSegment[] {
  if ("denied" in entry) return [t.domainFineGrainedDenied];
  const alternatives = entry.any_of.map((alternative) =>
    "needs" in alternative
      ? { needs: foldLines(alternative.needs) }
      : alternative,
  );
  const segments = foldBoundaries(alternatives).flatMap((alternative, i) => [
    ...(i > 0 ? [` ${t.domainAnyOfJoiner} `] : []),
    ...alternativeSegments(alternative, t),
  ]);
  // Neighbouring runs of text as one: the renderings get one string between
  // two names, however many pieces built it.
  return segments.reduce<FineGrainedSegment[]>((out, segment) => {
    const prev = out.at(-1);
    if (typeof segment === "string" && typeof prev === "string") {
      out[out.length - 1] = prev + segment;
    } else {
      out.push(segment);
    }
    return out;
  }, []);
}

/**
 * The line as one string, each permission name passed through `name`
 * (backticks in the Markdown twin, nothing in a test).
 *
 * @param entry The action's entry in the fine-grained snapshot.
 * @param t The page's strings: `serversPage[lang]`.
 * @param name How a permission name is written.
 * @returns The line, without its label.
 */
export function fineGrainedText(
  entry: FineGrainedEntry,
  t: FineGrainedStrings,
  name: (permission: string) => string = (p) => p,
): string {
  return fineGrainedSegments(entry, t)
    .map((s) => (typeof s === "string" ? s : name(s.permission)))
    .join("");
}
