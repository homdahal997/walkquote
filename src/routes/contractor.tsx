import { createFileRoute } from "@tanstack/react-router";
import { ContractorInbox } from "@/components/estimate/ContractorInbox";

export const Route = createFileRoute("/contractor")({
  validateSearch: (search: Record<string, unknown>): { view?: "demo" } =>
    search["view"] === "demo" ? { view: "demo" } : {},
  head: () => ({
    meta: [
      { title: "Estimate inbox — WalkQuote" },
      { name: "description", content: "Review homeowner room estimate requests, scopes, budgets, and color choices." },
      { property: "og:title", content: "Estimate inbox — WalkQuote" },
      { property: "og:description", content: "Contractor inbox for WalkQuote room estimate requests." },
    ],
  }),
  component: ContractorInbox,
});
