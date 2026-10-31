import { createFileRoute } from "@tanstack/react-router";
import Login from "@/components/auth/Login";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { from_url?: string } =>
    typeof search["from_url"] === "string" ? { from_url: search["from_url"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — WalkQuote" },
      { name: "description", content: "Contractor sign-in for the WalkQuote estimate inbox." },
      { property: "og:title", content: "Sign in — WalkQuote" },
      { property: "og:description", content: "Contractor sign-in for the WalkQuote estimate inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});
