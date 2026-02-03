import React, { useState, useEffect, useRef } from 'react';
import { ScoutingReport, getMapWikiUrl } from '@scoutmaster-3000/shared';

type TeamSuggestion = { id: string; name: string };
type DemoTeam = { id: string; name: string };

function App() {
  const [health, setHealth] = useState<{ status: string; message: string } | null>(null);
  const [teamName, setTeamName] = useState('');
  const [ourTeamName, setOurTeamName] = useState('');
  const [suggestions, setSuggestions] = useState<TeamSuggestion[]>([]);
  const [ourSuggestions, setOurSuggestions] = useState<TeamSuggestion[]>([]);
  const [teamNameB, setTeamNameB] = useState('');
  const [suggestionsB, setSuggestionsB] = useState<TeamSuggestion[]>([]);
  const [committedTeamName, setCommittedTeamName] = useState<string | null>(null);
  const [committedOurTeamName, setCommittedOurTeamName] = useState<string | null>(null);
  const [committedTeamNameB, setCommittedTeamNameB] = useState<string | null>(null);
  const [report, setReport] = useState<ScoutingReport | null>(null);
  const [reportB, setReportB] = useState<ScoutingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<'LOL' | 'VALORANT'>('VALORANT');
  const [compareMode, setCompareMode] = useState(false);
  const [error, setError] = useState<{ message: string; suggestions?: TeamSuggestion[] } | null>(null);
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);
  const [demoTeams, setDemoTeams] = useState<DemoTeam[]>([]);
  const [demoTeamsLoading, setDemoTeamsLoading] = useState(false);
  const [shareLinkCopiedTooltip, setShareLinkCopiedTooltip] = useState(false);
  const shareLinkCopiedTooltipTimeoutRef = useRef<number | null>(null);

  const renderMapLink = (game: 'LOL' | 'VALORANT' | undefined, mapName: string) => {
    const url = getMapWikiUrl(game, mapName);
    return url ? (
      <a href={url} target="_blank" rel="noreferrer noopener" style={{ color: '#007bff', textDecoration: 'none' }}>
        {mapName}
      </a>
    ) : (
      mapName
    );
  };

  const buildShareUrl = (opts: {
    game: 'LOL' | 'VALORANT';
    team: string;
    ourTeam?: string;
    compareMode?: boolean;
    teamB?: string;
  }) => {
    const params = new URLSearchParams();
    params.set('game', opts.game.toLowerCase());
    params.set('team', opts.team);
    if (opts.ourTeam) params.set('our', opts.ourTeam);
    if (opts.compareMode) params.set('compare', '1');
    if (opts.teamB) params.set('teamB', opts.teamB);

    const base = window.location.origin + window.location.pathname;
    return `${base}?${params.toString()}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for environments without Clipboard API.
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    }
  };

  const showShareLinkCopiedTooltip = () => {
    setShareLinkCopiedTooltip(true);
    if (shareLinkCopiedTooltipTimeoutRef.current !== null) {
      window.clearTimeout(shareLinkCopiedTooltipTimeoutRef.current);
    }
    shareLinkCopiedTooltipTimeoutRef.current = window.setTimeout(() => {
      setShareLinkCopiedTooltip(false);
      shareLinkCopiedTooltipTimeoutRef.current = null;
    }, 1600);
  };

  useEffect(() => {
    return () => {
      if (shareLinkCopiedTooltipTimeoutRef.current !== null) {
        window.clearTimeout(shareLinkCopiedTooltipTimeoutRef.current);
      }
    };
  }, []);

  const formatDate = (iso: string | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString();
  };

  const normalizeTeamName = (name: string) => name.trim().toLowerCase();
  const isSameTeamName = (a: string, b: string) => {
    const na = normalizeTeamName(a);
    const nb = normalizeTeamName(b);
    if (!na || !nb) return false;
    return na === nb;
  };

  const isExactSuggestionMatch = (value: string, list: TeamSuggestion[]) =>
    list.some((s) => isSameTeamName(s.name, value));

  const resetFormForGameChange = () => {
    setTeamName('');
    setOurTeamName('');
    setTeamNameB('');
    setCompareMode(false);

    setCommittedTeamName(null);
    setCommittedOurTeamName(null);
    setCommittedTeamNameB(null);

    setSuggestions([]);
    setOurSuggestions([]);
    setSuggestionsB([]);
    setReport(null);
    setReportB(null);
    setError(null);

    setLoading(false);
    setPdfLoading(false);
    setShareLinkCopiedTooltip(false);

    // Clear share-link query params so we don't keep cross-game stale inputs in the URL.
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleCopyShareLink = async (opts?: { teamOverride?: string; ourOverride?: string }) => {
    const team = (opts?.teamOverride ?? teamName).trim();
    if (!team) return;

    const url = buildShareUrl({
      game: selectedGame,
      team,
      ourTeam: compareMode ? undefined : ((opts?.ourOverride ?? ourTeamName).trim() || undefined),
      compareMode,
      teamB: compareMode ? (teamNameB.trim() || undefined) : undefined,
    });

    const ok = await copyToClipboard(url);
    if (ok) showShareLinkCopiedTooltip();
  };

  const handleGameChange = (nextGame: 'LOL' | 'VALORANT') => {
    if (nextGame === selectedGame) return;
    resetFormForGameChange();
    setSelectedGame(nextGame);
  };

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Error fetching health:', err));
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setDemoTeams([]);
    setDemoTeamsLoading(true);
    fetch(`/api/demo-teams?game=${selectedGame.toLowerCase()}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        const teams = Array.isArray(data?.teams) ? data.teams : [];
        setDemoTeams(teams);
      })
      .catch((err) => {
        // AbortError is expected during fast toggles.
        if (err && err.name === 'AbortError') return;
        console.error('Error fetching demo teams:', err);
        setDemoTeams([]);
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setDemoTeamsLoading(false);
      });

    return () => ac.abort();
  }, [selectedGame]);

  useEffect(() => {
    if (teamName.length < 2 || (committedTeamName && isSameTeamName(teamName, committedTeamName))) {
      setSuggestions([]);
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: teamName, game: selectedGame.toLowerCase() });
      fetch(`/api/teams/search?${params.toString()}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data) => {
          if (ac.signal.aborted) return;
          setSuggestions(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (err && err.name === 'AbortError') return;
          console.error('Error fetching suggestions:', err);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [teamName, selectedGame, committedTeamName]);

  useEffect(() => {
    if (teamNameB.length < 2 || (committedTeamNameB && isSameTeamName(teamNameB, committedTeamNameB))) {
      setSuggestionsB([]);
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: teamNameB, game: selectedGame.toLowerCase() });
      fetch(`/api/teams/search?${params.toString()}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data) => {
          if (ac.signal.aborted) return;
          setSuggestionsB(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (err && err.name === 'AbortError') return;
          console.error('Error fetching suggestions:', err);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [teamNameB, selectedGame, committedTeamNameB]);

  useEffect(() => {
    if (compareMode) {
      setOurSuggestions([]);
      return;
    }

    if (ourTeamName.length < 2 || (committedOurTeamName && isSameTeamName(ourTeamName, committedOurTeamName))) {
      setOurSuggestions([]);
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: ourTeamName, game: selectedGame.toLowerCase() });
      fetch(`/api/teams/search?${params.toString()}`, { signal: ac.signal })
        .then((res) => res.json())
        .then((data) => {
          if (ac.signal.aborted) return;
          setOurSuggestions(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (err && err.name === 'AbortError') return;
          console.error('Error fetching suggestions:', err);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [ourTeamName, selectedGame, compareMode, committedOurTeamName]);

  const runScout = async (opts?: {
    team?: string;
    ourTeam?: string;
    game?: 'LOL' | 'VALORANT';
    compareMode?: boolean;
    teamB?: string;
  }) => {
    const team = (opts?.team ?? teamName).trim();
    const teamB = (opts?.teamB ?? teamNameB).trim();
    const our = (opts?.ourTeam ?? ourTeamName).trim();
    const game = opts?.game ?? selectedGame;
    const compare = opts?.compareMode ?? compareMode;

    if (!team) return;
    if (compare && !teamB) return;

    if (compare) {
      if (isSameTeamName(team, teamB)) {
        setError({ message: 'Team A and Team B must be different.' });
        return;
      }
    } else {
      if (our && isSameTeamName(team, our)) {
        setError({ message: 'Your team cannot be the same as the opponent.' });
        return;
      }
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setReportB(null);

    const postScout = async (t: string, includeOur: boolean) => {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: t,
          ourTeamName: includeOur ? (our || undefined) : undefined,
          game: game.toLowerCase(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || 'Failed to generate report';
        const suggestions = (data?.suggestions as TeamSuggestion[] | undefined) || undefined;
        throw { message, suggestions, query: t };
      }
      return data as ScoutingReport;
    };

    try {
      if (compare) {
        const [a, b] = await Promise.all([
          postScout(team, false),
          postScout(teamB, false),
        ]);
        setReport(a);
        setReportB(b);

        const share = buildShareUrl({ game, team, compareMode: true, teamB });
        window.history.replaceState({}, '', share);
      } else {
        const a = await postScout(team, true);
        setReport(a);

        const share = buildShareUrl({ game, team, ourTeam: our || undefined });
        window.history.replaceState({}, '', share);
      }
    } catch (err: any) {
      const message = err?.message || 'Error scouting team';
      const suggestions = err?.suggestions as TeamSuggestion[] | undefined;
      const query = typeof err?.query === 'string' ? err.query : undefined;
      setError({ message: query ? `${message}` : message, suggestions });
      console.error('Error scouting team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hydratedFromUrl) return;

    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    const teamParam = params.get('team');
    const ourParam = params.get('our');
    // Legacy share-link params (no longer used): limit, days
    const compareParam = params.get('compare');
    const teamBParam = params.get('teamB');

    const gameFromUrl: 'LOL' | 'VALORANT' | undefined = gameParam === 'lol' ? 'LOL' : gameParam === 'valorant' ? 'VALORANT' : undefined;
    if (gameFromUrl) setSelectedGame(gameFromUrl);

    if (typeof compareParam === 'string' && compareParam === '1') {
      setCompareMode(true);
    }

    if (typeof teamParam === 'string' && teamParam.trim()) {
      setTeamName(teamParam);
      setCommittedTeamName(teamParam);
      setSuggestions([]);
    }
    if (typeof ourParam === 'string') {
      setOurTeamName(ourParam);
      if (ourParam.trim()) {
        setCommittedOurTeamName(ourParam);
        setOurSuggestions([]);
      }
    }
    if (typeof teamBParam === 'string') {
      setTeamNameB(teamBParam);
      if (teamBParam.trim()) {
        setCommittedTeamNameB(teamBParam);
        setSuggestionsB([]);
      }
    }

    setHydratedFromUrl(true);

    if (teamParam && teamParam.trim()) {
      void runScout({
        team: teamParam,
        ourTeam: ourParam || undefined,
        game: gameFromUrl,
        compareMode: compareParam === '1',
        teamB: teamBParam || undefined,
      });
    }
  }, [hydratedFromUrl]);

  const handleDownloadPdf = (r: ScoutingReport) => {
    const teamNameEncoded = encodeURIComponent(r.opponentName);
    const gameParam = (r.game || selectedGame).toLowerCase();
    const params = new URLSearchParams({ game: gameParam });
    if (r.ourTeamName) {
      params.set('ourTeamName', r.ourTeamName);
    }
    window.location.href = `/api/scout/name/${teamNameEncoded}/pdf?${params.toString()}`;
  };

  const handleScout = async (e: React.FormEvent) => {
    e.preventDefault();
    await runScout();
  };

  return (
    <div style={{ padding: '20px', maxWidth: compareMode ? '1180px' : '800px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', lineHeight: 1.4 }}>
      {loading && (
        <div
          role="status"
          aria-label="Generating report"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="88" height="88" viewBox="0 0 50 50" aria-hidden>
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="#007bff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="31.4 31.4"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 25 25"
                  to="360 25 25"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </div>
        </div>
      )}
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#333' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="/favicon.png"
                width={28}
                height={28}
                alt="ScoutMaster 3000 icon"
                style={{ display: 'block' }}
              />
              <span>ScoutMaster 3000</span>
            </span>
          </a>
        </h1>
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
                onChange={() => handleGameChange('VALORANT')}
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
                onChange={() => handleGameChange('LOL')}
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

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                aria-label="Demo team"
                key={selectedGame}
                defaultValue=""
                disabled={demoTeamsLoading || demoTeams.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setTeamName(v);
                  setCommittedTeamName(v);
                  setSuggestions([]);
                  setError(null);
                  if (!compareMode) void runScout({ team: v, game: selectedGame });
                }}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc', minWidth: 200 }}
              >
                <option value="">
                  {demoTeamsLoading
                    ? 'Loading demo teams…'
                    : demoTeams.length === 0
                      ? 'No demo teams available'
                      : 'Try an example team…'}
                </option>
                {demoTeams.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                if (demoTeams.length === 0) return;
                const pick = demoTeams[Math.floor(Math.random() * demoTeams.length)];
                setTeamName(pick.name);
                setCommittedTeamName(pick.name);
                setSuggestions([]);
                setError(null);
                if (!compareMode) void runScout({ team: pick.name, game: selectedGame });
              }}
              disabled={demoTeams.length === 0}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 700 }}
            >
              Random example
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => {
                  setCompareMode(e.target.checked);
                  setReport(null);
                  setReportB(null);
                  setError(null);
                }}
              />
              <span style={{ fontWeight: 800, color: '#333' }}>Compare</span>
              <span style={{ fontSize: '0.82rem', color: '#666' }}>(A vs B)</span>
            </label>
          </div>

          <form onSubmit={handleScout} style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={teamName}
              onChange={(e) => {
                const v = e.target.value;
                setTeamName(v);
                if (isExactSuggestionMatch(v, suggestions)) {
                  setCommittedTeamName(v);
                  setSuggestions([]);
                } else {
                  setCommittedTeamName(null);
                }
              }}
              placeholder={selectedGame === 'VALORANT' ? 'Enter VALORANT team name…' : 'Enter LoL team name…'}
              list="team-suggestions"
              aria-label="Opponent team name"
              style={{ padding: '12px', width: compareMode ? '260px' : '300px', borderRadius: '8px', border: '1px solid #ccc' }}
            />

            {compareMode ? (
              <>
                <input
                  type="text"
                  value={teamNameB}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTeamNameB(v);
                    if (isExactSuggestionMatch(v, suggestionsB)) {
                      setCommittedTeamNameB(v);
                      setSuggestionsB([]);
                    } else {
                      setCommittedTeamNameB(null);
                    }
                  }}
                  placeholder={selectedGame === 'VALORANT' ? 'Compare vs (VAL)…' : 'Compare vs (LoL)…'}
                  list="team-suggestions-b"
                  aria-label="Opponent B team name"
                  style={{ padding: '12px', width: '260px', borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <datalist id="team-suggestions-b">
                  {suggestionsB
                    .filter((s) => !isSameTeamName(s.name, teamName))
                    .map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                </datalist>
              </>
            ) : (
              <input
                type="text"
                value={ourTeamName}
                onChange={(e) => {
                  const v = e.target.value;
                  setOurTeamName(v);
                  if (isExactSuggestionMatch(v, ourSuggestions)) {
                    setCommittedOurTeamName(v);
                    setOurSuggestions([]);
                  } else {
                    setCommittedOurTeamName(null);
                  }
                }}
                placeholder="(Optional) Your team name…"
                list="team-suggestions-our"
                aria-label="Your team name (optional)"
                style={{ padding: '12px', width: '240px', borderRadius: '8px', border: '1px solid #ccc' }}
              />
            )}
            <datalist id="team-suggestions-our">
              {ourSuggestions
                .filter((s) => !isSameTeamName(s.name, teamName) && !isSameTeamName(s.name, teamNameB))
                .map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
            </datalist>
            <datalist id="team-suggestions">
              {suggestions
                .filter((s) => (compareMode ? !isSameTeamName(s.name, teamNameB) : !isSameTeamName(s.name, ourTeamName)))
                .map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
            </datalist>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#9aa5b1' : '#007bff',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              Generate Report
            </button>
          </form>
        </div>
      </section>

      {error && (
        <section style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '10px', border: '1px solid #f1d4d7', marginBottom: '20px' }}>
          <div style={{ fontWeight: 900, color: '#721c24' }}>Couldn’t generate a report</div>
          <div style={{ marginTop: '6px', color: '#333' }}>{error.message}</div>

          {error.suggestions && error.suggestions.length > 0 ? (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Try one of these teams:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {error.suggestions.slice(0, 10).map((s) => (
                  compareMode ? (
                    <div key={s.id} style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTeamName(s.name);
                          setCommittedTeamName(s.name);
                          setSuggestions([]);
                          setError(null);
                        }}
                        style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 700 }}
                        title="Use as Opponent A"
                      >
                        {s.name} (A)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTeamNameB(s.name);
                          setCommittedTeamNameB(s.name);
                          setSuggestionsB([]);
                          setError(null);
                        }}
                        style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 700 }}
                        title="Use as Opponent B"
                      >
                        (B)
                      </button>
                    </div>
                  ) : (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setTeamName(s.name);
                        setCommittedTeamName(s.name);
                        setSuggestions([]);
                        setError(null);
                      }}
                      style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {s.name}
                    </button>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
              Tip: start typing and pick from the autocomplete list.
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontWeight: 800 }}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {compareMode && report && reportB ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: 0, color: '#333' }}>Compare View</h2>
            <div style={{ marginTop: '6px', color: '#666', fontSize: '0.9rem' }}>
              Side-by-side opponent snapshots (same game). Compare mode generates opponent-only reports for both teams.
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[
              { label: 'Opponent A', r: report },
              { label: 'Opponent B', r: reportB },
            ].map(({ label, r }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {r.isMockData && (
                  <div style={{
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #ffeeba',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    ⚠️ Note: Showing demo/mock data.
                    <div style={{ marginTop: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                      {r.mockReason === 'MissingApiKey'
                        ? 'Reason: GRID_API_KEY is not configured in this environment.'
                        : r.mockReason === 'ApiError'
                          ? 'Reason: GRID API request failed (rate limit/network/etc.).'
                          : 'Reason: Team was not found or data was unavailable.'}
                    </div>
                  </div>
                )}

                <section style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                  <h2 style={{ margin: 0, color: '#333' }}>{label}: {r.opponentName}</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: '12px' }}>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Win Rate</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: r.winProbability > 50 ? '#28a745' : '#dc3545' }}>{r.winProbability}%</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg. Score</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#333' }}>{r.avgScore}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Matches</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#333' }}>{r.matchesAnalyzed}</div>
                    </div>
                  </div>

                  {r.evidence && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#666' }}>
                      <strong>Window:</strong> {formatDate(r.evidence.startTime)} → {formatDate(r.evidence.endTime)} • <strong>Confidence:</strong> {r.evidence.winRateConfidence}
                    </div>
                  )}
                </section>

                <section style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📊 Maps & Tempo</h3>
                  <div style={{ margin: '8px 0 0 0', color: '#333' }}>
                    <strong>Aggression:</strong>{' '}
                    <span style={{
                      marginLeft: '8px',
                      padding: '3px 10px',
                      borderRadius: '14px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      backgroundColor: r.aggression === 'High' ? '#f8d7da' : r.aggression === 'Medium' ? '#fff3cd' : '#d4edda',
                      color: r.aggression === 'High' ? '#721c24' : r.aggression === 'Medium' ? '#856404' : '#155724'
                    }}>{r.aggression}</span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Map</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Played</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Win</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.topMaps.slice(0, 5).map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 800 }}>{renderMapLink((r.game || selectedGame) as any, m.mapName)}</td>
                          <td style={{ padding: '10px 8px' }}>{m.matchesPlayed}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 800, color: m.winRate >= 0.5 ? '#28a745' : '#dc3545' }}>{Math.round(m.winRate * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section style={{ backgroundColor: '#007bff', color: 'white', padding: '18px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>🎯 How to Win</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                    {r.howToWin.slice(0, 4).map((tip, i) => (
                      <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ fontWeight: 900, marginBottom: '4px' }}>{tip.insight}</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>Evidence: {tip.evidence}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ))}
          </div>
        </div>
      ) : report ? (() => {
        const isMatchup = Boolean(report.matchup && report.ourTeamName);
        const our = report.matchup?.our;
        const opponent = report.matchup?.opponent;
        const ourEvidence = our?.evidence;
        const opponentEvidence = report.evidence;

        return (
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
              ⚠️ Note: Showing demo/mock data.
              <div style={{ marginTop: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                {report.mockReason === 'MissingApiKey'
                  ? 'Reason: GRID_API_KEY is not configured in this environment.'
                  : report.mockReason === 'ApiError'
                    ? 'Reason: GRID API request failed (rate limit/network/etc.).'
                    : 'Reason: Team was not found or data was unavailable.'}
              </div>
            </div>
          )}
          {/* 1. Team Snapshot */}
          <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #007bff', paddingBottom: '10px', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#333' }}>
                {report.ourTeamName ? `Matchup: ${report.ourTeamName} vs ${report.opponentName}` : `Team Snapshot: ${report.opponentName}`}
              </h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => void handleCopyShareLink({ teamOverride: report.opponentName, ourOverride: report.ourTeamName })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #007bff',
                      background: 'white',
                      color: '#007bff',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                    }}
                    title="Copies a link that re-hydrates the form and auto-runs the report"
                  >
                    Copy share link
                  </button>
                  {shareLinkCopiedTooltip && (
                    <div
                      role="status"
                      aria-label="Share link copied"
                      aria-live="polite"
                      style={{
                        position: 'absolute',
                        top: -34,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1f2937',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      Copied!
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDownloadPdf(report)}
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
            </div>

            {isMatchup && (
              <div style={{ marginTop: '10px', color: '#666', fontSize: '0.9rem' }}>
                Matchup mode: this report includes <strong>both teams’ snapshots</strong> and a small set of <strong>computed deltas</strong>. Sections that use opponent-only data are labeled.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginTop: '20px' }}>
              {isMatchup ? (
                <>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Our Win Rate
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: (our?.winRate || 0) > 50 ? '#28a745' : '#dc3545' }}>{our?.winRate ?? '—'}%</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Opponent Win Rate
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: (opponent?.winRate || 0) > 50 ? '#28a745' : '#dc3545' }}>{opponent?.winRate ?? '—'}%</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Our Avg. Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{our?.avgScore ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Opponent Avg. Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{opponent?.avgScore ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Our Matches</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{our?.matchesAnalyzed ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Opponent Matches</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{opponent?.matchesAnalyzed ?? '—'}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Win Probability
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: report.winProbability > 50 ? '#28a745' : '#dc3545' }}>{report.winProbability}%</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                      Avg. Score
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{report.avgScore}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Matches</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{report.matchesAnalyzed}</div>
                  </div>
                </>
              )}
            </div>
          </section>

          {isMatchup && report.matchup && (
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🔎 Matchup Differences</h3>
              <div style={{ marginTop: '8px', color: '#666', fontSize: '0.9rem' }}>
                These deltas are computed from recent map results and coarse tempo proxies.
              </div>

              <h4 style={{ margin: '18px 0 10px 0', color: '#333' }}>Map pool deltas (shared maps)</h4>
              {report.matchup.deltas.mapPool && report.matchup.deltas.mapPool.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Map</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Our WR</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Opp WR</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Δ (pp)</th>
                        <th style={{ padding: '10px 8px', color: '#666' }}>Min sample</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.matchup.deltas.mapPool.slice(0, 8).map((d) => (
                        <tr key={d.mapName} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 800 }}>{renderMapLink((report.game || selectedGame) as any, d.mapName)}</td>
                          <td style={{ padding: '10px 8px' }}>{Math.round(d.our.winRate * 100)}% ({d.our.matchesPlayed})</td>
                          <td style={{ padding: '10px 8px' }}>{Math.round(d.opponent.winRate * 100)}% ({d.opponent.matchesPlayed})</td>
                          <td style={{ padding: '10px 8px', fontWeight: 900, color: d.deltaWinRate >= 0 ? '#28a745' : '#dc3545' }}>
                            {d.deltaWinRate >= 0 ? '+' : ''}{Math.round(d.deltaWinRate * 100)}pp
                          </td>
                          <td style={{ padding: '10px 8px' }}>{d.minSample}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ marginTop: '10px', color: '#666', fontStyle: 'italic' }}>No shared-map deltas available in the current window.</div>
              )}

              <h4 style={{ margin: '18px 0 10px 0', color: '#333' }}>Tempo (aggression proxy)</h4>
              <div style={{ color: '#666' }}>{report.matchup.deltas.aggression.note || '—'}</div>

              {(report.matchup.deltas.rosterStability?.note || our?.rosterStability || opponent?.rosterStability) && (
                <>
                  <h4 style={{ margin: '18px 0 10px 0', color: '#333' }}>Roster stability</h4>
                  {report.matchup.deltas.rosterStability?.note && (
                    <div style={{ color: '#666', marginBottom: '8px' }}>{report.matchup.deltas.rosterStability.note}</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontWeight: 900, color: '#333' }}>Our stability</div>
                      <div style={{ marginTop: '6px', color: '#666' }}>{our?.rosterStability ? `${our.rosterStability.confidence} (based on ${our.rosterStability.matchesConsidered})` : '—'}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontWeight: 900, color: '#333' }}>Opponent stability</div>
                      <div style={{ marginTop: '6px', color: '#666' }}>{opponent?.rosterStability ? `${opponent.rosterStability.confidence} (based on ${opponent.rosterStability.matchesConsidered})` : '—'}</div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* 1.5 Evidence & Sources */}
          {opponentEvidence && (
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🧾 Evidence & Sources</h3>

              {isMatchup && ourEvidence ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '10px' }}>
                    <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', border: '1px solid #eee' }}>
                      <div style={{ fontWeight: 900, color: '#333' }}>Our evidence window</div>
                      <div style={{ marginTop: '8px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Time window:</strong>{' '}
                        <span style={{ color: '#666' }}>{formatDate(ourEvidence.startTime)} → {formatDate(ourEvidence.endTime)}</span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Sample:</strong>{' '}
                        <span style={{ color: '#666' }}>
                          {ourEvidence.matchesAnalyzed} matches • {ourEvidence.mapsPlayed} maps • {ourEvidence.seriesIds.length} series
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Win-rate confidence:</strong>{' '}
                        <span style={{ color: '#666' }}>{ourEvidence.winRateConfidence}</span>
                      </div>
                      {ourEvidence.winRateTrend && (
                        <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#333' }}>
                          <strong>Trend:</strong>{' '}
                          <span style={{ color: '#666' }}>
                            {ourEvidence.winRateTrend.direction === 'Up' ? '↑' : ourEvidence.winRateTrend.direction === 'Down' ? '↓' : '→'}
                            {' '}{ourEvidence.winRateTrend.direction}
                            {' '}({ourEvidence.winRateTrend.deltaPctPoints >= 0 ? '+' : ''}{ourEvidence.winRateTrend.deltaPctPoints}pp)
                            {' '}— last {ourEvidence.winRateTrend.recentMatches} vs previous {ourEvidence.winRateTrend.previousMatches}
                          </span>
                        </div>
                      )}
                      <details style={{ marginTop: '10px' }}>
                        <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 700 }}>Our series IDs used</summary>
                        <div style={{ marginTop: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.85rem', color: '#333', background: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '10px', overflowX: 'auto' }}>
                          {ourEvidence.seriesIds.length > 0 ? ourEvidence.seriesIds.join(', ') : '—'}
                        </div>
                      </details>
                    </div>

                    <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px', border: '1px solid #eee' }}>
                      <div style={{ fontWeight: 900, color: '#333' }}>Opponent evidence window</div>
                      <div style={{ marginTop: '8px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Time window:</strong>{' '}
                        <span style={{ color: '#666' }}>{formatDate(opponentEvidence.startTime)} → {formatDate(opponentEvidence.endTime)}</span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Sample:</strong>{' '}
                        <span style={{ color: '#666' }}>
                          {opponentEvidence.matchesAnalyzed} matches • {opponentEvidence.mapsPlayed} maps • {opponentEvidence.seriesIds.length} series
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.95rem', color: '#333' }}>
                        <strong>Win-rate confidence:</strong>{' '}
                        <span style={{ color: '#666' }}>{opponentEvidence.winRateConfidence}</span>
                      </div>
                      {opponentEvidence.winRateTrend && (
                        <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#333' }}>
                          <strong>Trend:</strong>{' '}
                          <span style={{ color: '#666' }}>
                            {opponentEvidence.winRateTrend.direction === 'Up' ? '↑' : opponentEvidence.winRateTrend.direction === 'Down' ? '↓' : '→'}
                            {' '}{opponentEvidence.winRateTrend.direction}
                            {' '}({opponentEvidence.winRateTrend.deltaPctPoints >= 0 ? '+' : ''}{opponentEvidence.winRateTrend.deltaPctPoints}pp)
                            {' '}— last {opponentEvidence.winRateTrend.recentMatches} vs previous {opponentEvidence.winRateTrend.previousMatches}
                          </span>
                        </div>
                      )}
                      <details style={{ marginTop: '10px' }}>
                        <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 700 }}>Opponent series IDs used</summary>
                        <div style={{ marginTop: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.85rem', color: '#333', background: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '10px', overflowX: 'auto' }}>
                          {opponentEvidence.seriesIds.length > 0 ? opponentEvidence.seriesIds.join(', ') : '—'}
                        </div>
                      </details>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginTop: '10px' }}>
                    <div style={{ fontSize: '0.95rem', color: '#333' }}>
                      <strong>Time window:</strong>{' '}
                      <span style={{ color: '#666' }}>{formatDate(opponentEvidence.startTime)} → {formatDate(opponentEvidence.endTime)}</span>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#333' }}>
                      <strong>Sample:</strong>{' '}
                      <span style={{ color: '#666' }}>
                        {opponentEvidence.matchesAnalyzed} matches • {opponentEvidence.mapsPlayed} maps • {opponentEvidence.seriesIds.length} series
                      </span>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#333' }}>
                      <strong>Win-rate confidence:</strong>{' '}
                      <span style={{ color: '#666' }}>{opponentEvidence.winRateConfidence}</span>
                    </div>
                  </div>

                  {opponentEvidence.winRateTrend && (
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#333' }}>
                      <strong>Trend:</strong>{' '}
                      <span style={{ color: '#666' }}>
                        {opponentEvidence.winRateTrend.direction === 'Up' ? '↑' : opponentEvidence.winRateTrend.direction === 'Down' ? '↓' : '→'}
                        {' '}{opponentEvidence.winRateTrend.direction}
                        {' '}({opponentEvidence.winRateTrend.deltaPctPoints >= 0 ? '+' : ''}{opponentEvidence.winRateTrend.deltaPctPoints}pp)
                        {' '}— last {opponentEvidence.winRateTrend.recentMatches} vs previous {opponentEvidence.winRateTrend.previousMatches}
                      </span>
                    </div>
                  )}

                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 700 }}>Series IDs used</summary>
                    <div style={{ marginTop: '8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.85rem', color: '#333', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '10px', overflowX: 'auto' }}>
                      {opponentEvidence.seriesIds.length > 0 ? opponentEvidence.seriesIds.join(', ') : '—'}
                    </div>
                  </details>
                </>
              )}

              {report.dataSources && report.dataSources.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#333' }}>Data sources</div>
                  <ul style={{ margin: '8px 0 0 18px', color: '#333' }}>
                    {report.dataSources.map((s) => (
                      <li key={s.id} style={{ marginBottom: '6px' }}>
                        <div style={{ fontWeight: 800 }}>
                          {s.name}{' '}
                          <span style={{ fontWeight: 700, color: s.used ? '#155724' : '#721c24' }}>
                            ({s.used ? 'used' : 'not used'})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{s.purpose}</div>
                        {s.endpoint && (
                          <div style={{ marginTop: '2px', fontSize: '0.8rem', color: '#666', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                            {s.endpoint}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isMatchup && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                  Note: raw inputs shown below are opponent-scoped.
                </div>
              )}

              {report.rawInputs && report.rawInputs.matches && report.rawInputs.matches.length > 0 && (
                <details style={{ marginTop: '12px' }}>
                  <summary style={{ cursor: 'pointer', color: '#007bff', fontWeight: 700 }}>
                    Show raw inputs (normalized match list)
                  </summary>
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
                    Showing {report.rawInputs.shownMatches} of {report.rawInputs.totalMatches} matches{report.rawInputs.truncated ? ' (truncated)' : ''}.
                  </div>

                  <div style={{ marginTop: '10px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Date</th>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Map</th>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Result</th>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Score</th>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Opponent</th>
                          <th style={{ padding: '10px 8px', color: '#666' }}>Series</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rawInputs.matches.map((m) => (
                          <tr key={m.matchId} style={{ borderBottom: '1px solid #f1f1f1' }}>
                            <td style={{ padding: '10px 8px' }}>{formatDate(m.startTime)}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 800 }}>{renderMapLink((report.game || selectedGame) as any, m.mapName)}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 900, color: m.result === 'W' ? '#28a745' : m.result === 'L' ? '#dc3545' : '#666' }}>
                              {m.result}
                            </td>
                            <td style={{ padding: '10px 8px' }}>{m.teamScore}-{m.opponentScore}</td>
                            <td style={{ padding: '10px 8px' }}>{m.opponentName}</td>
                            <td style={{ padding: '10px 8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.8rem', color: '#333' }}>
                              {m.seriesId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </section>
          )}

          {/* 2. Key Tendencies */}
          {isMatchup && our && (
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📊 Our Tendencies</h3>
              <div style={{ margin: '15px 0' }}>
                <strong>Playstyle Aggression:</strong>
                <span
                  title="Aggression is a coarse proxy derived from average score per match (higher scoring tends to correlate with higher pace/volatility)."
                  style={{ marginLeft: '6px', color: '#666', cursor: 'help', fontWeight: 700 }}
                >ⓘ</span>
                <span style={{
                  marginLeft: '10px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  backgroundColor: our.aggression === 'High' ? '#f8d7da' : our.aggression === 'Medium' ? '#fff3cd' : '#d4edda',
                  color: our.aggression === 'High' ? '#721c24' : our.aggression === 'Medium' ? '#856404' : '#155724'
                }}>{our.aggression}</span>
              </div>

              {our.rosterStability && (
                <div style={{ marginTop: '10px', fontSize: '0.95rem', color: '#333' }}>
                  <strong>Roster stability:</strong>{' '}
                  <span style={{ color: '#666' }}>{our.rosterStability.confidence} (based on {our.rosterStability.matchesConsidered} match(es) with roster data)</span>
                </div>
              )}

              {our.roster && our.roster.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontWeight: 900, color: '#333' }}>Recent roster</div>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {our.roster.slice(0, 10).map((p) => (
                      <span key={p.id} style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '999px', padding: '6px 10px', fontSize: '0.85rem', color: '#333', fontWeight: 700 }}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '12px 8px', color: '#666' }}>Map Name</th>
                    <th style={{ padding: '12px 8px', color: '#666' }}>Played</th>
                    <th style={{ padding: '12px 8px', color: '#666' }}>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {our.topMaps.map((m) => (
                    <tr key={m.mapName} style={{ borderBottom: '1px solid #f1f1f1' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{renderMapLink((report.game || selectedGame) as any, m.mapName)}</td>
                      <td style={{ padding: '12px 8px' }}>{m.matchesPlayed}</td>
                      <td style={{ padding: '12px 8px', color: m.winRate >= 0.5 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                        {Math.round(m.winRate * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{isMatchup ? '📊 Opponent Tendencies' : '📊 Key Tendencies'}</h3>
            <div style={{ margin: '15px 0' }}>
              <strong>Playstyle Aggression:</strong>
              <span
                title="Aggression is a coarse proxy derived from average score per match (higher scoring tends to correlate with higher pace/volatility)."
                style={{ marginLeft: '6px', color: '#666', cursor: 'help', fontWeight: 700 }}
              >ⓘ</span>
              <span style={{ 
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
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{renderMapLink((report.game || selectedGame) as any, m.mapName)}</td>
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
            <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{isMatchup ? '🧠 Opponent: Comps & Draft' : '🧠 Comps & Draft'}</h3>
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
          {report.game === 'VALORANT' && (
            <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{isMatchup ? '🗺️ Opponent: Default Map Plan (VAL)' : '🗺️ Default Map Plan (VAL)'}</h3>
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
                          <div style={{ fontWeight: 700, color: '#333' }}>{renderMapLink('VALORANT', mp.mapName)}</div>
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
                    const clutch = pt.clutch;
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
                            {topMaps.map((m, idx) => (
                              <span key={`${pt.playerId}-map-${m.mapName}-${idx}`}>
                                {idx > 0 ? ' • ' : ''}
                                {renderMapLink((report.game || selectedGame) as any, m.mapName)} ({m.matchesPlayed}×, {Math.round(m.winRate * 100)}%)
                              </span>
                            ))}
                          </div>
                        )}

                        {topPicks.length > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                            <strong>Top picks:</strong>{' '}
                            {topPicks.map(p => `${p.name} (${p.pickCount}×)`).join(', ')}
                          </div>
                        )}

                        {clutch && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#666' }}>
                            <strong>Clutch:</strong>{' '}
                            {clutch.rating} (close matches {clutch.closeMatchesPlayed}× • {Math.round(clutch.winRate * 100)}% wins)
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
              <h3 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>
                {isMatchup ? `🎯 How to Win (as ${report.ourTeamName} vs ${report.opponentName})` : '🎯 How to Win'}
              </h3>
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

          {isMatchup && report.matchup?.howToWinTransparency && (
            <section style={{ backgroundColor: '#007bff', color: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' }}>
              <details style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '10px',
                padding: '12px 12px'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>How these matchup tips were generated</summary>

                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  <strong>Mode:</strong> {report.matchup.howToWinTransparency.kind}
                </div>

                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  <strong>Based on:</strong>{' '}
                  our {report.matchup.howToWinTransparency.basedOn.ourMatchesAnalyzed} matches • opponent {report.matchup.howToWinTransparency.basedOn.opponentMatchesAnalyzed} matches • {report.matchup.howToWinTransparency.basedOn.sharedMaps} shared map(s)
                </div>

                {report.matchup.howToWinTransparency.notes && report.matchup.howToWinTransparency.notes.length > 0 && (
                  <ul style={{ marginTop: '10px', paddingLeft: '18px', color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
                    {report.matchup.howToWinTransparency.notes.map((n, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{n}</li>
                    ))}
                  </ul>
                )}
              </details>
            </section>
          )}

          {isMatchup && report.matchup?.opponentHowToWinEngine && report.matchup.opponentHowToWinEngine.candidates && report.matchup.opponentHowToWinEngine.candidates.length > 0 && (
            <section style={{ backgroundColor: '#007bff', color: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' }}>
              <details style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '10px',
                padding: '12px 12px'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Opponent-only engine scoring (for transparency)</summary>

                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  <strong>Formula:</strong> {report.matchup.opponentHowToWinEngine.formula}
                </div>

                <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                  Note: in matchup mode, the selected tips above are matchup-specific heuristics. This table shows the opponent-only engine candidates.
                </div>

                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.22)' }}>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Status</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Rule</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Impact</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>W</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>E</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Conf</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Candidate</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Why not picked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.matchup.opponentHowToWinEngine.candidates.slice(0, 12).map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{c.status}</td>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{c.rule}</td>
                          <td style={{ padding: '8px 6px', fontWeight: 800 }}>{c.breakdown.impact}</td>
                          <td style={{ padding: '8px 6px' }}>{Math.round(c.breakdown.weaknessSeverity * 100)}%</td>
                          <td style={{ padding: '8px 6px' }}>{Math.round(c.breakdown.exploitability * 100)}%</td>
                          <td style={{ padding: '8px 6px' }}>{c.breakdown.confidence}</td>
                          <td style={{ padding: '8px 6px', minWidth: 220 }}>
                            <div style={{ fontWeight: 700 }}>{c.insight}</div>
                            <div style={{ marginTop: '2px', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>{c.evidence}</div>
                          </td>
                          <td style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.8)' }}>{c.whyNotSelected || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}

          {!isMatchup && report.howToWinEngine && report.howToWinEngine.candidates && report.howToWinEngine.candidates.length > 0 && (
            <section style={{ backgroundColor: '#007bff', color: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' }}>
              <details style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '10px',
                padding: '12px 12px'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>How we scored these tips</summary>

                <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  <strong>Formula:</strong> {report.howToWinEngine.formula}
                </div>

                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.22)' }}>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Status</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Rule</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Impact</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>W</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>E</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Conf</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Candidate</th>
                        <th style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.75)' }}>Why not picked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.howToWinEngine.candidates.slice(0, 12).map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{c.status}</td>
                          <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{c.rule}</td>
                          <td style={{ padding: '8px 6px', fontWeight: 800 }}>{c.breakdown.impact}</td>
                          <td style={{ padding: '8px 6px' }}>{Math.round(c.breakdown.weaknessSeverity * 100)}%</td>
                          <td style={{ padding: '8px 6px' }}>{Math.round(c.breakdown.exploitability * 100)}%</td>
                          <td style={{ padding: '8px 6px' }}>{c.breakdown.confidence}</td>
                          <td style={{ padding: '8px 6px', minWidth: 220 }}>
                            <div style={{ fontWeight: 700 }}>{c.insight}</div>
                            <div style={{ marginTop: '2px', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>{c.evidence}</div>
                          </td>
                          <td style={{ padding: '8px 6px', color: 'rgba(255,255,255,0.8)' }}>{c.whyNotSelected || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
        </div>
        );
      })() : null}

      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '0.8rem', color: '#999' }}>
        {health && <span>API Status: {health.status}</span>}
        <p>© 2026 ScoutMaster 3000 - Built for <a href="https://cloud9.devpost.com/" target="_blank">Cloud9 × JetBrains Hackathon</a></p>
      </footer>
    </div>
  );
}

export default App;
