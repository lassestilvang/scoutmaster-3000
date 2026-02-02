# ScoutMaster 3000 - Demo Script 🎭

**Total Duration:** 3 Minutes

## 0:00 - 0:30 | The Hook
- **Speaker:** "Every elite esports coach knows that preparation is 90% of the victory. But scouting an opponent usually takes hours of manual VOD review and spreadsheet analysis."
- **Action:** Open the app at `http://localhost:5173`.
- **Speaker:** "Meet **ScoutMaster 3000**. We’ve built a one-click scouting engine that turns raw GRID data into actionable strategic reports in seconds."

## 0:30 - 1:00 | The Interface
- **Speaker:** "Our interface is intentionally minimalist. No distractions, just data. It’s a TypeScript monorepo using React on the frontend and Node.js on the backend, fully integrated with the GRID GraphQL API."
- **Action:** Type a team name into the search box (e.g., `Astralis`).

## 1:00 - 2:00 | The Live Scout
- **Action:** Click "Generate Report".
- **Speaker:** "Right now, ScoutMaster is hitting the GRID API, fetching the last 10 series for this team, and running them through our normalization and analysis engine."
- **Show Section 1 (Snapshot):** "Immediately, we see the win probability and scoring averages. This tells us the team's current momentum."
- **Show Section 2 (Tendencies):** "We can see their map pool depth and their 'Aggression Profile'. We calculated this by analyzing scoring patterns across all recent matches."
- **Show Section 3 (Roster):** "The roster is automatically detected from the most recent game data, ensuring we're scouting the right players."

## 2:00 - 2:40 | The "How to Win" (The Hero Feature)
- **Speaker:** "The heart of ScoutMaster is the 'How to Win' engine. This isn't generic advice."
- **Action:** Point to the blue highlighted section.
- **Speaker:** "Each insight here is backed by a concrete metric. If we suggest 'Force the series to Mirage', it's because the data shows a 20% win rate for the opponent there. We prioritize weaknesses that coaches can actually exploit in the server."

## 2:40 - 3:00 | Export & Closing
- **Speaker:** "And finally, because coaches need to share this with their players..."
- **Action:** Click "Export PDF".
- **Speaker:** "...we generate a professional, print-ready PDF that matches our web view perfectly."
- **Closing:** "ScoutMaster 3000: High-fidelity scouting for the next generation of champions. Thank you!"
