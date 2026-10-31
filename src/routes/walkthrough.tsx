import { createFileRoute } from "@tanstack/react-router";
import { HomeownerWizard } from "@/components/estimate/HomeownerWizard";

export const Route = createFileRoute("/walkthrough")({
  validateSearch: (search: Record<string, unknown>): { experience?: string } =>
    typeof search["experience"] === "string" ? { experience: search["experience"] } : {},
  head: () => ({
    meta: [
      { title: "Room Walkthrough & Estimate — WalkQuote" },
      { name: "description", content: "Record or upload your room walkthrough video to get an instant AI estimate and paint color preview." },
      { property: "og:title", content: "Room Walkthrough & Estimate — WalkQuote" },
      { property: "og:description", content: "Turn your room video into a painting estimate and realistic color previews with Meta models." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeownerWizard,
});
