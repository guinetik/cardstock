import type { Scheme } from "./scheme";
import type { Diagnostic } from "./validate";

/** Evaluate original values, before the shared schema normalizes tags or sizes. */
export function validateScheme(
  file: string,
  fields: Record<string, unknown>,
  body: string,
  scheme: Scheme,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const add = (code: string, field: string, message: string) =>
    diagnostics.push({
      file,
      code,
      field,
      message,
      ...(scheme.scheme_doc ? { reference: scheme.scheme_doc } : {}),
    });
  for (const key of scheme.required_keys) {
    if (key === "epic") continue; // A board card may have no epic assignment.
    if (!Object.hasOwn(fields, key))
      add("required_key", key, `Missing required key: ${key}`);
  }
  const member = (field: string, allowed: string[]) => {
    if (!Object.hasOwn(fields, field)) return;
    const value = fields[field];
    if (typeof value !== "string")
      add("field_type", field, `${field} must be a string`);
    else if (!allowed.includes(value))
      add(
        "vocabulary",
        field,
        `${field} '${value}' is not one of ${allowed.join(", ")}`,
      );
  };
  member("status", scheme.statuses);
  member("lane", scheme.lanes);
  for (const field of ["epic", "area"]) {
    if (field === "epic" && fields[field] == null) continue;
    if (Object.hasOwn(fields, field) && typeof fields[field] !== "string")
      add("field_type", field, `${field} must be a string`);
  }
  member("value", scheme.sizes);
  member("effort", scheme.sizes);
  const { status, lane, priority, tags } = fields;
  if (
    typeof status === "string" &&
    typeof lane === "string" &&
    scheme.lanes.includes(lane)
  ) {
    const allowed = scheme.lanes_for_status?.[status];
    if (allowed && !allowed.includes(lane))
      add(
        "status_lane",
        "lane",
        `Status '${status}' cannot sit in lane '${lane}'; expected ${allowed.join(" or ")}`,
      );
    else if (
      lane === "now" &&
      scheme.now_lane_requires_status &&
      status !== scheme.now_lane_requires_status
    ) {
      add(
        "now_status",
        "status",
        `Lane 'now' requires status '${scheme.now_lane_requires_status}'`,
      );
    }
  }
  if (
    Object.hasOwn(fields, "priority") &&
    !scheme.priorities.includes(String(priority))
  ) {
    add(
      "priority",
      "priority",
      `Priority must be one of ${scheme.priorities.join(", ")}`,
    );
  }
  if (
    typeof status === "string" &&
    scheme.statuses.includes(status) &&
    !scheme.closed_statuses?.includes(status)
  ) {
    if (typeof fields.summary !== "string" || !fields.summary.trim())
      add("open_summary", "summary", "Open items need a nonempty summary");
  }
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))
    add("field_type", "tags", "Tags must be a list of strings");
  else {
    const groups = Object.entries(scheme.tag_groups ?? {});
    const vocabulary = new Set([
      ...(scheme.base_tags ?? []),
      ...groups.flatMap(([, group]) => group.tags),
    ]);
    for (const tag of scheme.required_tags ?? []) {
      if (!tags.includes(tag))
        add("required_tag", "tags", `Tags must include '${tag}'`);
    }
    for (const tag of tags) {
      if (!vocabulary.has(tag))
        add("unknown_tag", "tags", `Tag '${tag}' is not in the scheme`);
    }
    for (const [name, group] of groups) {
      const present = tags.filter((tag) => group.tags.includes(tag));
      const count = present.length;
      if (
        (group.cardinality === "exactly-one" && count !== 1) ||
        (group.cardinality === "at-least-one" && count === 0) ||
        (group.cardinality === "at-most-one" && count > 1)
      ) {
        add(
          "tag_cardinality",
          "tags",
          `${group.cardinality.replaceAll("-", " ")} ${name} tag(s) required; found ${present.join(", ") || "none"}`,
        );
      }
    }
  }
  // Headings must be real lines outside fenced code, not incidental prose.
  const sections = new Map<string, string[]>();
  let current: string[] | undefined;
  let fence: { char: string; length: number } | undefined;
  for (const line of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      current?.push(line);
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
      current?.push(line);
    } else if (/^#{1,2}\s/.test(line)) {
      const heading = line.trimEnd().replace(/\s+#+$/, "");
      current = sections.get(heading) ?? [];
      sections.set(heading, current);
    } else current?.push(line);
  }
  for (const heading of scheme.required_sections) {
    const content = sections.get(heading);
    if (!content)
      add("required_section", "body", `Missing required section ${heading}`);
    else if (!content.join("\n").trim())
      add("empty_section", "body", `Required section ${heading} is empty`);
  }
  return diagnostics;
}
