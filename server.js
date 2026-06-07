// server.js - Main Backend Server
// WorldCup 2026 ELO Analyst AI — Powered by Google Gemini

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve frontend from /public

// ─────────────────────────────────────────
// LOAD ELO DATA FROM JSON FILE
// ─────────────────────────────────────────
let eloData = [];
try {
  const filePath = process.env.ELO_DATA_FILE || "./elo_ratings_wc2026.json";
  const raw = fs.readFileSync(filePath, "utf8");
  eloData = JSON.parse(raw);
  console.log(`✅ ELO data loaded (${eloData.length} records)`);
} catch (err) {
  console.error("❌ Failed to load ELO data:", err.message);
}

// ─────────────────────────────────────────
// LOAD SYSTEM PROMPT
// ─────────────────────────────────────────
let systemPrompt = "";
try {
  systemPrompt = fs.readFileSync("./system_prompt.txt", "utf8");
} catch (err) {
  console.error("❌ Failed to load system_prompt.txt:", err.message);
  systemPrompt = "You are a WorldCup 2026 ELO Analyst AI.";
}

// ─────────────────────────────────────────
// MONGODB ATLAS CONNECTION
// ─────────────────────────────────────────
let db = null;
let chatQueriesCollection = null;   // chat_queries  (NEW — per requirements)
let conversationsCollection = null; // agent_conversations (legacy)

// Track Gemini availability
let geminiAvailable = false;

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.warn("⚠️  MONGODB_URI not set — MongoDB disabled");
      return;
    }
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db("worldcup2026");
    chatQueriesCollection    = db.collection("chat_queries");
    conversationsCollection  = db.collection("agent_conversations");
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
}

// In-memory conversation history cache (fallback when MongoDB is disconnected or for fast retrieval)
const sessionHistoryCache = new Map();

// ─────────────────────────────────────────
// HELPER: LOG CHAT QUERY TO MONGODB & CACHE
// Stores in chat_queries per requirements
// ─────────────────────────────────────────
async function logChatQuery({ sessionId, userMessage, aiResponse, source }) {
  const sid = sessionId || "default";
  
  // Store in-memory cache first (always available)
  if (!sessionHistoryCache.has(sid)) {
    sessionHistoryCache.set(sid, []);
  }
  const history = sessionHistoryCache.get(sid);
  history.push({ role: "user", content: userMessage });
  history.push({ role: "assistant", content: aiResponse });
  
  // Keep cache size bounded (last 50 messages)
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  if (!chatQueriesCollection) return;
  try {
    await chatQueriesCollection.insertOne({
      sessionId: sid,
      userMessage,
      aiResponse,
      source: source || "gemini",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("❌ MongoDB log error:", err.message);
  }
}

// ─────────────────────────────────────────
// HELPER: GET ALL 2026 TEAMS (deduplicated, sorted)
// ─────────────────────────────────────────
function get2026Data() {
  const yearData = eloData.filter((d) => d.year === 2026);
  yearData.sort((a, b) => b.rating - a.rating);

  const seen = new Set();
  const unique = [];
  for (const team of yearData) {
    if (!seen.has(team.country)) {
      seen.add(team.country);
      unique.push(team);
    }
  }
  return unique;
}

// ─────────────────────────────────────────
// HELPER: FIND A SINGLE TEAM IN 2026 DATA
// Case-insensitive, returns null if not found
// ─────────────────────────────────────────
function findTeam(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return eloData.find(
    (d) => d.country.toLowerCase() === lower && d.year === 2026
  ) || null;
}

// ─────────────────────────────────────────
// HELPER: GET TEAM RATING HISTORY (all years)
// ─────────────────────────────────────────
function getTeamHistory(country) {
  return eloData
    .filter((d) => d.country.toLowerCase() === country.toLowerCase())
    .sort((a, b) => a.year - b.year);
}

// ─────────────────────────────────────────
// HELPER: ELO WIN PROBABILITY FORMULA
// Win% = 1 / (1 + 10^((oppRating - myRating) / 400))
// ─────────────────────────────────────────
function eloWinProbability(myRating, oppRating) {
  return ((1 / (1 + Math.pow(10, (oppRating - myRating) / 400))) * 100).toFixed(1);
}

// ─────────────────────────────────────────
// HELPER: EXTRACT TEAM NAMES FROM USER MESSAGE
// Simple keyword matching to detect matchup queries
// ─────────────────────────────────────────
function extractTeamsFromMessage(message) {
  const teams2026 = get2026Data().map((t) => t.country.toLowerCase());
  const words = message.toLowerCase();
  const found = [];
  for (const name of teams2026) {
    if (words.includes(name)) {
      found.push(name);
    }
  }
  return found;
}

// ─────────────────────────────────────────
// HELPER: BUILD DATA CONTEXT FOR GEMINI
// Pulls relevant ELO records so Gemini always
// answers from real data, never hallucinating
// ─────────────────────────────────────────
function buildChatContext(userMessage) {
  const mentionedTeamNames = extractTeamsFromMessage(userMessage);
  const context = {
    year: 2026,
    teamsUsed: [],
    rankings: [],          // top-20 for general queries
    matchPredictions: [],  // calculated if 2 teams detected
    teamDetails: [],       // full stats for mentioned teams
  };

  // Always include top-20 for ranking/general questions
  context.rankings = get2026Data().slice(0, 20).map((t, i) => ({
    rank: i + 1,
    country: t.country,
    rating: t.rating,
    confederation: t.confederation,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
  }));

  // For each mentioned team, pull full stats + history snippet
  for (const teamName of mentionedTeamNames) {
    const team = findTeam(teamName);
    if (team) {
      context.teamsUsed.push(team.country);
      const history = getTeamHistory(team.country).slice(-5); // last 5 years
      context.teamDetails.push({
        country: team.country,
        rating: team.rating,
        rank: team.rank,
        confederation: team.confederation,
        wins: team.wins,
        losses: team.losses,
        draws: team.draws,
        goals_for: team.goals_for,
        goals_against: team.goals_against,
        matches_total: team.matches_total,
        recentHistory: history.map((h) => ({ year: h.year, rating: h.rating })),
      });
    }
  }

  // If exactly 2 teams mentioned → calculate win probabilities
  if (context.teamsUsed.length >= 2) {
    const t1 = findTeam(context.teamsUsed[0]);
    const t2 = findTeam(context.teamsUsed[1]);
    if (t1 && t2) {
      context.matchPredictions.push({
        team1: { country: t1.country, rating: t1.rating },
        team2: { country: t2.country, rating: t2.rating },
        team1WinProb: eloWinProbability(t1.rating, t2.rating) + "%",
        team2WinProb: eloWinProbability(t2.rating, t1.rating) + "%",
        ratingDiff: Math.abs(t1.rating - t2.rating),
        formula: `1/(1+10^((${t2.rating}-${t1.rating})/400))`,
      });
    }
  }

  return context;
}

// ─────────────────────────────────────────
// CORE: CALL GEMINI API
// Data-first: always inject ELO context before querying
// ─────────────────────────────────────────
async function callGemini(userMessage, history = []) {
  // Build targeted data context for this specific message
  const dataContext = buildChatContext(userMessage);

  // Inject context into system prompt
  const fullSystemPrompt = `${systemPrompt}

=== LIVE ELO DATA (2026) ===
${JSON.stringify(dataContext, null, 2)}

Use ONLY the above data to answer. Never invent ratings or statistics.
`;

  // Map chat history to Gemini format
  const geminiHistory = history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_PLATFORM_API_KEY;
  const apiUrl = `${process.env.AI_PLATFORM_URL}?key=${apiKey}`;

  if (!apiKey || !process.env.AI_PLATFORM_URL) {
    throw new Error("Gemini API key or URL not configured in .env");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: fullSystemPrompt }],
      },
      contents: [
        ...geminiHistory,
        { role: "user", parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3, // lower = more factual
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    console.error("Gemini API error:", data.error);
    throw new Error(data.error.message || "Gemini API error");
  }

  geminiAvailable = true;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

// ─────────────────────────────────────────
// GOOGLE AGENT BUILDER CLIENT (optional)
// Falls back to Gemini if not configured
// ─────────────────────────────────────────
class AgentBuilder {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    this.agentId = process.env.GOOGLE_AGENT_ID;
    this.location = process.env.GOOGLE_LOCATION || "us-central1";
  }

  async initialize() {
    if (!this.projectId || !this.agentId || this.agentId === "your-agent-id") {
      this.isConnected = false;
      console.log("⚠️  Agent Builder not configured — using Gemini");
      return;
    }
    try {
      const { SessionsClient } = require("@google-cloud/dialogflow-cx");
      this.client = new SessionsClient({
        apiEndpoint: `${this.location}-dialogflow.googleapis.com`,
      });
      this.isConnected = true;
      console.log("✅ Google Agent Builder initialized");
    } catch (err) {
      this.isConnected = false;
      console.log("⚠️  Agent Builder unavailable:", err.message);
    }
  }

  buildSessionPath(sessionId) {
    return this.client.projectLocationAgentSessionPath(
      this.projectId,
      this.location,
      this.agentId,
      sessionId
    );
  }

  async detectIntent(message, sessionId) {
    const sessionPath = this.buildSessionPath(sessionId);
    const request = {
      session: sessionPath,
      queryInput: {
        text: { text: message },
        languageCode: "en",
      },
    };
    const [response] = await this.client.detectIntent(request);
    if (
      response.queryResult &&
      response.queryResult.responseMessages &&
      response.queryResult.responseMessages.length > 0 &&
      response.queryResult.responseMessages[0].text
    ) {
      return response.queryResult.responseMessages[0].text.text[0];
    }
    throw new Error("No text response from Agent Builder");
  }
}

const agentBuilder = new AgentBuilder();

// ─────────────────────────────────────────
// ROUTE: POST /api/chat  (Primary — Gemini)
// Data-first: builds context, calls Gemini,
// logs to chat_queries, returns reply
// ─────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, history = [], sessionId } = req.body;

  // Validate input
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required", success: false });
  }

  try {
    const reply = await callGemini(message.trim(), history);

    // Log to chat_queries collection
    await logChatQuery({
      sessionId,
      userMessage: message,
      aiResponse: reply,
      source: "gemini",
    });

    res.json({ reply, success: true, source: "gemini" });
  } catch (err) {
    console.error("❌ /api/chat error:", err.message);
    res.status(500).json({
      error: `AI error: ${err.message}`,
      success: false,
    });
  }
});

// ─────────────────────────────────────────
// ROUTE: POST /api/agent-chat  (Agent Builder → Gemini fallback)
// ─────────────────────────────────────────
app.post("/api/agent-chat", async (req, res) => {
  const { message, sessionId, history = [] } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required", success: false });
  }

  let reply = "";
  let source = "";

  try {
    if (agentBuilder.isConnected && process.env.USE_AGENT_BUILDER === "true") {
      reply = await agentBuilder.detectIntent(message.trim(), sessionId || "default");
      source = "google-agent-builder";
    } else {
      reply = await callGemini(message.trim(), history);
      source = "gemini";
    }

    // Log to chat_queries
    await logChatQuery({ sessionId, userMessage: message, aiResponse: reply, source });

    res.json({ reply, source, success: true });
  } catch (err) {
    console.error("⚠️  /api/agent-chat — trying Gemini fallback:", err.message);

    // Hard fallback to Gemini
    try {
      reply = await callGemini(message.trim(), history);
      source = "gemini-fallback";

      await logChatQuery({ sessionId, userMessage: message, aiResponse: reply, source });

      res.json({ reply, source, success: true });
    } catch (fallbackErr) {
      console.error("❌ Gemini fallback failed:", fallbackErr.message);
      res.status(500).json({ error: fallbackErr.message, success: false });
    }
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/rankings
// Returns top N teams from 2026 ELO data
// Optional ?confederation= filter
// ─────────────────────────────────────────
app.get("/api/rankings", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 500);
    const confFilter = req.query.confederation
      ? req.query.confederation.toLowerCase()
      : null;

    let teams = get2026Data();

    if (confFilter) {
      teams = teams.filter(
        (t) => t.confederation && t.confederation.toLowerCase() === confFilter
      );
    }

    teams = teams.slice(0, limit);

    res.json({ teams, total: teams.length, year: 2026 });
  } catch (err) {
    console.error("❌ /api/rankings error:", err.message);
    res.status(500).json({ error: "Failed to load rankings" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/team/:name
// Returns current 2026 stats + full ELO history
// ─────────────────────────────────────────
app.get("/api/team/:name", (req, res) => {
  try {
    const name = req.params.name;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const current = findTeam(name);
    if (!current) {
      return res.status(404).json({
        error: `Team "${name}" not found in 2026 ELO dataset`,
      });
    }

    const history = getTeamHistory(name);
    res.json({ current, history, year: 2026 });
  } catch (err) {
    console.error("❌ /api/team error:", err.message);
    res.status(500).json({ error: "Failed to fetch team data" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/h2h?team1=X&team2=Y
// Head-to-head ELO comparison with win probability
// ─────────────────────────────────────────
app.get("/api/h2h", (req, res) => {
  try {
    const { team1, team2 } = req.query;

    if (!team1 || !team2) {
      return res.status(400).json({
        error: "Both team1 and team2 query parameters are required",
      });
    }

    if (team1.toLowerCase() === team2.toLowerCase()) {
      return res.status(400).json({ error: "team1 and team2 must be different" });
    }

    const t1 = findTeam(team1);
    const t2 = findTeam(team2);

    if (!t1 && !t2) {
      return res.status(404).json({
        error: `Neither "${team1}" nor "${team2}" found in 2026 dataset`,
      });
    }
    if (!t1) {
      return res.status(404).json({ error: `Team "${team1}" not found in 2026 dataset` });
    }
    if (!t2) {
      return res.status(404).json({ error: `Team "${team2}" not found in 2026 dataset` });
    }

    const t1WinProb = eloWinProbability(t1.rating, t2.rating);
    const t2WinProb = eloWinProbability(t2.rating, t1.rating);
    const ratingDiff = Math.abs(t1.rating - t2.rating);
    const favorite = t1.rating > t2.rating ? t1.country : t2.country;

    res.json({
      team1: { ...t1, win_probability: `${t1WinProb}%`, win_probability_num: parseFloat(t1WinProb) },
      team2: { ...t2, win_probability: `${t2WinProb}%`, win_probability_num: parseFloat(t2WinProb) },
      favorite,
      rating_difference: ratingDiff,
      formula: `Win% = 1/(1+10^((oppRating - myRating)/400))`,
      year: 2026,
    });
  } catch (err) {
    console.error("❌ /api/h2h error:", err.message);
    res.status(500).json({ error: "Failed to compare teams" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/confederations  (NEW)
// Groups 2026 teams by confederation
// Returns avg rating, team count, top team
// ─────────────────────────────────────────
app.get("/api/confederations", (req, res) => {
  try {
    const teams = get2026Data();
    const confMap = {};

    for (const team of teams) {
      const conf = team.confederation || "Unknown";
      if (!confMap[conf]) {
        confMap[conf] = { confederation: conf, teams: [], totalRating: 0 };
      }
      confMap[conf].teams.push(team);
      confMap[conf].totalRating += team.rating;
    }

    const result = Object.values(confMap).map((c) => {
      c.teams.sort((a, b) => b.rating - a.rating);
      return {
        confederation: c.confederation,
        teamCount: c.teams.length,
        avgRating: Math.round(c.totalRating / c.teams.length),
        topTeam: {
          country: c.teams[0].country,
          rating: c.teams[0].rating,
        },
        teams: c.teams.map((t) => ({
          country: t.country,
          rating: t.rating,
          rank: t.rank,
        })),
      };
    });

    // Sort confederations by avg rating descending
    result.sort((a, b) => b.avgRating - a.avgRating);

    res.json({ confederations: result, total: result.length, year: 2026 });
  } catch (err) {
    console.error("❌ /api/confederations error:", err.message);
    res.status(500).json({ error: "Failed to load confederation data" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/history/:sessionId
// Fetches chat history (MongoDB with in-memory fallback)
// ─────────────────────────────────────────
app.get("/api/history/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId || "default";
  try {
    if (chatQueriesCollection) {
      // Find from MongoDB
      const docs = await chatQueriesCollection
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .limit(50)
        .toArray();
      
      if (docs && docs.length > 0) {
        const history = [];
        docs.forEach(doc => {
          history.push({ role: "user", content: doc.userMessage });
          history.push({ role: "assistant", content: doc.aiResponse });
        });
        return res.json({ history, source: "mongodb" });
      }
    }
    
    // Fallback to local session cache
    const history = sessionHistoryCache.get(sessionId) || [];
    res.json({ history, source: "memory" });
  } catch (err) {
    console.error("❌ /api/history error:", err.message);
    // Silent fallback to memory cache if DB query fails
    const history = sessionHistoryCache.get(sessionId) || [];
    res.json({ history, source: "memory_fallback", error: err.message });
  }
});

// ─────────────────────────────────────────
// ROUTE: POST /api/simulate-tournament
// Simulates a knockout tournament (4, 8, or 16 teams) using ELO
// ─────────────────────────────────────────
app.post("/api/simulate-tournament", (req, res) => {
  try {
    const { teams: inputTeams } = req.body;
    if (!inputTeams || !Array.isArray(inputTeams) || inputTeams.length < 2) {
      return res.status(400).json({ error: "Please provide an array of at least 2 team names to simulate" });
    }

    // Resolve input teams to ELO data
    const resolvedTeams = [];
    for (const name of inputTeams) {
      const team = findTeam(name);
      if (team) {
        resolvedTeams.push({
          country: team.country,
          rating: team.rating,
          confederation: team.confederation
        });
      } else {
        // Mock team or placeholder if not in dataset
        resolvedTeams.push({
          country: name,
          rating: 1500,
          confederation: "Unknown"
        });
      }
    }

    // Pad to next power of 2 for clean knockout bracket
    const count = resolvedTeams.length;
    let power = 2;
    while (power < count) {
      power *= 2;
    }
    
    // Fill remaining spots with placeholders if needed
    while (resolvedTeams.length < power) {
      resolvedTeams.push({ country: `Wildcard ${resolvedTeams.length + 1}`, rating: 1400, confederation: "Wildcard" });
    }

    const simulationLog = [];
    let currentRoundTeams = [...resolvedTeams];
    let roundNumber = 1;
    const bracket = {};

    while (currentRoundTeams.length > 1) {
      const nextRoundTeams = [];
      const roundMatches = [];
      const roundName = currentRoundTeams.length === 8 ? "Quarterfinals" : 
                        currentRoundTeams.length === 4 ? "Semifinals" : 
                        currentRoundTeams.length === 2 ? "Finals" : `Round of ${currentRoundTeams.length}`;
      
      simulationLog.push(`\n--- Simulating ${roundName} ---`);
      
      for (let i = 0; i < currentRoundTeams.length; i += 2) {
        const teamA = currentRoundTeams[i];
        const teamB = currentRoundTeams[i+1];
        
        // ELO win probability
        const probA = parseFloat(eloWinProbability(teamA.rating, teamB.rating)) / 100;
        
        // Random draw to decide winner
        const rand = Math.random();
        const winner = rand < probA ? teamA : teamB;
        const loser = winner === teamA ? teamB : teamA;
        const isUpset = winner.rating < loser.rating && Math.abs(winner.rating - loser.rating) > 100;
        
        nextRoundTeams.push(winner);
        
        const matchSummary = `${teamA.country} (${teamA.rating}) vs ${teamB.country} (${teamB.rating}) -> WINNER: ${winner.country} ${isUpset ? "🔥 (UPSET!)" : ""}`;
        simulationLog.push(matchSummary);
        
        roundMatches.push({
          teamA,
          teamB,
          probA: (probA * 100).toFixed(1) + "%",
          probB: ((1 - probA) * 100).toFixed(1) + "%",
          winner: winner.country,
          isUpset
        });
      }
      
      bracket[roundName] = roundMatches;
      currentRoundTeams = nextRoundTeams;
      roundNumber++;
    }

    const champion = currentRoundTeams[0];
    simulationLog.push(`\n🏆 CHAMPION: ${champion.country} (${champion.rating})`);

    res.json({
      champion,
      bracket,
      log: simulationLog,
      success: true
    });
  } catch (err) {
    console.error("❌ /api/simulate-tournament error:", err.message);
    res.status(500).json({ error: "Failed to simulate tournament: " + err.message });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/upsets
// Detects high-probability upset candidates or interesting underdog stats
// ─────────────────────────────────────────
app.get("/api/upsets", (req, res) => {
  try {
    const teams = get2026Data();
    if (teams.length < 5) {
      return res.json({ upsets: [] });
    }

    const upsets = [];
    // Compare top teams with tricky lower ranked teams
    // Let's pair top 10 with teams ranked 20-40 and find ones with high goals_for or is_host
    const top10 = teams.slice(0, 10);
    const midTier = teams.slice(20, 45);

    for (const top of top10) {
      for (const mid of midTier) {
        // ELO Win probability of the underdog
        const underdogProb = parseFloat(eloWinProbability(mid.rating, top.rating));
        
        // If the underdog has > 35% chance to win, it is a key upset watch!
        if (underdogProb >= 35) {
          upsets.push({
            favorite: { country: top.country, rating: top.rating, rank: top.rank },
            underdog: { country: mid.country, rating: mid.rating, rank: mid.rank, confederation: mid.confederation },
            underdogWinProb: `${underdogProb.toFixed(1)}%`,
            upsetIndex: (underdogProb * (top.rating - mid.rating) / 100).toFixed(1),
            reason: mid.is_host ? "Underdog is a World Cup host country!" : "Strong recent performance and close rating."
          });
        }
      }
    }

    // Sort by upsetIndex descending
    upsets.sort((a, b) => b.upsetIndex - a.upsetIndex);

    res.json({
      upsetWatchList: upsets.slice(0, 10),
      totalIdentified: upsets.length,
      year: 2026
    });
  } catch (err) {
    console.error("❌ /api/upsets error:", err.message);
    res.status(500).json({ error: "Failed to fetch upset analysis" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/daily-insights
// Returns a dynamically generated list of ELO records, highlights & trivia
// ─────────────────────────────────────────
app.get("/api/daily-insights", (req, res) => {
  try {
    const teams2026 = get2026Data();
    if (eloData.length === 0 || teams2026.length === 0) {
      return res.status(404).json({ error: "No ELO data loaded" });
    }

    // 1. Top rated team
    const topTeam = teams2026[0];
    
    // 2. Average rating of hosts
    const hosts = teams2026.filter(t => t.is_host === 1);
    const avgHostRating = hosts.length > 0 
      ? Math.round(hosts.reduce((acc, h) => acc + h.rating, 0) / hosts.length)
      : null;

    // 3. Team with most goals_for historically
    let maxGoalsTeam = eloData[0];
    for (const record of eloData) {
      if ((record.goals_for || 0) > (maxGoalsTeam.goals_for || 0)) {
        maxGoalsTeam = record;
      }
    }

    // 4. Team with highest historical rating_max
    let highestPeakTeam = eloData[0];
    for (const record of eloData) {
      if ((record.rating_max || 0) > (highestPeakTeam.rating_max || 0)) {
        highestPeakTeam = record;
      }
    }

    const insights = [
      {
        title: "🥇 World Leader",
        description: `${topTeam.country} is the top ranked team entering World Cup 2026 with an ELO of ${topTeam.rating}.`
      },
      {
        title: "🏠 Host Advantage",
        description: `There are ${hosts.length} hosts in 2026 (${hosts.map(h => h.country).join(", ")}). Their average ELO is ${avgHostRating || "N/A"}.`
      },
      {
        title: "🔥 All-Time Goal Machine",
        description: `${maxGoalsTeam.country} has scored the most goals in historical records in our dataset, with a total of ${maxGoalsTeam.goals_for} goals across ${maxGoalsTeam.matches_total} matches.`
      },
      {
        title: "⚡ Peak Football Strength",
        description: `The highest ELO rating ever recorded in this dataset was by ${highestPeakTeam.country} with a peak rating of ${highestPeakTeam.rating_max} ELO.`
      }
    ];

    res.json({
      date: new Date().toISOString().split("T")[0],
      insights,
      year: 2026
    });
  } catch (err) {
    console.error("❌ /api/daily-insights error:", err.message);
    res.status(500).json({ error: "Failed to generate daily insights" });
  }
});

// ─────────────────────────────────────────
// ROUTE: GET /api/mcp-status  (IMPROVED)
// Returns live health of all services
// ─────────────────────────────────────────
app.get("/api/mcp-status", (req, res) => {
  res.json({
    mongodb: db !== null,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.AI_PLATFORM_API_KEY),
    eloDataLoaded: eloData.length > 0,
    recordsLoaded: eloData.length,
    teams2026: get2026Data().length,
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ─────────────────────────────────────────
// ROUTE: GET /api/agent-status  (LEGACY — kept for frontend compat)
// ─────────────────────────────────────────
app.get("/api/agent-status", (req, res) => {
  res.json({
    connected: agentBuilder.isConnected,
    useAgentBuilder: process.env.USE_AGENT_BUILDER === "true",
    fallbackActive: !agentBuilder.isConnected || process.env.USE_AGENT_BUILDER !== "true",
  });
});

// ─────────────────────────────────────────
// STARTUP: Connect DB, init Agent, then start
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;

(async () => {
  await connectToDatabase();
  await agentBuilder.initialize();

  app.listen(PORT, () => {
    console.log("");
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`✅ MongoDB connected: ${db !== null}`);
    console.log(`✅ Gemini connected: ${!!(process.env.GEMINI_API_KEY || process.env.AI_PLATFORM_API_KEY)}`);
    console.log(`✅ ELO data loaded: ${eloData.length} records`);
    console.log(`✅ WorldCup 2026 ELO Analyst AI ready`);
    console.log("");
  });
})();
