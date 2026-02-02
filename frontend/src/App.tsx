import React, { useState, useEffect } from 'react';
import { ScoutingReport } from '@scoutmaster-3000/shared';

function App() {
  const [health, setHealth] = useState<{ status: string; message: string } | null>(null);
  const [teamName, setTeamName] = useState('');
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Error fetching health:', err));
  }, []);

  const handleScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;

    setLoading(true);
    setReport(null);
    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName }),
      });
      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Error scouting team:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#333' }}>ScoutMaster 3000 🎯</h1>
        <p style={{ color: '#666' }}>One-click opponent scouting for elite coaches.</p>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <form onSubmit={handleScout} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter opponent team name..."
            style={{ padding: '12px', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Analyzing...' : 'Generate Report'}
          </button>
        </form>
      </section>

      {report && (
        <section style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>Scouting Report: {report.opponentName}</h2>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>Est. Win Probability</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: report.winProbability > 50 ? '#28a745' : '#dc3545' }}>
                {report.winProbability}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h3 style={{ color: '#0056b3' }}>🔍 Key Insights</h3>
              <ul style={{ paddingLeft: '20px' }}>
                {report.keyInsights.map((insight, i) => (
                  <li key={i} style={{ marginBottom: '10px' }}>{insight}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ color: '#28a745' }}>🏆 How to Win</h3>
              <ul style={{ paddingLeft: '20px' }}>
                {report.howToWin.map((tip, i) => (
                  <li key={i} style={{ marginBottom: '10px', fontWeight: 'bold' }}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '0.8rem', color: '#999' }}>
        {health && <span>API Status: {health.status}</span>}
        <p>© 2026 ScoutMaster 3000 - Built for Cloud9 Hackathon</p>
      </footer>
    </div>
  );
}

export default App;
