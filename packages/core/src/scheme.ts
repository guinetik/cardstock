import { z } from "zod";

const name = z.string().trim().min(1);
const names = z.array(name);

export const schemeSchema = z
  .strictObject({
    required_keys: names,
    required_tags: names.optional(),
    statuses: names.min(1),
    closed_statuses: names.optional(),
    lanes: names.min(1),
    lanes_for_status: z.record(name, names.min(1)).optional(),
    now_lane_requires_status: name.optional(),
    epics: names.min(1),
    areas: names.min(1),
    base_tags: names.optional(),
    tag_groups: z
      .record(
        name,
        z.strictObject({
          cardinality: z.enum([
            "exactly-one",
            "at-least-one",
            "at-most-one",
            "any",
          ]),
          tags: names,
        }),
      )
      .optional(),
    sizes: names.min(1),
    priorities: names.min(1),
    required_sections: z.array(
      z.string().regex(/^## \S.*$/, "Use a level-two heading such as ## Ask"),
    ),
    scheme_doc: name.optional(),
  })
  .superRefine((scheme, ctx) => {
    const check = (
      value: string,
      allowed: string[],
      path: (string | number)[],
    ) => {
      if (!allowed.includes(value))
        ctx.addIssue({
          code: "custom",
          path,
          message: `Unknown value ${value}; expected one of ${allowed.join(", ")}`,
        });
    };
    scheme.closed_statuses?.forEach((status, i) => {
      check(status, scheme.statuses, ["closed_statuses", i]);
    });
    for (const [status, lanes] of Object.entries(
      scheme.lanes_for_status ?? {},
    )) {
      check(status, scheme.statuses, ["lanes_for_status", status]);
      lanes.forEach((lane, i) => {
        check(lane, scheme.lanes, ["lanes_for_status", status, i]);
      });
    }
    if (scheme.now_lane_requires_status) {
      check(scheme.now_lane_requires_status, scheme.statuses, [
        "now_lane_requires_status",
      ]);
      check("now", scheme.lanes, ["now_lane_requires_status"]);
    }
    const vocabulary = [
      ...(scheme.base_tags ?? []),
      ...Object.values(scheme.tag_groups ?? {}).flatMap((group) => group.tags),
    ];
    scheme.required_tags?.forEach((tag, i) => {
      check(tag, vocabulary, ["required_tags", i]);
    });
  });

export type Scheme = z.infer<typeof schemeSchema>;

export const mappingSchema = z.strictObject({
  $comment: z.string().optional(),
  group_aliases: z.record(name, name).optional(),
  by_tag: z.record(name, names).optional(),
  by_epic: z.record(name, names).optional(),
  by_area: z.record(name, names).optional(),
  audience_internal_when: z
    .strictObject({
      tags: names.optional(),
      epics: names.optional(),
      areas: names.optional(),
    })
    .optional(),
});

export const legacyConfigSchema = z.strictObject({
  $comment: z.string().optional(),
  project: name,
  board: name,
  tracker: name,
  seed: name,
  mapping: name,
  scheme: schemeSchema,
});
