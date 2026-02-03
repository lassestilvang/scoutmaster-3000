import React, { useState, useEffect } from 'react';
import { ScoutingReport } from '@scoutmaster-3000/shared';

function App() {
  const [health, setHealth] = useState<{ status: string; message: string } | null>(null);
  const [teamName, setTeamName] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string, name: string }>>([]);
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<'LOL' | 'VALORANT'>('VALORANT');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Error fetching health:', err));
  }, []);

  useEffect(() => {
    if (teamName.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: teamName, game: selectedGame.toLowerCase() });
      fetch(`/api/teams/search?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data))
        .catch((err) => console.error('Error fetching suggestions:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [teamName, selectedGame]);

  const handleDownloadPdf = () => {
    if (!report) return;
    const teamNameEncoded = encodeURIComponent(report.opponentName);
    const params = new URLSearchParams({ game: selectedGame.toLowerCase() });
    window.location.href = `/api/scout/name/${teamNameEncoded}/pdf?${params.toString()}`;
  };

  const handleScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;

    setLoading(true);
    setReport(null);
    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, game: selectedGame.toLowerCase() }),
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            background: '#ffffff',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="game"
                value="VALORANT"
                checked={selectedGame === 'VALORANT'}
                onChange={() => setSelectedGame('VALORANT')}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4655" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M3 4l6.5 9.5L8 20 1 10z" />
                  <path d="M23 4l-6.5 9.5L16 20l7-10z" />
                </svg>
                <span style={{ fontWeight: 600 }}>VALORANT</span>
              </span>
            </label>
            <div style={{ width: 1, height: 22, background: '#e2e8f0' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="game"
                value="LOL"
                checked={selectedGame === 'LOL'}
                onChange={() => setSelectedGame('LOL')}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <defs>
                    <linearGradient id="lolG" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#c8a356" />
                      <stop offset="100%" stopColor="#8b6b2f" />
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#lolG)" />
                  <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a">LoL</text>
                </svg>
                <span style={{ fontWeight: 600 }}>League of Legends</span>
              </span>
            </label>
          </div>

          <form onSubmit={handleScout} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={selectedGame === 'VALORANT' ? 'Enter VALORANT team name…' : 'Enter LoL team name…'}
              list="team-suggestions"
              style={{ padding: '12px', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <datalist id="team-suggestions">
              {suggestions.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
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
        </div>
      </section>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {report.isMockData && (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              color: '#856404', 
              padding: '15px', 
              borderRadius: '8px', 
              border: '1px solid #ffeeba',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              ⚠️ Note: Showing demo/mock data because the GRID API is currently unavailable or the team was not found.
            </div>
          )}
          {/* 1. Team Snapshot */}
          <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>
                Team Snapshot: {report.opponentName}
              </h2>
              <button
                onClick={handleDownloadPdf}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #007bff',
                  backgroundColor: 'white',
                  color: '#007bff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                📥 Export PDF
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Win Probability</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: report.winProbability > 50 ? '#28a745' : '#dc3545' }}>{report.winProbability}%</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Avg. Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{report.avgScore}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Matches</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{report.matchesAnalyzed}</div>
              </div>
            </div>
          </section>

          {/* 2. Key Tendencies */}
          <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📊 Key Tendencies</h3>
            <div style={{ margin: '15px 0' }}>
              <strong>Playstyle Aggression:</strong> <span style={{ 
                marginLeft: '10px',
                padding: '4px 12px', 
                borderRadius: '20px', 
                fontSize: '0.9rem',
                fontWeight: 'bold',
                backgroundColor: report.aggression === 'High' ? '#f8d7da' : report.aggression === 'Medium' ? '#fff3cd' : '#d4edda',
                color: report.aggression === 'High' ? '#721c24' : report.aggression === 'Medium' ? '#856404' : '#155724'
              }}>{report.aggression}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '12px 8px', color: '#666' }}>Map Name</th>
                  <th style={{ padding: '12px 8px', color: '#666' }}>Played</th>
                  <th style={{ padding: '12px 8px', color: '#666' }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {report.topMaps.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f1f1' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{m.mapName}</td>
                    <td style={{ padding: '12px 8px' }}>{m.matchesPlayed}</td>
                    <td style={{ padding: '12px 8px', color: m.winRate >= 0.5 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                      {Math.round(m.winRate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 2.5 Comps & Draft */}
          <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🧠 Comps & Draft</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Top Picks / Bans</h4>
                {report.draftStats && report.draftStats.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Name</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Picks</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Bans</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.draftStats.slice(0, 10).map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{d.heroOrMapName}</td>
                          <td style={{ padding: '10px 8px' }}>{d.pickCount}</td>
                          <td style={{ padding: '10px 8px' }}>{d.banCount}</td>
                          <td style={{ padding: '10px 8px' }}>{d.pickCount > 0 ? `${Math.round(d.winRate * 100)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontStyle: 'italic', color: '#666' }}>No draft data available for this team in the current dataset.</p>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Common Compositions</h4>
                {report.compositions && report.compositions.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: '18px', color: '#333' }}>
                    {report.compositions.slice(0, 8).map((c, i) => (
                      <li key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ fontWeight: 600 }}>
                          {c.kind}: {c.members.join(', ')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          Seen {c.pickCount}× • Win rate {Math.round(c.winRate * 100)}%
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ fontStyle: 'italic', color: '#666' }}>No composition data available for this team in the current dataset.</p>
                )}
              </div>
            </div>
          </section>

          {/* 2.75 Default Map Plan (VAL) */}
          {selectedGame === 'VALORANT' && (
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🗺️ Default Map Plan (VAL)</h3>
              <p style={{ marginTop: 0, color: '#666', fontSize: '0.9rem' }}>
                Note: Site-level tendencies (A/B hits, first-contact timing, retakes) require round-by-round data. The current feed used for this demo
                does not include that for all matches, so this section shows map-level performance and common agent comps per map.
              </p>

              {report.mapPlans && report.mapPlans.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {report.mapPlans.slice(0, 6).map((mp, i) => {
                    const defaultComp = mp.commonCompositions?.[0];
                    const variations = mp.commonCompositions?.slice(1, 3) || [];
                    const hasVeto = (mp.mapPickCount || 0) > 0 || (mp.mapBanCount || 0) > 0;
                    return (
                      <div key={i} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                          <div style={{ fontWeight: 700, color: '#333' }}>{mp.mapName}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            Played {mp.matchesPlayed}× • Win rate {Math.round(mp.winRate * 100)}%
                          </div>
                        </div>

                        {hasVeto && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                            <strong>Veto:</strong> picked {mp.mapPickCount || 0}× • banned {mp.mapBanCount || 0}×
                          </div>
                        )}

                        {defaultComp ? (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '0.9rem' }}>
                              <strong>Default comp:</strong> {defaultComp.members.join(', ')}
                              <span style={{ color: '#666' }}> (seen {defaultComp.pickCount}×)</span>
                            </div>
                            {variations.length > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                                <strong>Variations:</strong>
                                <ul style={{ margin: '6px 0 0 18px' }}>
                                  {variations.map((v, vi) => (
                                    <li key={vi}>
                                      {v.members.join(', ')} (seen {v.pickCount}×)
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginTop: '8px', fontStyle: 'italic', color: '#666' }}>
                            No agent composition data available for this map in the current dataset.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontStyle: 'italic', color: '#666' }}>No map plan data available for this team in the current dataset.</p>
              )}
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* 3. Player Watchlist */}
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>👥 Player Tendencies</h3>

              {report.rosterStability && (
                <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#333' }}>
                  <strong>Roster stability:</strong>{' '}
                  <span style={{
                    marginLeft: '8px',
                    padding: '3px 10px',
                    borderRadius: '14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    backgroundColor: report.rosterStability.confidence === 'High' ? '#d4edda' : report.rosterStability.confidence === 'Medium' ? '#fff3cd' : '#f8d7da',
                    color: report.rosterStability.confidence === 'High' ? '#155724' : report.rosterStability.confidence === 'Medium' ? '#856404' : '#721c24'
                  }}>
                    {report.rosterStability.confidence}
                  </span>
                  <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                    Based on {report.rosterStability.matchesConsidered} match(es) with roster data • {report.rosterStability.uniquePlayersSeen} unique player(s) seen
                  </div>
                </div>
              )}

              {report.playerTendencies && report.playerTendencies.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                  {report.playerTendencies.slice(0, 8).map((pt) => {
                    const topMaps = pt.mapPerformance.slice(0, 2);
                    const topPicks = pt.topPicks?.slice(0, 3) || [];
                    return (
                      <div key={pt.playerId} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                          <div style={{ fontWeight: 700, color: '#333' }}>{pt.playerName}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            {pt.matchesPlayed} match(es) • Win rate {Math.round(pt.winRate * 100)}%
                          </div>
                        </div>

                        {topMaps.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
                            <strong>Map split:</strong>{' '}
                            {topMaps.map(m => `${m.mapName} (${m.matchesPlayed}×, ${Math.round(m.winRate * 100)}%)`).join(' • ')}
                          </div>
                        )}

                        {topPicks.length > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                            <strong>Top picks:</strong>{' '}
                            {topPicks.map(p => `${p.name} (${p.pickCount}×)`).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: '15px' }}>
                  {report.roster.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {report.roster.map((p, i) => (
                        <li key={i} style={{
                          padding: '10px',
                          borderBottom: '1px solid #f9f9f9',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#007bff',
                            borderRadius: '50%',
                            marginRight: '12px'
                          }}></span>
                          <span style={{ fontWeight: '500' }}>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontStyle: 'italic', color: '#666', marginTop: '15px' }}>No recent player data available.</p>
                  )}
                </div>
              )}
            </section>

            {/* 4. How to Win (Highlighted) */}
            <section style={{ backgroundColor: '#007bff', color: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>🎯 How to Win</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
                {report.howToWin.map((tip, i) => (
                  <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '5px' }}>{tip.insight}</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                      Evidence: {tip.evidence}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '0.8rem', color: '#999' }}>
        {health && <span>API Status: {health.status}</span>}
        <p>© 2026 ScoutMaster 3000 - Built for Cloud9 Hackathon</p>
      </footer>
    </div>
  );
}

export default App;
