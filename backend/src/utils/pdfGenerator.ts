import fs from 'node:fs';
import { ScoutingReport } from '@scoutmaster-3000/shared';

function resolveLocalChromeExecutablePath(): string {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  // Common local install locations (best-effort). This is only used outside Vercel.
  const candidates: string[] = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error('Chrome/Chromium executable not found. Set CHROME_EXECUTABLE_PATH for local PDF generation.');
}

async function launchBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;

  // Vercel serverless: use a serverless-compatible Chromium build.
  if (process.env.VERCEL) {
    const chromiumMod: any = await import('@sparticuz/chromium');
    const chromium = chromiumMod?.default ?? chromiumMod;
    const executablePath = await chromium.executablePath();
    if (!executablePath) {
      throw new Error('Chromium executable path could not be resolved on Vercel');
    }

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  // Local dev: use system Chrome/Chromium (or CHROME_EXECUTABLE_PATH).
  return puppeteer.launch({
    headless: true,
    executablePath: resolveLocalChromeExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function generatePdf(report: ScoutingReport): Promise<Uint8Array> {
  const browser = await launchBrowser();

  const page = await browser.newPage();

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : iso;
  };

  const evidence = report.evidence;
  const evidenceStart = fmtDate(evidence?.startTime);
  const evidenceEnd = fmtDate(evidence?.endTime);
  const evidenceSeries = (evidence?.seriesIds || []).join(', ') || '—';
  const evidenceSample = evidence
    ? `${evidence.matchesAnalyzed} matches • ${evidence.mapsPlayed} maps • ${evidence.seriesIds.length} series`
    : '—';
  const evidenceTrend = evidence?.winRateTrend;
  const evidenceTrendText = evidenceTrend
    ? `${evidenceTrend.direction === 'Up' ? '↑' : evidenceTrend.direction === 'Down' ? '↓' : '→'} ${evidenceTrend.direction} (${evidenceTrend.deltaPctPoints >= 0 ? '+' : ''}${evidenceTrend.deltaPctPoints}pp) — last ${evidenceTrend.recentMatches} vs previous ${evidenceTrend.previousMatches}`
    : '—';

  const dataSources = report.dataSources || [];
  const dataSourcesHtml = dataSources.length > 0
    ? `
      <ul style="margin: 8px 0 0 18px; color: #333;">
        ${dataSources.map(s => `
          <li style="margin-bottom: 6px;">
            <div style="font-weight: 700;">${s.name} <span style="color: ${s.used ? '#155724' : '#721c24'}; font-weight: 700;">(${s.used ? 'used' : 'not used'})</span></div>
            <div style="color: #666; font-size: 0.85rem;">${s.purpose}</div>
            ${s.endpoint ? `<div style="margin-top: 2px; color: #666; font-size: 0.75rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${s.endpoint}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `
    : '<div style="color: #666;">—</div>';

  const rawInputs = report.rawInputs;
  const rawInputsHtml = rawInputs && rawInputs.matches && rawInputs.matches.length > 0
    ? `
      <div style="margin-top: 6px; font-size: 0.8rem; color: #666;">
        Showing ${rawInputs.shownMatches} of ${rawInputs.totalMatches} matches${rawInputs.truncated ? ' (truncated)' : ''}.
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Map</th>
            <th>Result</th>
            <th>Score</th>
            <th>Opponent</th>
            <th>Series</th>
          </tr>
        </thead>
        <tbody>
          ${rawInputs.matches.slice(0, 10).map(m => `
            <tr>
              <td>${fmtDate(m.startTime)}</td>
              <td style="font-weight: bold;">${m.mapName}</td>
              <td style="font-weight: bold; color: ${m.result === 'W' ? '#28a745' : m.result === 'L' ? '#dc3545' : '#666'};">${m.result}</td>
              <td>${m.teamScore}-${m.opponentScore}</td>
              <td>${m.opponentName}</td>
              <td style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 0.75rem;">${m.seriesId}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div style="color: #666; font-style: italic;">No normalized match inputs available.</div>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: sans-serif;
          background-color: #f9f9f9;
          margin: 0;
          padding: 40px;
          color: #333;
        }
        header {
          text-align: center;
          margin-bottom: 40px;
        }
        h1 { color: #333; margin-bottom: 5px; }
        .subtitle { color: #666; font-size: 0.9rem; }
        
        section {
          background-color: white;
          padding: 25px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          page-break-inside: avoid;
        }
        
        h2, h3 { 
          margin-top: 0; 
          border-bottom: 1px solid #eee; 
          padding-bottom: 10px;
          color: #333;
        }
        
        .snapshot-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        
        .stat-card {
          text-align: center;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 6px;
        }
        
        .stat-label {
          font-size: 0.75rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .aggression-badge {
          margin-left: 10px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        
        th {
          text-align: left;
          border-bottom: 2px solid #eee;
          padding: 10px 8px;
          color: #666;
          font-size: 0.85rem;
        }
        
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #f1f1f1;
        }
        
        .grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .how-to-win {
          background-color: #007bff !important;
          color: white !important;
        }
        
        .how-to-win h3 {
          border-bottom-color: rgba(255,255,255,0.3);
          color: white;
        }
        
        .insight-card {
          background-color: rgba(255,255,255,0.1);
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 10px;
        }
        
        .insight-text { font-weight: bold; margin-bottom: 4px; }
        .insight-evidence { font-size: 0.8rem; color: rgba(255,255,255,0.8); font-style: italic; }
        
        .roster-list { list-style: none; padding: 0; margin-top: 15px; }
        .roster-item { 
          padding: 8px 0; 
          border-bottom: 1px solid #f9f9f9; 
          display: flex; 
          align-items: center; 
        }
        .mock-warning {
          background-color: #fff3cd;
          color: #856404;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #ffeeba;
          text-align: center;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .dot { 
          width: 6px; height: 6px; 
          background-color: #007bff; 
          border-radius: 50%; 
          margin-right: 10px; 
        }

        footer {
          margin-top: 40px;
          text-align: center;
          font-size: 0.7rem;
          color: #999;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>ScoutMaster 3000 🎯</h1>
        <div class="subtitle">${report.ourTeamName ? `Matchup Report: ${report.ourTeamName} vs ${report.opponentName}` : `Scouting Report: ${report.opponentName}`}</div>
      </header>

      ${report.isMockData ? `
        <div class="mock-warning">
          ⚠️ Note: Showing demo/mock data because the GRID API is currently unavailable or the team was not found.
        </div>
      ` : ''}

      <section>
        <h2>${report.ourTeamName ? 'Matchup Snapshot' : 'Team Snapshot'}</h2>
        <div class="snapshot-grid">
          <div class="stat-card">
            <div class="stat-label">${report.ourTeamName ? 'Opponent Win Rate' : 'Win Probability'}</div>
            <div class="stat-value" style="color: ${report.winProbability > 50 ? '#28a745' : '#dc3545'}">${report.winProbability}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${report.ourTeamName ? 'Opponent Avg. Score' : 'Avg. Score'}</div>
            <div class="stat-value">${report.avgScore}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Matches Analyzed</div>
            <div class="stat-value">${report.matchesAnalyzed}</div>
          </div>
        </div>
      </section>

      <section>
        <h3>🧾 Evidence &amp; Sources</h3>
        <p style="margin: 0;"><strong>Time window:</strong> <span style="color: #666;">${evidenceStart} → ${evidenceEnd}</span></p>
        <p style="margin: 6px 0 0 0;"><strong>Sample:</strong> <span style="color: #666;">${evidenceSample}</span></p>
        <p style="margin: 6px 0 0 0;"><strong>Win-rate confidence:</strong> <span style="color: #666;">${evidence?.winRateConfidence ?? '—'}</span></p>
        <p style="margin: 6px 0 0 0;"><strong>Trend:</strong> <span style="color: #666;">${evidenceTrendText}</span></p>

        <h4 style="margin: 14px 0 6px 0;">Series IDs used</h4>
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 0.8rem; color: #333; background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 10px;">
          ${evidenceSeries}
        </div>

        <h4 style="margin: 14px 0 6px 0;">Data sources</h4>
        ${dataSourcesHtml}

        <h4 style="margin: 14px 0 6px 0;">Raw inputs (normalized match sample)</h4>
        ${rawInputsHtml}
      </section>

      <section>
        <h3>📊 Key Tendencies</h3>
        <p>
          <strong>Playstyle Aggression:</strong>
          <span class="aggression-badge" style="
            background-color: ${report.aggression === 'High' ? '#f8d7da' : report.aggression === 'Medium' ? '#fff3cd' : '#d4edda'};
            color: ${report.aggression === 'High' ? '#721c24' : report.aggression === 'Medium' ? '#856404' : '#155724'};
          ">${report.aggression}</span>
        </p>
        <div style="margin-top: -6px; font-size: 0.8rem; color: #666;">
          Definition: Aggression is a coarse proxy derived from average score per match (higher scoring tends to correlate with higher pace/volatility).
        </div>
        <table>
          <thead>
            <tr>
              <th>Map Name</th>
              <th>Played</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            ${report.topMaps.map(m => `
              <tr>
                <td style="font-weight: bold;">${m.mapName}</td>
                <td>${m.matchesPlayed}</td>
                <td style="color: ${m.winRate >= 0.5 ? '#28a745' : '#dc3545'}; font-weight: bold;">
                  ${Math.round(m.winRate * 100)}%
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      <section>
        <h3>🧠 Comps & Draft</h3>
        <div class="grid-2col">
          <div>
            <h4 style="margin: 0 0 10px 0;">Top Picks / Bans</h4>
            ${report.draftStats && report.draftStats.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Picks</th>
                    <th>Bans</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.draftStats.slice(0, 10).map(d => `
                    <tr>
                      <td style="font-weight: bold;">${d.heroOrMapName}</td>
                      <td>${d.pickCount}</td>
                      <td>${d.banCount}</td>
                      <td>${d.pickCount > 0 ? `${Math.round(d.winRate * 100)}%` : '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <p style="font-style: italic; color: #666;">No draft data available for this team in the current dataset.</p>
            `}
          </div>

          <div>
            <h4 style="margin: 0 0 10px 0;">Common Compositions</h4>
            ${report.compositions && report.compositions.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Members</th>
                    <th>Seen</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.compositions.slice(0, 8).map(c => `
                    <tr>
                      <td style="font-weight: bold;">${c.kind}</td>
                      <td>${c.members.join(', ')}</td>
                      <td>${c.pickCount}</td>
                      <td>${Math.round(c.winRate * 100)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <p style="font-style: italic; color: #666;">No composition data available for this team in the current dataset.</p>
            `}
          </div>
        </div>
      </section>

      ${report.game === 'VALORANT' ? `
        <section>
          <h3>🗺️ Default Map Plan (VAL)</h3>
          <p style="margin-top: 0; color: #666; font-size: 0.9rem;">
            Note: Site-level tendencies (A/B hits, first-contact timing, retakes) require round-by-round data. The current feed used for this demo
            does not include that for all matches, so this section shows map-level performance and common agent comps per map.
          </p>

          ${report.mapPlans && report.mapPlans.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Map</th>
                  <th>Played</th>
                  <th>Win Rate</th>
                  <th>Map Picks</th>
                  <th>Map Bans</th>
                  <th>Default Comp</th>
                </tr>
              </thead>
              <tbody>
                ${report.mapPlans.slice(0, 6).map(mp => {
                  const defaultComp = mp.commonCompositions?.[0];
                  const defaultCompText = defaultComp ? `${defaultComp.members.join(', ')} (seen ${defaultComp.pickCount}×)` : '—';
                  return `
                    <tr>
                      <td style="font-weight: bold;">${mp.mapName}</td>
                      <td>${mp.matchesPlayed}</td>
                      <td>${Math.round(mp.winRate * 100)}%</td>
                      <td>${mp.mapPickCount ?? 0}</td>
                      <td>${mp.mapBanCount ?? 0}</td>
                      <td>${defaultCompText}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <p style="font-style: italic; color: #666;">No map plan data available for this team in the current dataset.</p>
          `}
        </section>
      ` : ''}

      <div class="grid-2col">
        <section>
          <h3>👥 Player Tendencies</h3>

          ${report.rosterStability ? `
            <p style="margin: 0; color: #333;">
              <strong>Roster stability:</strong> ${report.rosterStability.confidence}
              <span style="color: #666;"> (based on ${report.rosterStability.matchesConsidered} match(es) with roster data)</span>
            </p>
          ` : ''}

          ${report.playerTendencies && report.playerTendencies.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Matches</th>
                  <th>Win Rate</th>
                  <th>Top Maps</th>
                  <th>Top Picks</th>
                  <th>Clutch</th>
                </tr>
              </thead>
              <tbody>
                ${report.playerTendencies.slice(0, 8).map(pt => {
                  const topMaps = (pt.mapPerformance || []).slice(0, 2)
                    .map(m => `${m.mapName} (${m.matchesPlayed}×, ${Math.round(m.winRate * 100)}%)`)
                    .join(' • ');
                  const topPicks = (pt.topPicks || []).slice(0, 3)
                    .map(p => `${p.name} (${p.pickCount}×)`)
                    .join(', ');
                  const clutch = pt.clutch
                    ? `${pt.clutch.rating} (${pt.clutch.closeMatchesPlayed}×, ${Math.round(pt.clutch.winRate * 100)}%)`
                    : '—';
                  return `
                    <tr>
                      <td style="font-weight: bold;">${pt.playerName}</td>
                      <td>${pt.matchesPlayed}</td>
                      <td>${Math.round(pt.winRate * 100)}%</td>
                      <td>${topMaps || '—'}</td>
                      <td>${topPicks || '—'}</td>
                      <td>${clutch}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <ul class="roster-list">
              ${report.roster.length > 0 ? report.roster.map(p => `
                <li class="roster-item"><span class="dot"></span>${p.name}</li>
              `).join('') : '<li>No recent player data.</li>'}
            </ul>
          `}
        </section>

        <section class="how-to-win">
          <h3>🎯 How to Win</h3>
          ${report.howToWin.map(tip => `
            <div class="insight-card">
              <div class="insight-text">${tip.insight}</div>
              <div class="insight-evidence">Evidence: ${tip.evidence}</div>
            </div>
          `).join('')}
        </section>
      </div>

      ${report.howToWinEngine && report.howToWinEngine.candidates && report.howToWinEngine.candidates.length > 0 ? `
        <section>
          <h3>🧮 How the “How to Win” engine scored candidates</h3>
          <p style="margin: 0; font-size: 0.85rem; color: #666;"><strong>Formula:</strong> ${report.howToWinEngine.formula}</p>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Rule</th>
                <th>Impact</th>
                <th>W</th>
                <th>E</th>
                <th>Conf</th>
                <th>Candidate</th>
                <th>Why not picked</th>
              </tr>
            </thead>
            <tbody>
              ${report.howToWinEngine.candidates.slice(0, 12).map(c => `
                <tr>
                  <td>${c.status}</td>
                  <td>${c.rule}</td>
                  <td style="font-weight: bold;">${c.breakdown.impact}</td>
                  <td>${Math.round(c.breakdown.weaknessSeverity * 100)}%</td>
                  <td>${Math.round(c.breakdown.exploitability * 100)}%</td>
                  <td>${c.breakdown.confidence}</td>
                  <td>
                    <div style="font-weight: 700;">${c.insight}</div>
                    <div style="margin-top: 2px; color: #666; font-size: 0.8rem; font-style: italic;">${c.evidence}</div>
                  </td>
                  <td style="color: #666; font-size: 0.8rem;">${c.whyNotSelected || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}

      <footer>
        <p>© 2026 ScoutMaster 3000 - Generated on ${new Date().toLocaleDateString()}</p>
      </footer>
    </body>
    </html>
  `;

  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
