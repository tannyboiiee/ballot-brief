import { useState } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import CandidateSearch from './pages/CandidateSearch';
import CandidateProfile from './pages/CandidateProfile';
import PartyLeaderboard from './pages/PartyLeaderboard';
import { COLORS } from './lib/designTokens';
import { DEFAULT_SCOPE } from './lib/scopes';

// Simple view-state switch, matching the pattern the Claude Design source
// used. If your existing app already uses React Router or another routing
// approach, swap this out for routes — each page component below is
// self-contained and doesn't depend on this particular nav mechanism.
export default function App() {
  const [view, setView] = useState('home');
  const [query, setQuery] = useState('');
  const [currentId, setCurrentId] = useState(null);

  // Which election (Lok Sabha, or a given state assembly) every page's data
  // is scoped to — see lib/scopes.js for the registry. Plain component
  // state, same as view/query/currentId above: switching scope, like
  // switching pages, won't survive a refresh or be shareable via a link
  // right now, since nothing in this app syncs to the URL yet. If that
  // matters later, it's a real routing addition (react-router or similar)
  // across the whole app, not something specific to scope — worth doing
  // deliberately as its own change, not bolted on here.
  const [scope, setScope] = useState(DEFAULT_SCOPE);

  const navActive = view === 'profile' ? 'candidates' : view;

  // Shared by both the Home page's party list and the Parties leaderboard
  // itself — navigates to Candidates pre-filled with the party name as the
  // search query. search.js already sorts results by criminal_case_count
  // DESC, so this gives "that party's candidates, top case-count first" for
  // free, no extra API work needed.
  const goToPartyCandidates = (partyName) => {
    setQuery(partyName);
    setView('candidates');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'visible',
        boxSizing: 'border-box',
        background: COLORS.pageBg,
        color: COLORS.ink,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        lineHeight: 1.45,
      }}
    >
      <Header active={navActive} onNavigate={setView} scope={scope} onScopeChange={setScope} />

      {view === 'home' && (
        <Home
          electionType={scope.electionType}
          state={scope.state}
          examples={scope.examples}
          onSearch={(q) => {
            setQuery(q);
            setView('candidates');
          }}
          onNavigateParties={() => setView('parties')}
        />
      )}

      {view === 'candidates' && (
        <CandidateSearch
          electionType={scope.electionType}
          state={scope.state}
          initialQuery={query}
          onOpenCandidate={(id) => {
            setCurrentId(id);
            setView('profile');
          }}
        />
      )}

      {view === 'profile' && (
        <CandidateProfile candidateId={currentId} onBack={() => setView('candidates')} />
      )}

      {view === 'parties' && (
        <PartyLeaderboard
          electionType={scope.electionType}
          state={scope.state}
          onSelectParty={goToPartyCandidates}
        />
      )}
    </div>
  );
}
