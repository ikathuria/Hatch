export const uiCopy = {
  common: {
    loading: "Loading...",
    saving: "Saving...",
    saved: "Saved",
    retry: "Try again",
    unavailable: "This section is unavailable right now."
  },
  organizer: {
    dashboard: {
      emptyTitle: "No events yet",
      emptyBody: "Create an event to unlock setup, submissions, and judging."
    },
    editor: {
      draft: "Draft",
      ready: "Ready to publish",
      saving: "Saving changes...",
      success: "Changes saved."
    },
    judging: {
      noSubmissions: "No submissions have been scored yet.",
      noTies: "No unresolved ties.",
      published: "Results are published.",
      locked: "Winners are locked after publishing results."
    }
  },
  judge: {
    loginPrompt: "Enter your optional PIN to open the workspace.",
    autosavePending: "Edits save automatically after you pause typing.",
    autosaveSaving: "Saving your scores...",
    autosaveSaved: "All changes saved.",
    readonly: "Results are published. Scoring is read only."
  },
  public: {
    events: {
      empty: "No events match your filters yet.",
      error: "Unable to load events."
    },
    detail: {
      galleryLocked: "Project gallery will unlock after organizers publish results.",
      applyFirst: "Apply to this event to unlock submission and voting."
    }
  },
  participant: {
    apply: {
      success: "Application received. Redirecting..."
    },
    submit: {
      gated: "Apply to this event before submitting.",
      success: "Submission received. Redirecting..."
    }
  }
} as const;

export type UiCopy = typeof uiCopy;
