// database/seed.js
// Loads elo_ratings_wc2026.json into MongoDB

const { MongoClient } = require("mongodb");
const fs = require("fs");
require("dotenv").config();

async function seedDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    console.log("🔌 Connecting to MongoDB...");
    await client.connect();
    const db = client.db("worldcup2026");

    // Load JSON file
    console.log("📂 Loading ELO data from JSON...");
    const raw = fs.readFileSync("./elo_ratings_wc2026.json", "utf8");
    const allData = JSON.parse(raw);
    console.log(`✅ Found ${allData.length} total records`);

    // ─────────────────────────────────────
    // INSERT ALL ELO RECORDS
    // ─────────────────────────────────────
    await db
      .collection("elo_ratings")
      .drop()
      .catch(() => {});
    await db.collection("elo_ratings").insertMany(allData);
    console.log(`✅ Inserted ${allData.length} ELO records`);

    // ─────────────────────────────────────
    // INSERT 2026 RECORDS SEPARATELY
    // ─────────────────────────────────────
    const data2026 = allData
      .filter((d) => d.year === 2026)
      .sort((a, b) => b.rating - a.rating);

    await db
      .collection("wc2026_teams")
      .drop()
      .catch(() => {});
    await db.collection("wc2026_teams").insertMany(data2026);
    console.log(`✅ Inserted ${data2026.length} WC2026 team records`);

    // ─────────────────────────────────────
    // CREATE INDEXES FOR FAST QUERIES
    // ─────────────────────────────────────
    await db.collection("elo_ratings").createIndex({ country: 1, year: 1 });
    await db.collection("elo_ratings").createIndex({ year: 1, rating: -1 });
    await db.collection("wc2026_teams").createIndex({ rating: -1 });
    await db.collection("wc2026_teams").createIndex({ confederation: 1 });
    console.log("✅ Indexes created");

    // ─────────────────────────────────────
    // SHOW TOP 10 TEAMS
    // ─────────────────────────────────────
    console.log("\n🏆 TOP 10 TEAMS AT WC 2026:");
    data2026.slice(0, 10).forEach((t, i) => {
      console.log(
        `${i + 1}. ${t.country} — ELO: ${t.rating} (${t.confederation})`,
      );
    });

    console.log("\n✅ Database seeded successfully!");
  } catch (err) {
    console.error("❌ Seed error:", err.message);
  } finally {
    await client.close();
    console.log("🔌 MongoDB connection closed");
  }
}

seedDatabase();
