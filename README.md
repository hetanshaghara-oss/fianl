# ⚽ WorldCup 2026 ELO Analyst - AI Agent

## 🎯 Project Overview

An intelligent AI Agent that analyzes FIFA World Cup 2026 teams using historical ELO ratings and MongoDB. Built for the **Google Cloud Rapid Agent Hackathon** on the **MongoDB Partner Track**.

**Live Demo**: [Deployed on Vercel](https://your-project.vercel.app)

---

## 🚀 Features

- ✅ **AI Chat Interface** - Ask questions about teams, predictions, and statistics
- ✅ **Team Rankings** - Top 32 teams sorted by ELO rating
- ✅ **Team Details** - Historical performance and current statistics
- ✅ **Head-to-Head Comparison** - Win probability calculations using ELO formula
- ✅ **Historical Analysis** - Trace team performance over 125+ years
- ✅ **Query Logging** - Store all conversations in MongoDB
- ✅ **Dark/Light Mode** - Modern responsive UI
- ✅ **MongoDB Integration** - Full integration with MongoDB Atlas

---

## 📊 Dataset

- **Records**: 117,000 ELO ratings
- **Time Range**: 1901-2026
- **Teams**: All international football teams
- **Metrics**: Rankings, ratings, wins/losses, goals, confederations

---

## 🛠️ Tech Stack

### Frontend

- HTML5, CSS3, Vanilla JavaScript
- Modern responsive design
- Dark/Light mode support

### Backend

- Node.js + Express.js
- MongoDB Atlas for data storage
- RESTful API architecture

### AI & Cloud

- Google Gemini 2.0 Flash
- Google Cloud Agent Builder
- MongoDB MCP Server integration

### Deployment

- Vercel (Frontend + Backend)
- MongoDB Atlas (Cloud Database)

---

## 📋 Prerequisites

Before starting, you need:

1. **Node.js** (v18+) - [Download](https://nodejs.org/)
2. **MongoDB Atlas Account** - [Sign up FREE](https://www.mongodb.com/cloud/atlas)
3. **Google Cloud Project** - [Create project](https://console.cloud.google.com)
4. **Gemini API Key** - [Get from AI Studio](https://aistudio.google.com)
5. **Vercel Account** - [Sign up free](https://vercel.com)

---

## 🔧 Installation & Setup

### Step 1: Clone & Setup Project

```bash
# Clone the repository
git clone https://github.com/yourusername/worldcup-elo-agent.git
cd worldcup-elo-agent

# Install dependencies
npm install
```

### Step 2: Configure Environment Variables

```bash
# Copy example to .env
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# MongoDB Atlas Connection
# Get from: https://www.mongodb.com/cloud/atlas
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/worldcup2026?retryWrites=true&w=majority

# Gemini API Key
# Get from: https://aistudio.google.com
GEMINI_API_KEY=your-actual-gemini-api-key

# Google Cloud Project
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id

# Server
PORT=3000
NODE_ENV=development
```

### Step 3: Get MongoDB Atlas Connection String

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a FREE cluster
3. Click "Connect"
4. Choose "Drivers" → Node.js
5. Copy the connection string
6. Replace `<password>` with your database password
7. Paste into `.env` as `MONGODB_URI`

### Step 4: Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key"
3. Create API key in Google Cloud
4. Copy the key
5. Paste into `.env` as `GEMINI_API_KEY`

### Step 5: Seed the Database

```bash
# Load ELO data into MongoDB
npm run seed
```

You should see:

```
✅ Loaded 117000 ELO records
✅ Inserted 117000 ELO records
✅ Inserted 32 WC2026 team records
✅ Indexes created
✅ Database seeded successfully!
```

---

## 🚀 Running Locally

### Start the Server

```bash
npm start
```

You should see:

```
🚀 Server running at http://localhost:3000
📊 ELO data: 117000 records loaded
```

### Open in Browser

Go to: **http://localhost:3000**

---

## 📡 API Endpoints

### Chat with AI Agent

```bash
POST /api/chat
Content-Type: application/json

Request Body:
{
  "message": "Who will win between France and Argentina?",
  "history": []
}

Response:
{
  "reply": "France has a 53.2% win probability...",
  "success": true
}
```

### Get Rankings

```bash
GET /api/rankings?limit=20

Response:
{
  "teams": [
    {
      "country": "France",
      "rank": 1,
      "rating": 2003,
      "confederation": "UEFA",
      ...
    }
  ],
  "total": 20
}
```

### Get Team Details

```bash
GET /api/team/France

Response:
{
  "current": { /* 2026 data */ },
  "history": [ /* historical data */ ]
}
```

### Head to Head Comparison

```bash
GET /api/h2h?team1=France&team2=Argentina

Response:
{
  "team1": { /* France data with win_probability */ },
  "team2": { /* Argentina data with win_probability */ },
  "favorite": "France",
  "rating_difference": 45
}
```

---

## 📁 Project Structure

```
worldcup-elo-agent/
├── README.md                      # This file
├── LICENSE                        # MIT License
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── package.json                   # Node dependencies
├── server.js                      # Express backend
│
├── frontend/
│   ├── index.html                 # Main UI
│   ├── style.css                  # Styling
│   └── app.js                     # Frontend logic
│
├── database/
│   ├── elo_ratings_wc2026.json    # 117,000 ELO records
│   └── seed.js                    # Database seeding script
│
└── agent/
    ├── system_prompt.txt          # AI agent instructions
    └── agent_config.json          # Agent configuration
```

---

## 🎓 How the AI Agent Works

### 1. **Data Flow**

```
User Question → Backend API → Load ELO Data → Gemini AI → Response
```

### 2. **ELO Formula**

The agent uses this formula to calculate win probability:

```
P = 1 / (1 + 10^((OpponentRating - TeamRating)/400))
```

Example:

- France Rating: 2003
- Argentina Rating: 1958
- Difference: 45 points
- France Win Probability: 53.2%

### 3. **System Prompt**

The agent is instructed to:

- ✅ Use ONLY provided ELO data
- ✅ Never hallucinate information
- ✅ Always provide numerical evidence
- ✅ Explain reasoning clearly
- ✅ Apply the ELO formula correctly

---

## 🧪 Testing

### Test the API Manually

```bash
# Test rankings
curl http://localhost:3000/api/rankings?limit=5

# Test team details
curl "http://localhost:3000/api/team/France"

# Test head to head
curl "http://localhost:3000/api/h2h?team1=France&team2=Argentina"

# Test chat (requires curl with JSON)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Top 5 teams?","history":[]}'
```

### Test in Browser

1. Open http://localhost:3000
2. Try each tab:
   - **💬 Chat** - Ask questions
   - **🏆 Rankings** - View top teams
   - **🔍 Team Details** - Search a team
   - **⚔️ Compare Teams** - Head to head

---

## 🌐 Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [Vercel](https://vercel.com)
2. Click "New Project"
3. Select your GitHub repository
4. Choose "Node.js" as framework
5. Add environment variables:
   - `MONGODB_URI`
   - `GEMINI_API_KEY`
   - `GOOGLE_CLOUD_PROJECT`
6. Click "Deploy"

### Step 3: Configure Vercel Settings

In `vercel.json`:

```json
{
  "buildCommand": "npm install",
  "outputDirectory": ".",
  "functions": {
    "server.js": {
      "memory": 1024
    }
  }
}
```

### Step 4: Verify Deployment

```bash
# After deployment
curl https://your-project.vercel.app/api/rankings?limit=5
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'express'"

```bash
npm install
```

### Error: "MONGODB_URI is not defined"

```bash
# Make sure .env file exists and has MONGODB_URI
echo 'MONGODB_URI=...' >> .env
```

### Error: "Gemini API Key invalid"

```bash
# Verify key from https://aistudio.google.com
# Make sure it's in .env as GEMINI_API_KEY
```

### Server not starting

```bash
# Check if port 3000 is in use
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
PORT=3001 npm start
```

### ELO data not loading

```bash
# Check file path
ls -la database/elo_ratings_wc2026.json

# Verify JSON is valid
node -e "require('fs').readFileSync('database/elo_ratings_wc2026.json')"
```

---

## 📚 Useful Resources

- [ELO Rating System](https://en.wikipedia.org/wiki/Elo_rating_system)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Express.js Guide](https://expressjs.com)
- [Gemini API Reference](https://ai.google.dev)
- [Vercel Deployment Guide](https://vercel.com/docs)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Football-Reference.com for ELO rating data
- Google Cloud for Gemini API
- MongoDB for database infrastructure
- Vercel for hosting

--- 

## 📧 Contact & Support

- **GitHub Issues** - [Report bugs](https://github.com/yourusername/worldcup-elo-agent/issues)
- **Discussions** - [Ask questions](https://github.com/yourusername/worldcup-elo-agent/discussions)

---

## 🎯 Future Enhancements

- [ ] Real-time match notifications
- [ ] Advanced statistical visualizations
- [ ] Team comparison charts
- [ ] Mobile app (React Native)
- [ ] Voice chat interface
- [ ] Multi-language support
- [ ] Custom ELO simulations

---

**Happy analyzing! ⚽🚀**
