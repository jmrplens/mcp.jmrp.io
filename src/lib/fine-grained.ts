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
 * "A", "A and B", "A, B and C": the permissions one line holds together.
 *
 * @param permissions The line's permissions, in GitLab's words.
 * @param and The connective, in the page's language.
 * @returns The segments, the names kept apart from the punctuation.
 */
function permissionList(
  permissions: string[],
  and: string,
): FineGrainedSegment[] {
  return permissions.flatMap((permission, i) => {
    const name = { permission };
    if (i === 0) return [name];
    const joiner = i === permissions.length - 1 ? ` ${and} ` : ", ";
    return [joiner, name];
  });
}

/**
 * One line: "Project: Read at project", "Access Request: Delete at group or
 * user".
 *
 * @param need The line.
 * @param t The page's strings.
 * @returns The line's segments.
 */
function lineSegments(
  need: FineGrainedNeed,
  t: FineGrainedStrings,
): FineGrainedSegment[] {
  const where = need.at
    .map((b) => t.domainFineGrainedBoundary[b])
    .join(` ${t.domainAnyOfJoiner} `);
  return [
    ...permissionList(need.permissions, t.domainFineGrainedAnd),
    ` ${t.domainFineGrainedAt} ${where}`,
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
  return entry.any_of.flatMap((alternative, i) => [
    ...(i > 0 ? [` ${t.domainAnyOfJoiner} `] : []),
    ...alternativeSegments(alternative, t),
  ]);
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
