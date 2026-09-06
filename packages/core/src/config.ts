import { z } from "zod";

export const configSchema = z.strictObject({
  version: z.literal(1),
  project: z.string().trim().min(1),
  board: z.string().trim().min(1),
  tracker: z.string().trim().min(1),
  remote: z.url().optional(),
});

export type Config = z.infer<typeof configSchema>;
export function parseConfig(input: unknown): Config {
  return configSchema.parse(input);
}
