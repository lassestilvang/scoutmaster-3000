import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateScoutingReport } from './scoutingService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ScoutMaster 3000 API is running' });
});

app.post('/api/scout', async (req, res) => {
  const { teamName } = req.body;
  if (!teamName) {
    return res.status(400).json({ error: 'teamName is required' });
  }

  try {
    const report = await generateScoutingReport(teamName);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate scouting report' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
