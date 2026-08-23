/**
 * Turns an arbitrary MCP identifier (a tool/prompt name, a resource URI, a
 * resource template's URI template) into a value safe to use as an HTML
 * `id`/fragment.
 *
 * Tool and prompt names are already id-safe (`gitlab_find_action`), but
 * resource URIs (`gitlab://guides/code-review`) and URI templates
 * (`gitlab://group/{group_id}/members`) carry `:`, `/`, `{`, `}` — none of
 * which belong in a fragment identifier meant to be pasted into a URL bar.
 * Everything that is not `[a-z0-9]` collapses to a single hyphen, so the
 * visible id stays readable instead of percent-escaped.
 *
 * @param value Raw name/uri/uriTemplate from a Server Card entry.
 * @returns A lowercase, hyphen-separated id, with no leading/trailing hyphen.
 */
export function anchorSlug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
