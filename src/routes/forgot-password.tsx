import { createFileRoute } from "@tanstack/react-router";
import ForgotPassword from "@/components/auth/ForgotPassword";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — WalkQuote" },
      { name: "description", content: "Request a WalkQuote password reset link." },
      { property: "og:title", content: "Reset your password — WalkQuote" },
      { property: "og:description", content: "Request a WalkQuote password reset link." },
    ],
  }),
  component: ForgotPassword,
});
