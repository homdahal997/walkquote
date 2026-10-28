import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/components/auth/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — WalkQuote" },
      { name: "description", content: "Set a new password for your WalkQuote account." },
      { property: "og:title", content: "Choose a new password — WalkQuote" },
      { property: "og:description", content: "Set a new password for your WalkQuote account." },
    ],
  }),
  component: ResetPassword,
});
