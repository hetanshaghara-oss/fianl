// ============================================
// Frontend JavaScript — WorldCup 2026 ELO Analyst AI
// ============================================

const API_BASE = "/api"; // Use relative URL (same origin)

// ============================================
// STATE
// ============================================
const state = {
  currentView: "dashboard",
  chatHistory: [],
  messageCount: 0,
  isDarkMode: true,
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
  navBtns:        document.querySelectorAll(".nav-btn"),
  views:          document.querySelectorAll(".view"),
  messages:       document.getElementById("messages"),
  chatInput:      document.getElementById("chat-input"),
  sendBtn:        document.getElementById("send-btn"),
  themeBtn:       document.getElementById("theme-btn"),
  rankingsList:   document.getElementById("rankings-list"),
  teamSearch:     document.getElementById("team-search"),
  teamSearchBtn:  document.getElementById("team-search-btn"),
  teamDetails:    document.getElementById("team-details"),
  team1Input:     document.getElementById("team1-input"),
  team2Input:     document.getElementById("team2-input"),
  compareBtn:     document.getElementById("compare-btn"),
  h2hResult:      document.getElementById("h2h-result"),
  confList:       document.getElementById("confederations-list"),

  // Dashboard
  dashTotalTeams: document.getElementById("dash-total-teams"),
  dashAvgRating:  document.getElementById("dash-avg-rating"),
  dashTopConfed:  document.getElementById("dash-top-confed"),
  podiumContainer:document.getElementById("podium-container"),

  // System Status
  dotMongo:  document.getElementById("dot-mongo"),
  dotGemini: document.getElementById("dot-gemini"),
  dotElo:    document.getElementById("dot-elo"),
  labelElo:  document.getElementById("label-elo"),
};

// ============================================
// SESSION ID (persisted in localStorage)
// ============================================
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });
    localStorage.setItem("chat_session_id", sessionId);
  }
  return sessionId;
}

// ============================================
// SYSTEM STATUS — polls /api/mcp-status
// ============================================
async function updateSystemStatus() {
  try {
    const res = await fetch(`${API_BASE}/mcp-status`);
    const data = await res.json();

    setDot(elements.dotMongo,  data.mongodb);
    setDot(elements.dotGemini, data.gemini);
    setDot(elements.dotElo,    data.eloDataLoaded);

    if (elements.labelElo) {
      elements.labelElo.textContent = data.eloDataLoaded
        ? `ELO Data (${data.recordsLoaded.toLocaleString()})`
        : "ELO Data — Not Loaded";
    }

    // Chat status badge
    const statusDot  = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    if (statusDot && statusText) {
      setDot(statusDot, data.gemini, true);
      statusText.textContent = data.gemini ? "Gemini AI Ready" : "AI Unavailable";
    }
  } catch (err) {
    console.error("Status check failed:", err);
  }
}

function setDot(el, isActive, useFallback = false) {
  if (!el) return;
  el.className = "status-dot " + (isActive ? "connected" : (useFallback ? "fallback" : "disconnected"));
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 WorldCup 2026 ELO Analyst AI — Frontend Loaded");

  setupNavigation();
  setupChat();
  setupSuggestionChips();
  setupTheme();
  setupRankings();
  setupTeamDetails();
  setupH2H();
  setupDashboard();
  setupConfederations();

  updateSystemStatus();
  // Refresh status every 30 seconds
  setInterval(updateSystemStatus, 30000);
});

// ============================================
// DASHBOARD
// ============================================
async function setupDashboard() {
  try {
    const res  = await fetch(`${API_BASE}/rankings?limit=100`);
    const data = await res.json();
    if (!data.teams || data.teams.length === 0) return;

    elements.dashTotalTeams.textContent = data.teams.length;

    const avgRating = data.teams.reduce((acc, t) => acc + t.rating, 0) / data.teams.length;
    elements.dashAvgRating.textContent  = Math.round(avgRating);

    const confeds = {};
    data.teams.forEach((t) => {
      confeds[t.confederation] = (confeds[t.confederation] || 0) + 1;
    });
    const topConfed = Object.keys(confeds).reduce((a, b) =>
      confeds[a] > confeds[b] ? a : b
    );
    elements.dashTopConfed.textContent = topConfed;

    // Podium (Top 3)
    const top3 = data.teams.slice(0, 3);
    elements.podiumContainer.innerHTML = top3
      .map((team, idx) => {
        const medals = ["🥇", "🥈", "🥉"];
        return `
          <div class="team-card podium-card" onclick="document.getElementById('nav-rankings').click()">
            <div class="podium-medal">${medals[idx]}</div>
            <div class="team-name">${team.country}</div>
            <div class="podium-rating">${team.rating} ELO</div>
            <div class="confederation">${team.confederation || ""}</div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigation() {
  elements.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function switchView(viewName) {
  elements.views.forEach((v) => v.classList.remove("active"));
  elements.navBtns.forEach((b) => b.classList.remove("active"));

  const viewEl = document.getElementById(`${viewName}-view`);
  const navEl  = document.querySelector(`[data-view="${viewName}"]`);
  if (viewEl) viewEl.classList.add("active");
  if (navEl)  navEl.classList.add("active");

  state.currentView = viewName;

  if (viewName === "rankings")       loadRankings();
  if (viewName === "confederations") loadConfederations();
  if (viewName === "chat")           updateSystemStatus();
}

// ============================================
// SUGGESTION CHIPS
// ============================================
function setupSuggestionChips() {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const msg = chip.dataset.msg;
      if (msg && elements.chatInput) {
        elements.chatInput.value = msg;
        sendMessage();
      }
    });
  });
}

// ============================================
// CHAT
// ============================================
function setupChat() {
  elements.sendBtn.addEventListener("click", sendMessage);
  elements.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

async function sendMessage() {
  const message = elements.chatInput.value.trim();
  if (!message) return;

  // Show user message
  addMessage(message, "user");
  elements.chatInput.value = "";

  // Track history
  state.chatHistory.push({ role: "user", content: message });

  // Show typing indicator
  const loadingId = addMessage("", "loading");
  document.getElementById(loadingId).innerHTML =
    '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

  try {
    const sessionId = getOrCreateSessionId();

    // Primary: /api/agent-chat (handles Agent Builder or Gemini fallback)
    let data = null;
    try {
      const res = await fetch(`${API_BASE}/agent-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, history: state.chatHistory }),
      });
      if (res.ok) {
        data = await res.json();
      } else {
        throw new Error(`agent-chat returned ${res.status}`);
      }
    } catch (agentErr) {
      // Hard fallback: /api/chat
      console.warn("⚠️ Falling back to /api/chat:", agentErr.message);
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, history: state.chatHistory }),
      });
      data = await res.json();
      if (data && !data.source) data.source = "gemini";
    }

    // Remove loading
    document.getElementById(loadingId)?.remove();

    if (data && data.success) {
      const reply  = data.reply || "No response";
      const source = data.source || "gemini";
      addMessage(reply, "assistant", source);
      state.chatHistory.push({ role: "assistant", content: reply });
    } else {
      addMessage(`❌ Error: ${data?.error || "Unknown error"}`, "error");
    }
  } catch (err) {
    document.getElementById(loadingId)?.remove();
    addMessage(`❌ Network error: ${err.message}`, "error");
    console.error("Chat error:", err);
  }
}

function addMessage(text, sender, source = null) {
  const el  = document.createElement("div");
  el.className = `message ${sender}`;
  el.id = `msg-${state.messageCount++}`;

  if (sender === "assistant") {
    // Render formatted text (newlines, preformatted sections)
    const pre = document.createElement("pre");
    pre.className = "ai-response-text";
    pre.textContent = text;
    el.appendChild(pre);

    if (source) {
      const badge = document.createElement("span");
      badge.className = "source-badge " +
        (source === "google-agent-builder" ? "source-google" : "source-gemini");
      badge.textContent = source === "google-agent-builder" ? "🤖 Google Agent" : "⚡ Gemini AI";
      el.appendChild(badge);
    }
  } else if (sender === "user" || sender === "error") {
    el.textContent = text;
  }
  // loading: innerHTML set by caller

  elements.messages.appendChild(el);
  elements.messages.scrollTop = elements.messages.scrollHeight;
  return el.id;
}

// ============================================
// RANKINGS
// ============================================
function setupRankings() {
  // Auto-load when view is switched; nothing extra needed here
}

async function loadRankings() {
  try {
    elements.rankingsList.innerHTML = '<div class="loading">Loading rankings...</div>';
    const res  = await fetch(`${API_BASE}/rankings?limit=100`);
    const data = await res.json();

    if (!data.teams || data.teams.length === 0) {
      elements.rankingsList.innerHTML = '<p class="placeholder">No teams found</p>';
      return;
    }

    elements.rankingsList.innerHTML = data.teams
      .map(
        (team, idx) => `
        <div class="team-card" onclick="searchTeamByName('${escHtml(team.country)}')">
          <div class="team-rank">#${idx + 1}</div>
          <div class="team-name">${escHtml(team.country)}</div>
          <div class="team-info">
            <div class="info-item">
              <span class="info-label">ELO Rating</span>
              <span class="info-value elo-highlight">${team.rating}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Wins</span>
              <span class="info-value">${team.wins ?? "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Losses</span>
              <span class="info-value">${team.losses ?? "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Draws</span>
              <span class="info-value">${team.draws ?? "—"}</span>
            </div>
          </div>
          <div class="confederation">${escHtml(team.confederation || "")}</div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    elements.rankingsList.innerHTML = `<p class="error-message">❌ Error loading rankings: ${err.message}</p>`;
    console.error("Rankings error:", err);
  }
}

// ============================================
// TEAM DETAILS
// ============================================
function setupTeamDetails() {
  elements.teamSearchBtn.addEventListener("click", searchTeam);
  elements.teamSearch.addEventListener("keypress", (e) => {
    if (e.key === "Enter") { e.preventDefault(); searchTeam(); }
  });
}

// Called from ranking cards
function searchTeamByName(name) {
  switchView("team");
  elements.teamSearch.value = name;
  searchTeam();
}

async function searchTeam() {
  const teamName = elements.teamSearch.value.trim();
  if (!teamName) { alert("Please enter a team name"); return; }

  elements.teamDetails.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const res = await fetch(`${API_BASE}/team/${encodeURIComponent(teamName)}`);

    if (!res.ok) {
      const err = await res.json();
      elements.teamDetails.innerHTML = `<p class="error-message">❌ ${err.error || `Team "${teamName}" not found`}</p>`;
      return;
    }

    const data    = await res.json();
    const team    = data.current;
    const history = data.history || [];

    elements.teamDetails.innerHTML = `
      <div class="team-details-card">
        <div class="detail-section">
          <h3>Current Stats — 2026</h3>
          ${detailRow("Country",      team.country)}
          ${detailRow("ELO Rating",   `<span class="elo-highlight">${team.rating}</span>`)}
          ${detailRow("World Rank",   `#${team.rank ?? "—"}`)}
          ${detailRow("Confederation", team.confederation || "—")}
        </div>
        <div class="detail-section">
          <h3>Match Statistics</h3>
          ${detailRow("Total Matches", team.matches_total ?? "—")}
          ${detailRow("Wins",          team.wins ?? "—")}
          ${detailRow("Losses",        team.losses ?? "—")}
          ${detailRow("Draws",         team.draws ?? "—")}
          ${detailRow("Goals For",     team.goals_for ?? "—")}
          ${detailRow("Goals Against", team.goals_against ?? "—")}
        </div>
      </div>

      <div class="history-chart">
        <h3>ELO Rating History (Last 10 Records)</h3>
        ${history
          .slice(-10)
          .map(
            (h) => `
          <div class="history-point">
            <span class="history-year">${h.year}</span>
            <div class="history-bar">
              <div class="history-fill" style="width:${Math.min((h.rating / 2200) * 100, 100)}%"></div>
            </div>
            <span class="history-rating">${h.rating}</span>
          </div>`
          )
          .join("")}
      </div>
    `;
  } catch (err) {
    elements.teamDetails.innerHTML = `<p class="error-message">❌ Error: ${err.message}</p>`;
    console.error("Team search error:", err);
  }
}

function detailRow(label, value) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value">${value}</span>
  </div>`;
}

// ============================================
// HEAD TO HEAD
// ============================================
function setupH2H() {
  elements.compareBtn.addEventListener("click", compareTeams);
  [elements.team1Input, elements.team2Input].forEach((inp) => {
    inp.addEventListener("keypress", (e) => {
      if (e.key === "Enter") { e.preventDefault(); compareTeams(); }
    });
  });
}

async function compareTeams() {
  const team1 = elements.team1Input.value.trim();
  const team2 = elements.team2Input.value.trim();

  if (!team1 || !team2) { alert("Please enter both team names"); return; }
  if (team1.toLowerCase() === team2.toLowerCase()) { alert("Please enter two different teams"); return; }

  elements.h2hResult.innerHTML = '<div class="loading">Comparing teams...</div>';

  try {
    const res = await fetch(
      `${API_BASE}/h2h?team1=${encodeURIComponent(team1)}&team2=${encodeURIComponent(team2)}`
    );

    if (!res.ok) {
      const err = await res.json();
      elements.h2hResult.innerHTML = `<p class="error-message">❌ ${err.error}</p>`;
      return;
    }

    const data = await res.json();
    const t1   = data.team1;
    const t2   = data.team2;
    const fav  = data.favorite;

    elements.h2hResult.innerHTML = `
      <div class="h2h-comparison">
        <div class="h2h-team ${fav === t1.country ? 'h2h-winner' : ''}">
          <div class="h2h-team-name">${escHtml(t1.country)}</div>
          ${fav === t1.country ? '<div class="fav-badge">⭐ Favourite</div>' : ''}
          <div class="h2h-stat"><span class="stat-label">ELO Rating</span><span class="stat-value elo-highlight">${t1.rating}</span></div>
          <div class="h2h-stat"><span class="stat-label">World Rank</span><span class="stat-value">#${t1.rank ?? "—"}</span></div>
          <div class="h2h-stat"><span class="stat-label">Wins</span><span class="stat-value">${t1.wins ?? "—"}</span></div>
          <div class="h2h-stat"><span class="stat-label">Win Probability</span><span class="stat-value prob-value">${t1.win_probability}</span></div>
          <div class="prob-bar-wrap">
            <div class="prob-bar" style="width:${t1.win_probability_num}%"></div>
          </div>
        </div>

        <div class="h2h-vs-col">
          <div class="vs-circle">⚽</div>
          <div class="rating-diff-label">ELO Diff</div>
          <div class="probability-value">Δ${data.rating_difference}</div>
        </div>

        <div class="h2h-team ${fav === t2.country ? 'h2h-winner' : ''}">
          <div class="h2h-team-name">${escHtml(t2.country)}</div>
          ${fav === t2.country ? '<div class="fav-badge">⭐ Favourite</div>' : ''}
          <div class="h2h-stat"><span class="stat-label">ELO Rating</span><span class="stat-value elo-highlight">${t2.rating}</span></div>
          <div class="h2h-stat"><span class="stat-label">World Rank</span><span class="stat-value">#${t2.rank ?? "—"}</span></div>
          <div class="h2h-stat"><span class="stat-label">Wins</span><span class="stat-value">${t2.wins ?? "—"}</span></div>
          <div class="h2h-stat"><span class="stat-label">Win Probability</span><span class="stat-value prob-value">${t2.win_probability}</span></div>
          <div class="prob-bar-wrap">
            <div class="prob-bar" style="width:${t2.win_probability_num}%"></div>
          </div>
        </div>
      </div>
      <div class="elo-formula-note">
        📐 Formula: Win% = 1 / (1 + 10^((opp_rating − my_rating) / 400)) | Data: ELO 2026
      </div>
    `;
  } catch (err) {
    elements.h2hResult.innerHTML = `<p class="error-message">❌ Error: ${err.message}</p>`;
    console.error("H2H error:", err);
  }
}

// ============================================
// CONFEDERATIONS (NEW)
// ============================================
function setupConfederations() {
  // Will auto-load when view is switched
}

async function loadConfederations() {
  elements.confList.innerHTML = '<div class="loading">Loading confederations...</div>';
  try {
    const res  = await fetch(`${API_BASE}/confederations`);
    const data = await res.json();

    if (!data.confederations || data.confederations.length === 0) {
      elements.confList.innerHTML = '<p class="placeholder">No data found</p>';
      return;
    }

    elements.confList.innerHTML = data.confederations
      .map(
        (c) => `
        <div class="conf-card">
          <div class="conf-name">🌍 ${escHtml(c.confederation)}</div>
          <div class="conf-stats">
            <div class="conf-stat">
              <span class="conf-stat-label">Teams</span>
              <span class="conf-stat-value">${c.teamCount}</span>
            </div>
            <div class="conf-stat">
              <span class="conf-stat-label">Avg ELO</span>
              <span class="conf-stat-value elo-highlight">${c.avgRating}</span>
            </div>
            <div class="conf-stat">
              <span class="conf-stat-label">Top Team</span>
              <span class="conf-stat-value">${escHtml(c.topTeam.country)} (${c.topTeam.rating})</span>
            </div>
          </div>
          <div class="conf-teams-list">
            ${c.teams
              .slice(0, 8)
              .map(
                (t, i) => `
              <div class="conf-team-row">
                <span class="conf-team-rank">${i + 1}.</span>
                <span class="conf-team-name">${escHtml(t.country)}</span>
                <span class="conf-team-rating">${t.rating}</span>
              </div>`
              )
              .join("")}
            ${c.teams.length > 8 ? `<div class="conf-more">+${c.teams.length - 8} more teams</div>` : ""}
          </div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    elements.confList.innerHTML = `<p class="error-message">❌ Error: ${err.message}</p>`;
    console.error("Confederations error:", err);
  }
}

// ============================================
// THEME TOGGLE
// ============================================
function setupTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  if (saved === "light") toggleTheme();
  elements.themeBtn.addEventListener("click", toggleTheme);
}

function toggleTheme() {
  state.isDarkMode = !state.isDarkMode;
  document.body.classList.toggle("light-mode", !state.isDarkMode);
  elements.themeBtn.textContent = state.isDarkMode ? "🌙 Dark Mode" : "☀️ Light Mode";
  localStorage.setItem("theme", state.isDarkMode ? "dark" : "light");
}

// ============================================
// UTILS
// ============================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

console.log("✅ WorldCup 2026 ELO Analyst AI — app.js loaded");