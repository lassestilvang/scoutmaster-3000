import puppeteer from 'puppeteer';
import { ScoutingReport } from '@scoutmaster-3000/shared';

export async function generatePdf(report: ScoutingReport): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

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
        <div class="subtitle">Scouting Report: ${report.opponentName}</div>
      </header>

      <section>
        <h2>Team Snapshot</h2>
        <div class="snapshot-grid">
          <div class="stat-card">
            <div class="stat-label">Win Probability</div>
            <div class="stat-value" style="color: ${report.winProbability > 50 ? '#28a745' : '#dc3545'}">${report.winProbability}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg. Score</div>
            <div class="stat-value">${report.avgScore}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Matches Analyzed</div>
            <div class="stat-value">${report.matchesAnalyzed}</div>
          </div>
        </div>
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

      <div class="grid-2col">
        <section>
          <h3>👥 Player Watchlist</h3>
          <ul class="roster-list">
            ${report.roster.length > 0 ? report.roster.map(p => `
              <li class="roster-item"><span class="dot"></span>${p.name}</li>
            `).join('') : '<li>No recent roster data.</li>'}
          </ul>
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

      <footer>
        <p>© 2026 ScoutMaster 3000 - Generated on ${new Date().toLocaleDateString()}</p>
      </footer>
    </body>
    </html>
  `;

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

  await browser.close();
  return pdfBuffer;
}
