import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import PlannerPage from './pages/PlannerPage.jsx';
import TroubleshootingPage from './pages/TroubleshootingPage.jsx';

const PAGES = [
  { id: 'planner', label: 'Network Planner' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

// The current page is kept in the URL hash (#planner, #troubleshooting) so
// switching sections never reloads the page and the browser back button works.
function pageFromHash() {
  const id = window.location.hash.replace('#', '');
  return PAGES.some((p) => p.id === id) ? id : PAGES[0].id;
}

export default function App() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header pages={PAGES} currentPage={page} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Both pages stay mounted so form input and results survive switching tabs. */}
        <div hidden={page !== 'planner'}>
          <PlannerPage />
        </div>
        <div hidden={page !== 'troubleshooting'}>
          <TroubleshootingPage />
        </div>
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        NetWise: VLSM network planning and rule-based troubleshooting for Cisco Packet Tracer labs.
      </footer>
    </div>
  );
}
