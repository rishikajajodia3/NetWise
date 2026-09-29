export default function Header({ pages, currentPage }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <a href="#planner" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold text-slate-900">NetWise</span>
        </a>
        <nav aria-label="Main">
          <ul className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {pages.map((p) => {
              const active = p.id === currentPage;
              return (
                <li key={p.id} className="flex-1 sm:flex-none">
                  <a
                    href={`#${p.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-4 py-1.5 text-center text-sm font-medium transition-colors ${
                      active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
