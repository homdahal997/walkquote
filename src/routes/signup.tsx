import { createFileRoute } from "@tanstack/react-router";
import Signup from "@/components/auth/Signup";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create an account — WalkQuote" },
      { name: "description", content: "Create a WalkQuote account." },
      { property: "og:title", content: "Create an account — WalkQuote" },
      { property: "og:description", content: "Create a WalkQuote account." },
    ],
  }),
  component: Signup,
});
