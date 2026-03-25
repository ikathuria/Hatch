export function initJudgingWorkspace(root: HTMLElement | null, eventId: string): void {
  if (!root || !eventId || root.dataset.judgingReady === "1") return;
  root.dataset.judgingReady = "1";

  const baseApi = `/api/organizer/events/${eventId}`;
  const manualOverrideKey = `hatch-judging-manual-${eventId}`;
  const $ = (selector: string) => root.querySelector(selector);

  const winnersMatchSuggested = (
    winners: Array<{ scope: string; trackName?: string; submissionId: string }>,
    suggested: { overall: string | null; tracks: Record<string, string | null> }
  ): boolean => {
    if (!suggested.overall) return false;
    const overallRow = winners.find((w) => w.scope === "overall");
    if (!overallRow || overallRow.submissionId !== suggested.overall) return false;
    for (const [trackName, sid] of Object.entries(suggested.tracks)) {
      if (!sid) return false;
      const row = winners.find((w) => w.scope === "track" && w.trackName === trackName);
      if (!row || row.submissionId !== sid) return false;
    }
    return true;
  };

  const buildSuggestedWinnerPayload = (suggested: {
    overall: string | null;
    tracks: Record<string, string | null>;
  }) => ({
    overallWinnerSubmissionId: suggested.overall || "",
    trackWinners: Object.entries(suggested.tracks)
      .map(([trackName, submissionId]) => ({ trackName, submissionId: submissionId || "" }))
      .filter((row) => row.submissionId),
    note: ""
  });

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const toList = (value: unknown) => (Array.isArray(value) ? value : []);
  const formatDate = (value: unknown) => {
    if (!value) return "TBD";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };
  const formatDateForInput = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const setStatus = (el: Element | null, message: string, tone = "") => {
    if (!el) return;
    if (!message) {
      el.textContent = "";
      el.classList.add("hidden");
      el.classList.remove("!text-lime", "!text-coral", "!text-sky");
      return;
    }
    el.textContent = message;
    el.classList.remove("hidden", "!text-lime", "!text-coral", "!text-sky");
    if (tone) el.classList.add(tone);
  };

  const elements = {
    title: $("[data-judging-workspace-title]"),
    publicLink: $("[data-judging-public-link]"),
    publishBtn: $("[data-publish-results]"),
    statCriteria: $("[data-stat-criteria]"),
    statJudgeLinks: $("[data-stat-judge-links]"),
    statTies: $("[data-stat-ties]"),
    statResults: $("[data-stat-results]"),
    rubricForm: $("[data-rubric-form]"),
    rubricRows: $("[data-rubric-rows]"),
    rubricScale: $("[data-score-scale]"),
    rubricStatus: $("[data-rubric-status]"),
    addCriterion: $("[data-add-criterion]"),
    judgeLinkForm: $("[data-judge-link-form]"),
    linkStatus: $("[data-link-status]"),
    generatedLinkWrap: $("[data-generated-link-wrap]"),
    generatedLink: $("[data-generated-link]"),
    copyLink: $("[data-copy-link]"),
    judgeLinks: $("[data-judge-links]"),
    overviewRows: $("[data-overview-rows]"),
    overviewStatus: $("[data-overview-status]"),
    tieBreaks: $("[data-tie-breaks]"),
    tieStatus: $("[data-tie-status]"),
    winnersForm: $("[data-winners-form]"),
    overallWinner: $("[data-overall-winner]"),
    trackWinners: $("[data-track-winners]"),
    winnerStatus: $("[data-winner-status]"),
    manualWinnerOverride: $("[data-manual-winner-override]") as HTMLInputElement | null,
    scoreBasedWinnersHint: $("[data-score-based-winners-hint]"),
    winnersHint: $("[data-winners-hint]")
  };

  const state: {
    event: Record<string, unknown> | null;
    rubricMeta: Record<string, unknown> | null;
    rubric: unknown[];
    judgeLinks: unknown[];
    submissions: unknown[];
    tracks: unknown[];
    overallRanking: unknown[];
    rankingByTrack: Map<string, unknown[]>;
    unresolvedTies: unknown[];
    winners: { overallWinnerId: string; trackWinners: Record<string, string> };
    published: boolean;
    suggestedWinners: { overall: string | null; tracks: Record<string, string | null> } | null;
    scoreBasedWinnersApply: boolean;
    manualOverride: boolean;
  } = {
    event: null,
    rubricMeta: null,
    rubric: [],
    judgeLinks: [],
    submissions: [],
    tracks: [],
    overallRanking: [],
    rankingByTrack: new Map(),
    unresolvedTies: [],
    winners: {
      overallWinnerId: "",
      trackWinners: {}
    },
    published: false,
    suggestedWinners: null,
    scoreBasedWinnersApply: false,
    manualOverride: false
  };

  const applyJudgingOverviewPayload = (overviewPayload: Record<string, unknown>) => {
    state.submissions = toList(overviewPayload.submissions);
    state.overallRanking = toList(
      (overviewPayload.rankings as { overall?: { ranking?: unknown[] } } | undefined)?.overall?.ranking
    ).map((row, index) => ({
      ...(row as object),
      rank: index + 1
    }));
    state.rankingByTrack = new Map(
      toList(
        (overviewPayload.rankings as { tracks?: Array<{ trackName: string; ranking: unknown[] }> } | undefined)?.tracks
      ).map((track: { trackName: string; ranking: unknown[] }) => [track.trackName, toList(track.ranking)])
    );
    state.unresolvedTies = toList(overviewPayload.unresolvedTies);
    state.published = (overviewPayload.event as { resultsStatus?: string } | undefined)?.resultsStatus === "published";
    state.suggestedWinners =
      (overviewPayload.suggestedWinners as {
        overall: string | null;
        tracks: Record<string, string | null>;
      } | null) ?? null;
    state.scoreBasedWinnersApply = Boolean(overviewPayload.scoreBasedWinnersApply);

    const winners = toList(overviewPayload.winners) as Array<{
      scope: string;
      trackName?: string;
      submissionId: string;
    }>;
    const overallWinner = winners.find((winner) => winner.scope === "overall");
    const trackWinners = winners.filter((winner) => winner.scope === "track");
    state.winners = {
      overallWinnerId: overallWinner?.submissionId || "",
      trackWinners: Object.fromEntries(trackWinners.map((winner) => [winner.trackName, winner.submissionId]))
    };

    const winnerIds = new Set(winners.map((winner) => winner.submissionId));
    state.overallRanking = state.overallRanking.map((row) => ({
      ...(row as object),
      isWinner: winnerIds.has((row as { id: string }).id),
      hasTie: state.unresolvedTies.some((tie) =>
        toList((tie as { tiedSubmissionIds?: unknown[] }).tiedSubmissionIds).includes((row as { id: string }).id)
      )
    }));
  };

  const criterionRow = (criterion: { name?: string; weight?: number } = {}) => `
      <div class="card !p-6 border-cream/10 bg-cream/[0.03]" data-criterion-row>
        <div class="grid gap-4 md:grid-cols-[1fr_160px_auto] items-end">
          <div class="space-y-2">
            <label class="form-label">Criterion name</label>
            <input class="input-field" name="criterionName" value="${escapeHtml(criterion.name || "")}" placeholder="Originality" />
          </div>
          <div class="space-y-2">
            <label class="form-label">Weight</label>
            <input class="input-field" name="criterionWeight" type="number" min="0" step="0.1" value="${escapeHtml(criterion.weight ?? 1)}" />
          </div>
          <button class="w-10 h-10 rounded-full bg-cream/5 flex items-center justify-center hover:bg-coral/20 hover:text-coral transition-all" type="button" data-remove-criterion aria-label="Remove criterion">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    `;

  const apiJson = async (url: string, options: RequestInit = {}, statusEl: Element | null = null) => {
    try {
      setStatus(statusEl, "Saving...", "!text-sky");
      const response = await fetch(url, {
        headers: { "content-type": "application/json", ...(options.headers || {}) },
        ...options
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((payload as { error?: string }).error || `Request failed (${response.status})`);
      setStatus(statusEl, (payload as { message?: string }).message || "Saved", "!text-lime");
      return payload;
    } catch (error) {
      setStatus(statusEl, error instanceof Error ? error.message : "Error", "!text-coral");
      throw error;
    }
  };

  const renderRubric = () => {
    if (!elements.rubricRows) return;
    const rows = state.rubric.length ? state.rubric : [{ name: "Impact", weight: 1 }, { name: "Execution", weight: 1 }];
    elements.rubricRows.innerHTML = rows.map((criterion) => criterionRow(criterion as { name?: string; weight?: number })).join("");
    if (elements.rubricScale) elements.rubricScale.value = String((state.rubricMeta as { maxScore?: number })?.maxScore || 10);
    elements.rubricRows.querySelectorAll("[data-remove-criterion]").forEach((button) => {
      button.addEventListener("click", () => button.closest("[data-criterion-row]")?.remove());
    });
  };

  const renderJudgeLinks = () => {
    if (!elements.judgeLinks) return;
    const links = toList(state.judgeLinks) as Array<{
      id?: string;
      label?: string;
      revokedAt?: string;
      expiresAt?: string;
      hasPin?: number;
      createdAt?: string;
    }>;
    if (!links.length) {
      elements.judgeLinks.innerHTML = '<div class="text-sm text-cream/35 italic">No judge links yet.</div>';
      return;
    }
    const now = Date.now();
    elements.judgeLinks.innerHTML = links
      .map(
        (link) => `
        <div class="card !p-5 border-cream/10 bg-cream/[0.03]">
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <p class="font-bold">${escapeHtml(link.label || "Judge link")}</p>
                <p class="text-xs text-cream/40">${escapeHtml(link.id || "")}</p>
              </div>
              <span class="status-pill ${
                link.revokedAt
                  ? "!bg-coral/10 !text-coral !border-coral/20"
                  : new Date(link.expiresAt || 0).getTime() < now
                    ? "!bg-sky/10 !text-sky !border-sky/20"
                    : "!bg-lime/10 !text-lime !border-lime/20"
              }">
                ${link.revokedAt ? "Revoked" : new Date(link.expiresAt || 0).getTime() < now ? "Expired" : "Active"}
              </span>
            </div>
            <div class="text-sm text-cream/45">
              Expires ${escapeHtml(formatDate(link.expiresAt))}
              ${Number(link.hasPin) ? " · PIN protected" : ""}
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-cream/35">${escapeHtml(formatDate(link.createdAt))}</span>
              ${
                !link.revokedAt
                  ? `<button class="btn-ghost !px-4 !py-2 !text-xs" type="button" data-revoke-link data-link-id="${escapeHtml(link.id)}">Revoke</button>`
                  : ""
              }
            </div>
          </div>
        </div>
      `
      )
      .join("");
    elements.judgeLinks.querySelectorAll("[data-revoke-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const linkId = button.getAttribute("data-link-id");
        if (!linkId) return;
        await apiJson(`${baseApi}/judge-links/${linkId}/revoke`, { method: "POST" }, elements.linkStatus);
        await loadWorkspace();
      });
    });
  };

  const renderOverview = () => {
    if (!elements.overviewRows) return;
    const rankings = toList(state.overallRanking) as Array<Record<string, unknown>>;
    if (!rankings.length) {
      elements.overviewRows.innerHTML =
        '<tr><td colspan="7" class="py-8 text-cream/35 italic">No submissions scored yet.</td></tr>';
      return;
    }
    elements.overviewRows.innerHTML = rankings
      .map(
        (row, index) => `
        <tr class="${row.hasTie ? "bg-coral/5" : ""}">
          <td class="py-4 pr-4 font-bold">${escapeHtml(row.rank ?? index + 1)}</td>
          <td class="py-4 pr-4">
            <div class="font-bold">${escapeHtml((row.projectName || row.project_name || "Untitled project") as string)}</div>
            <div class="text-xs text-cream/40">${escapeHtml((row.description || "") as string)}</div>
          </td>
          <td class="py-4 pr-4">${escapeHtml(
            (row.track && String(row.track).trim()) || "Not specified"
          )}</td>
          <td class="py-4 pr-4">${escapeHtml((row.teamName || row.team_name || "") as string)}</td>
          <td class="py-4 pr-4"><span class="status-pill !bg-cream/5 !border-cream/10">${escapeHtml(
            (row.totalScore ?? row.score ?? "0") as string
          )}</span></td>
          <td class="py-4 pr-4">${escapeHtml((row.voteCount ?? row.votes ?? 0) as string)}</td>
          <td class="py-4">
            <div class="flex flex-wrap gap-2">
              ${row.isWinner ? '<span class="status-pill !bg-lime/10 !text-lime !border-lime/20">Winner</span>' : ""}
              ${row.hasTie ? '<span class="status-pill !bg-coral/10 !text-coral !border-coral/20">Tie</span>' : ""}
              ${
                row.popularityBadge
                  ? `<span class="status-pill !bg-sky/10 !text-sky !border-sky/20">${escapeHtml(row.popularityBadge as string)}</span>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  };

  const renderTieBreaks = () => {
    if (!elements.tieBreaks) return;
    const ties = toList(state.unresolvedTies) as Array<Record<string, unknown>>;
    setStatus(
      elements.tieStatus,
      ties.length ? `${ties.length} unresolved` : "All clear",
      ties.length ? "!text-coral" : "!text-lime"
    );
    if (!ties.length) {
      elements.tieBreaks.innerHTML = '<div class="text-sm text-cream/35 italic">No unresolved ties yet.</div>';
      return;
    }
    elements.tieBreaks.innerHTML = ties
      .map(
        (tie, index) => `
        <div
          class="card !p-5 border-coral/15 bg-coral/5 space-y-4"
          data-tie-row
          data-scope="${escapeHtml((tie.scope as string) || "overall")}"
          data-track-name="${escapeHtml((tie.trackName as string) || "")}"
          data-tie-id="${escapeHtml((tie.id as string) || String(index))}"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-bold">${escapeHtml(
                tie.scope === "track" ? `Track tie: ${tie.trackName}` : `Overall tie`
              )}</p>
              <p class="text-xs text-cream/40">${escapeHtml((tie.description as string) || "")}</p>
            </div>
            <span class="status-pill !bg-coral/10 !text-coral !border-coral/20">${escapeHtml(
              String(toList(tie.tiedSubmissionIds || tie.submissions || tie.submissionIds).length)
            )} projects</span>
          </div>
          <div class="grid gap-3">
            ${toList(tie.tiedSubmissionIds || tie.submissions || tie.submissionIds)
              .map((submissionId) => {
                const sid = String(submissionId);
                const submission = (state.submissions as Array<Record<string, unknown>>).find(
                  (item) => String(item.id) === sid
                ) || {};
                return `
                <label class="flex items-center gap-3 rounded-2xl border border-cream/10 bg-cream/[0.03] px-4 py-3">
                  <input type="radio" name="tie-${escapeHtml((tie.id as string) || String(index))}" value="${escapeHtml(
                  String(submission.id || submissionId)
                )}" class="accent-lime" ${tie.resolvedWinnerId === submission.id ? "checked" : ""} />
                  <span class="font-medium">${escapeHtml(
                    (submission.projectName ||
                      submission.project_name ||
                      submission.teamName ||
                      submission.team_name ||
                      submissionId) as string
                  )}</span>
                </label>
              `;
              })
              .join("")}
          </div>
        </div>
      `
      )
      .join("");

    elements.tieBreaks.querySelectorAll("[data-tie-row] input[type='radio']").forEach((input) => {
      input.addEventListener("change", () => {
        const row = input.closest("[data-tie-row]");
        const scope = row?.getAttribute("data-scope") || "overall";
        const trackName = row?.getAttribute("data-track-name") || "";
        if (scope === "overall" && elements.overallWinner) {
          (elements.overallWinner as HTMLSelectElement).value = (input as HTMLInputElement).value;
        } else {
          const select = elements.trackWinners?.querySelector(`[data-track-winner][data-track-name="${CSS.escape(trackName)}"]`);
          if (select) (select as HTMLSelectElement).value = (input as HTMLInputElement).value;
        }
      });
    });
  };

  const renderWinnerControls = () => {
    if (!elements.overallWinner || !elements.trackWinners) return;
    const submissions = toList(state.submissions) as Array<Record<string, unknown>>;
    elements.overallWinner.innerHTML = [
      '<option value="">Select a submission</option>',
      ...submissions.map(
        (submission) =>
          `<option value="${escapeHtml(String(submission.id))}">${escapeHtml(
            (submission.projectName || submission.teamName || submission.id) as string
          )}</option>`
      )
    ].join("");
    if (state.winners.overallWinnerId) (elements.overallWinner as HTMLSelectElement).value = String(state.winners.overallWinnerId);
    const tracks = toList(state.tracks) as Array<{ name: string }>;
    if (!tracks.length) {
      elements.trackWinners.innerHTML =
        '<div class="text-sm text-cream/35 italic">No tracks configured for this event.</div>';
      const lockWinners =
        state.published || (state.scoreBasedWinnersApply && !state.manualOverride && !state.published);
      if (elements.overallWinner) (elements.overallWinner as HTMLSelectElement).disabled = lockWinners;
      if (elements.manualWinnerOverride) elements.manualWinnerOverride.disabled = state.published;
      return;
    }
    elements.trackWinners.innerHTML = tracks
      .map(
        (track) => `
        <div class="space-y-2">
          <label class="form-label" for="track-winner-${escapeHtml(track.name)}">${escapeHtml(track.name)}</label>
          <select class="input-field" id="track-winner-${escapeHtml(track.name)}" data-track-winner data-track-name="${escapeHtml(track.name)}">
            <option value="">Select a submission</option>
            ${submissions
              .map(
                (submission) =>
                  `<option value="${escapeHtml(String(submission.id))}">${escapeHtml(
                    (submission.projectName || submission.teamName || submission.id) as string
                  )}</option>`
              )
              .join("")}
          </select>
        </div>
      `
      )
      .join("");
    elements.trackWinners.querySelectorAll("[data-track-winner]").forEach((select) => {
      const trackName = select.getAttribute("data-track-name");
      const winnerId = trackName ? state.winners.trackWinners?.[trackName] : undefined;
      if (winnerId) (select as HTMLSelectElement).value = String(winnerId);
    });

    const lockWinners =
      state.published || (state.scoreBasedWinnersApply && !state.manualOverride && !state.published);
    if (elements.overallWinner) (elements.overallWinner as HTMLSelectElement).disabled = lockWinners;
    elements.trackWinners?.querySelectorAll("[data-track-winner]").forEach((select) => {
      (select as HTMLSelectElement).disabled = lockWinners;
    });
    if (elements.manualWinnerOverride) {
      elements.manualWinnerOverride.disabled = state.published;
    }
  };

  const updateWinnerHints = () => {
    if (elements.scoreBasedWinnersHint) {
      if (state.scoreBasedWinnersApply && !state.published) {
        elements.scoreBasedWinnersHint.classList.remove("hidden");
      } else {
        elements.scoreBasedWinnersHint.classList.add("hidden");
      }
    }
    if (elements.winnersHint) {
      if (state.published) {
        elements.winnersHint.textContent = "Results are published.";
      } else if (state.scoreBasedWinnersApply && !state.manualOverride) {
        elements.winnersHint.textContent =
          "Winners follow the leaderboard when there are no ties. Use manual override to pick someone else, then save.";
      } else {
        elements.winnersHint.textContent = "Select winners before publishing results.";
      }
    }
  };

  const syncStats = () => {
    if (elements.statCriteria) elements.statCriteria.textContent = String(toList(state.rubric).length);
    if (elements.statJudgeLinks) elements.statJudgeLinks.textContent = String(toList(state.judgeLinks).length);
    if (elements.statTies) elements.statTies.textContent = String(toList(state.unresolvedTies).length);
    if (elements.statResults) elements.statResults.textContent = state.published ? "Published" : "Draft";
    setStatus(
      elements.overviewStatus,
      state.published ? "Results published" : "Draft only",
      state.published ? "!text-lime" : "!text-sky"
    );
  };

  const renderWorkspace = () => {
    const ev = state.event as { title?: string; slug?: string; organizerId?: string } | null;
    if (elements.title && ev) elements.title.textContent = ev.title || "Judging workspace";
    if (elements.publicLink && ev?.slug) {
      const organizerId = String(ev.organizerId || "");
      (elements.publicLink as HTMLAnchorElement).href = organizerId
        ? `/events/${organizerId}/${ev.slug}`
        : `/events/${ev.slug}`;
    }
    renderRubric();
    renderJudgeLinks();
    renderOverview();
    renderTieBreaks();
    renderWinnerControls();
    updateWinnerHints();
    syncStats();
  };

  const readRubric = () => ({
    minScore: 1,
    maxScore: Number((elements.rubricScale as HTMLSelectElement | null)?.value || 10),
    title: (state.rubricMeta as { title?: string })?.title || "Judging Rubric",
    description: (state.rubricMeta as { description?: string })?.description || "",
    criteria: Array.from(elements.rubricRows?.querySelectorAll("[data-criterion-row]") || []).map((row) => ({
      name: (row.querySelector('[name="criterionName"]') as HTMLInputElement)?.value?.trim() || "",
      weight: (row.querySelector('[name="criterionWeight"]') as HTMLInputElement)?.value?.trim() || ""
    })).filter((criterion) => criterion.name)
  });

  const readWinnerPayload = () => ({
    overallWinnerSubmissionId: (elements.overallWinner as HTMLSelectElement | null)?.value || "",
    trackWinners: Array.from(elements.trackWinners?.querySelectorAll("[data-track-winner]") || []).map((select) => ({
      trackName: select.getAttribute("data-track-name") || "",
      submissionId: (select as HTMLSelectElement).value || ""
    })).filter((row) => row.trackName && row.submissionId),
    note: (elements.winnersForm?.querySelector('[name="notes"]') as HTMLTextAreaElement)?.value || ""
  });

  const loadWorkspace = async () => {
    if (!eventId) return;
    try {
      const [eventRes, rubricRes, linksRes, overviewRes] = await Promise.all([
        fetch(`${baseApi}`),
        fetch(`${baseApi}/rubric`),
        fetch(`${baseApi}/judge-links`),
        fetch(`${baseApi}/judging-overview`)
      ]);

      if (eventRes.status === 401) {
        window.location.href = "/organizer/login";
        return;
      }

      const eventPayload = await eventRes.json().catch(() => ({}));
      const rubricPayload = await rubricRes.json().catch(() => ({}));
      const linksPayload = await linksRes.json().catch(() => ({}));
      const overviewPayload = await overviewRes.json().catch(() => ({}));

      if (!eventRes.ok) throw new Error((eventPayload as { error?: string }).error || "Unable to load event.");
      if (!rubricRes.ok) throw new Error((rubricPayload as { error?: string }).error || "Unable to load rubric.");
      if (!linksRes.ok) throw new Error((linksPayload as { error?: string }).error || "Unable to load judge links.");
      if (!overviewRes.ok) throw new Error((overviewPayload as { error?: string }).error || "Unable to load judging overview.");

      state.event = (eventPayload as { event: Record<string, unknown> }).event || null;
      state.tracks = toList((eventPayload as { tracks?: unknown[] }).tracks);
      state.rubricMeta = (rubricPayload as { rubric: Record<string, unknown> }).rubric || null;
      state.rubric = toList((rubricPayload as { criteria?: unknown[] }).criteria);
      state.judgeLinks = toList((linksPayload as { links?: unknown[] }).links);

      applyJudgingOverviewPayload(overviewPayload as Record<string, unknown>);

      state.manualOverride = sessionStorage.getItem(manualOverrideKey) === "1";
      if (elements.manualWinnerOverride) elements.manualWinnerOverride.checked = state.manualOverride;

      const winnersAfterApply = toList(
        (overviewPayload as { winners?: Array<{ scope: string; trackName?: string; submissionId: string }> }).winners
      );
      const suggested = state.suggestedWinners;
      if (
        !state.published &&
        !state.manualOverride &&
        state.scoreBasedWinnersApply &&
        suggested &&
        !winnersMatchSuggested(winnersAfterApply, suggested)
      ) {
        try {
          const response = await fetch(`${baseApi}/winners`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(buildSuggestedWinnerPayload(suggested))
          });
          const syncPayload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error((syncPayload as { error?: string }).error || "Unable to sync score-based winners.");
          }
          const overviewRes2 = await fetch(`${baseApi}/judging-overview`);
          const overviewPayload2 = await overviewRes2.json().catch(() => ({}));
          if (!overviewRes2.ok) {
            throw new Error((overviewPayload2 as { error?: string }).error || "Unable to reload judging overview.");
          }
          applyJudgingOverviewPayload(overviewPayload2 as Record<string, unknown>);
        } catch (error) {
          setStatus(
            elements.winnerStatus,
            error instanceof Error ? error.message : "Unable to sync winners.",
            "!text-coral"
          );
        }
      }

      if (elements.rubricScale) {
        elements.rubricScale.value = String((rubricPayload as { rubric?: { maxScore?: number } }).rubric?.maxScore || 10);
      }
      renderWorkspace();
    } catch (error) {
      setStatus(elements.overviewStatus, error instanceof Error ? error.message : "Error", "!text-coral");
    }
  };

  elements.addCriterion?.addEventListener("click", () => {
    elements.rubricRows?.insertAdjacentHTML("beforeend", criterionRow({}));
  });

  elements.rubricForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await apiJson(`${baseApi}/rubric`, { method: "PUT", body: JSON.stringify(readRubric()) }, elements.rubricStatus);
    await loadWorkspace();
  });

  elements.judgeLinkForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const payload = {
      label: String(formData.get("label") || "").trim(),
      expiresAt: String(formData.get("expiresAt") || "").trim(),
      pin: String(formData.get("pin") || "").trim()
    };
    const result = (await apiJson(`${baseApi}/judge-links`, { method: "POST", body: JSON.stringify(payload) }, elements.linkStatus)) as {
      link?: { token?: string };
    };
    const generatedToken = result.link?.token || "";
    const generated = generatedToken ? `${window.location.origin}/judge/${generatedToken}` : "";
    if (generated && elements.generatedLinkWrap && elements.generatedLink) {
      (elements.generatedLink as HTMLInputElement).value = generated;
      elements.generatedLinkWrap.classList.remove("hidden");
    }
    await loadWorkspace();
  });

  elements.copyLink?.addEventListener("click", async () => {
    const value = (elements.generatedLink as HTMLInputElement | null)?.value || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus(elements.linkStatus, "Copied link", "!text-lime");
    } catch {
      setStatus(elements.linkStatus, "Copy failed", "!text-coral");
    }
  });

  elements.winnersForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const locked =
      state.published || (state.scoreBasedWinnersApply && !state.manualOverride && !state.published);
    if (locked) {
      if (elements.overallWinner) (elements.overallWinner as HTMLSelectElement).disabled = false;
      elements.trackWinners?.querySelectorAll("[data-track-winner]").forEach((select) => {
        (select as HTMLSelectElement).disabled = false;
      });
    }
    try {
      await apiJson(`${baseApi}/winners`, { method: "PUT", body: JSON.stringify(readWinnerPayload()) }, elements.winnerStatus);
      await loadWorkspace();
    } catch {
      if (locked) renderWinnerControls();
    }
  });

  elements.manualWinnerOverride?.addEventListener("change", async () => {
    const on = Boolean(elements.manualWinnerOverride?.checked);
    sessionStorage.setItem(manualOverrideKey, on ? "1" : "");
    state.manualOverride = on;
    if (!on) {
      await loadWorkspace();
    } else {
      renderWinnerControls();
      updateWinnerHints();
    }
  });

  elements.publishBtn?.addEventListener("click", async () => {
    await apiJson(`${baseApi}/publish-results`, { method: "POST" }, elements.winnerStatus);
    await loadWorkspace();
  });

  if (elements.judgeLinkForm) {
    const expiresField = elements.judgeLinkForm.querySelector('[name="expiresAt"]') as HTMLInputElement | null;
    if (expiresField && !expiresField.value) {
      const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      expiresField.value = formatDateForInput(defaultExpiry.toISOString());
    }
  }

  void loadWorkspace();
}
