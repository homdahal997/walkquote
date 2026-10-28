import { createFileRoute } from "@tanstack/react-router";
import { HomeownerWizard } from "@/components/estimate/HomeownerWizard";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { experience?: string } =>
    typeof search["experience"] === "string" ? { experience: search["experience"] } : {},
  head: () => ({
    meta: [
      { title: "WalkQuote — Instant room painting estimates" },
      { name: "description", content: "Walk a room on camera and get an AI-assisted interior painting estimate matched to your budget, with color previews." },
      { property: "og:title", content: "WalkQuote — Instant room painting estimates" },
      { property: "og:description", content: "AI-assisted room walkthrough estimates, budget matching, and before/after color previews for painting projects." },
    ],
  }),
  component: HomeownerWizard,
});
