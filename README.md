# ScoutMaster 3000 🎯

**ScoutMaster 3000** is a one-click opponent scouting tool designed for elite esports coaches. It generates concise, data-driven "How to Win" scouting reports by analyzing historical match data from the GRID API.

## 🚀 Key Features

- **One-Click Analysis:** Enter a team name and get a complete strategic breakdown in seconds.
- **Data-Driven Insights:** Automates the analysis of win rates, map performance, and playstyle aggression.
- **"How to Win" Strategy:** A rule-based engine that identifies actionable opponent weaknesses and suggests counters.
- **PDF Export:** High-quality, print-friendly reports for offline review or sharing with the team.
- **Robust Monorepo:** Full-stack TypeScript architecture with shared types for maximum reliability.

## 🛠️ How it Works (GRID API Integration)

ScoutMaster 3000 leverages the **GRID GraphQL API** to power its scouting engine:

1.  **Data Acquisition:** Fetches series IDs from **Central Data** and detailed results from the **Series State API**.
2.  **Normalization:** A dedicated layer transforms raw GRID GraphQL responses (series state and games) into a normalized domain model.
3.  **Statistical Analysis:** Calculates pure metrics like win probability, average round scores, and map-specific win rates.
4.  **Pattern Recognition:** Identifies the team's "Aggression Profile" based on scoring density and detects recent roster consistency.
5.  **Strategic Generation:** A rule-based engine ranks candidate insights (e.g., "Force map X", "Counter high aggression") and selects the top 3-5 high-impact strategies.

*Note: The application includes a graceful fallback to realistic mock data if a `GRID_API_KEY` is not provided, making it perfect for immediate demoing.*

## 🏁 Hackathon Category Justification

**Category: Cloud9 "Sky’s the Limit"**

ScoutMaster 3000 embodies the "Sky's the Limit" spirit by:
- **Empowering Coaches:** Provides professional-grade scouting tools that were previously the domain of large organizations with dedicated analysts.
- **Leveraging High-Fidelity Data:** Directly utilizes the GRID API to ensure insights are based on official, tournament-grade data.
- **Scalable Architecture:** Built on a modern, typed monorepo that is ready to be expanded with more games, deeper metrics, and AI-driven predictions.

## 💻 Local Setup

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd scoutmaster-3000

# Install dependencies
npm install
```

### Development
```bash
# Start both frontend and backend concurrently
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Create a `.env` file in the `backend` directory (or the root):
```env
GRID_API_KEY=your_actual_grid_api_key
PORT=3001
```

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
