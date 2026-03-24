export const site = {
  brand: {
    name: "Hatch",
    byline: "Incubate your next hackathon, then let it hatch."
  },
  hero: {
    title: "Build a nest for your next hackathon.",
    description:
      "Hatch gives organizers a playful event home, smooth registration flow, and judging-ready submissions on a free stack.",
    primaryCta: {
      label: "Create an event",
      href: "/organizer/signup"
    },
    secondaryCta: {
      label: "Browse events",
      href: "#events"
    }
  },
  stats: [
    { label: "Free forever core", value: "0$" },
    { label: "Avg. launch time", value: "48h" },
    { label: "Submission flow", value: "Built-in" },
    { label: "Organizer seats", value: "Unlimited" }
  ],
  features: [
    {
      title: "Self-serve organizer onboarding",
      description: "Create an account, hatch an event, and publish in minutes."
    },
    {
      title: "Custom branded event pages",
      description: "Share your mission, tracks, and schedule with a polished layout."
    },
    {
      title: "Registration + submission capture",
      description: "Collect applications and projects automatically into your dashboard."
    },
    {
      title: "Data export ready",
      description: "Download applications or submissions anytime for judges and mentors."
    }
  ],
  steps: [
    {
      title: "Create your organizer account",
      description: "Start free and set up your first event."
    },
    {
      title: "Configure tracks + details",
      description: "Add the basics, publish, and share the event URL."
    },
    {
      title: "Collect entries",
      description: "Use built-in forms for applications and submissions."
    }
  ],
  links: {
    email: "hello@hatch.dev",
    discord: "https://discord.gg/your-link",
    twitter: "https://twitter.com/your-handle"
  }
} as const;

export type SiteData = typeof site;
