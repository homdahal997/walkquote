import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WalkQuote — Instant interior painting estimates from a room walk" },
      { name: "description", content: "Walk a room on camera or upload a video and get an AI interior painting estimate with a live wall-color preview, powered by Meta Muse Spark and SAM 3.1." },
      { property: "og:title", content: "WalkQuote — Instant interior painting estimates" },
      { property: "og:description", content: "A 30-second room walk becomes an itemized painting quote and before/after color preview, built on the Meta Model API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
