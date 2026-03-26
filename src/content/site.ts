export const site = {
  brand: {
    name: "Hatch",
    byline: "Turn early ideas into real hackathons, teams, and launches."
  },
  hero: {
    title: "Hatch ideas into real hackathons.",
    description:
      "Hatch gives organizers a calm home for launch, submissions, judging, and results, while giving builders a place where projects can take shape in public.",
    primaryCta: {
      label: "Start hosting",
      href: "/organizer/signup"
    },
    secondaryCta: {
      label: "Explore events",
      href: "#events"
    }
  },
  stats: [
    { label: "Organizer setup", value: "Fast to launch" },
    { label: "Project intake", value: "Applications + submissions" },
    { label: "Decision stage", value: "Judging-ready" },
    { label: "Public outcome", value: "Pages, winners, results" }
  ],
  features: [
    {
      title: "Shape the event",
      description: "Create the page, define tracks, set logistics, and give the idea a clear structure."
    },
    {
      title: "Bring people in",
      description: "Share a polished public page where builders can discover, apply, and stay oriented."
    },
    {
      title: "Review what emerges",
      description: "Collect submissions, route judges in, and keep scoring organized when the work starts arriving."
    },
    {
      title: "Publish what hatched",
      description: "Reveal winners, open the gallery, and give the event a clear ending people can revisit."
    }
  ],
  steps: [
    {
      title: "Prepare",
      description: "Set the event foundation with details, tracks, timing, and the page people will land on."
    },
    {
      title: "Gather",
      description: "Open applications, collect projects, and bring judges and participants into one flow."
    },
    {
      title: "Hatch",
      description: "Score the work, publish the outcome, and turn the idea into a real event story."
    }
  ],
  links: {
    email: "hello@hatch.dev",
    discord: "https://discord.gg/your-link",
    twitter: "https://twitter.com/your-handle"
  }
} as const;

export type SiteData = typeof site;
