import { createFileRoute, redirect } from "@tanstack/react-router";

// App-first: the root URL opens the product, not a marketing page.
// The marketing site lives at /landing.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
