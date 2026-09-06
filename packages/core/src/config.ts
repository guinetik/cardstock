import { z } from "zod";
import { mappingSchema, schemeSchema } from "./scheme";

export const configSchema = z.strictObject({
  version: z.literal(1),
  project: z.string().trim().min(1),
  board: z.string().trim().min(1),
  tracker: z.string().trim().min(1),
  remote: z.url().optional(),
  scheme: schemeSchema.optional(),
  mapping: mappingSchema.optional(),
  provisioning: z.strictObject({ seed: z.string().trim().min(1) }).optional(),
  $comment: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;
export function parseConfig(input: unknown): Config {
  return configSchema.parse(input);
}
