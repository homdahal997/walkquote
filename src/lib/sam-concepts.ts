// SAM 3.1 concept prompts must be short noun phrases, one concept per request (Meta docs);
// long instructions return zero matches. Each surface lists the concepts merged into its mask.
export const SURFACE_PROMPTS = {
  walls: ["interior wall", "wall", "painted wall"],
  trim: ["baseboard", "door frame"],
  openings: ["door", "window"],
} as const;

export const SAM_CONCEPTS: readonly string[] = Array.from(
  new Set<string>([...SURFACE_PROMPTS.walls, ...SURFACE_PROMPTS.openings, ...SURFACE_PROMPTS.trim]),
);
