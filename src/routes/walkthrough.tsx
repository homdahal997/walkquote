import { createFileRoute } from "@tanstack/react-router";
import { HomeownerWizard } from "@/components/estimate/HomeownerWizard";

export const Route = createFileRoute("/walkthrough")({
  validateSearch: (search: Record<string, unknown>): { experience?: string } =>
    typeof search["experience"] === "string" ? { experience: search["experience"] } : {},
  head: () => ({
    meta: [
      { title: "Room Walkthrough & Estimate — WalkQuote" },
      { name: "description", content: "Record or upload your room walkthrough video to get an instant AI estimate and paint color preview." },
    ],
  }),
  component: HomeownerWizard,
});
