# World Cup 2026 ELO Analyst AI Agent

## 1. What is this Agent?
This project is an **AI-powered chatbot and analytical tool** designed specifically for the upcoming FIFA World Cup 2026. It acts as an expert football analyst that uses historical ELO ratings to predict match outcomes, rank teams, and answer user questions about international football. 

It was built as part of a Google Cloud Hackathon.

## 2. How it Works
The project is built on a standard modern web stack (Client-Server architecture):

* **Frontend (User Interface):** Built with pure HTML, CSS, and Vanilla JavaScript (`app.js`). It provides a beautiful, dark-mode ready interface where users can chat with the AI, view top 32 team rankings, search for specific team details, and compare two teams head-to-head.
* **Backend (Server):** A Node.js server (`server.js`) using the Express framework. It handles the API routes for the frontend.
* **Data Source:** It loads a massive dataset of 117,000 historical ELO records from `elo_ratings_wc2026 (1).json`. 
* **The Brain (AI):** It connects to the **Google Gemini 1.5 Flash API**. When a user asks a question, the server injects the 2026 ELO data and a strict set of rules (`system_prompt.txt`) into the prompt, forcing the AI to answer factually based *only* on the provided data.

## 3. What Problems it Solves
* **Predictive Analysis:** It solves the problem of guessing match outcomes by applying a strict mathematical formula (the ELO formula) to calculate exact win probabilities between any two teams.
* **Data Accessibility:** Instead of forcing users to dig through a massive 2MB JSON file, it provides an intuitive UI and an AI chatbot that can instantly fetch and summarize stats (wins, losses, goals).
* **Objective Comparisons:** It removes human bias from football debates by relying entirely on historical performance metrics.

## 4. Current Faults, Limitations & Fixes
While the agent is powerful, it has a few limitations and historical faults that we have worked through:

### 🛠️ Faults We Fixed
1. **Security Vulnerability:** Originally, the backend served all files from the root directory. This meant anyone could access your `.env` file and steal your API keys. **Fix:** We moved the frontend files to a `public/` directory and secured the server.
2. **API Format Errors:** The original code tried to communicate with Gemini using an OpenAI/Claude format, which caused the chatbot to crash. **Fix:** We rewrote the fetch request in `server.js` to correctly format the request for Google Gemini.
3. **API Key & Quota Limits:** We encountered quota limits (`limit: 0`) when trying to use `gemini-2.0-flash`. **Fix:** We downgraded to the highly available `gemini-1.5-flash` and swapped to a new, working API key.

### ⚠️ Inherent Limitations
1. **ELO Blindspots:** The mathematical ELO model is blind to real-world context. It does not account for injured star players, recent manager changes, weather conditions, or home-field advantage. 
2. **Google Cloud Permissions:** As you experienced with Vertex AI Agent Builder, deploying enterprise AI tools requires strict IAM (Identity and Access Management) permissions. If a user doesn't have `Discovery Engine Admin` roles, they cannot upload data to Cloud Data Stores.
3. **Static Data:** The `elo_ratings_wc2026 (1).json` file is static. Once the World Cup actually begins in 2026, the agent will not know the live results unless the JSON file is continuously updated.
