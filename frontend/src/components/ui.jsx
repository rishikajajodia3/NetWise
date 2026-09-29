// Small shared UI pieces used by both pages.

const ALERT_STYLES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-slate-200 bg-slate-100 text-slate-700',
};

export function Alert({ type = 'info', title, children }) {
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${ALERT_STYLES[type]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" aria-hidden="true" />
      {label}
    </span>
  );
}

const DEVICE_STYLES = {
  pc: 'bg-sky-100 text-sky-800',
  router: 'bg-violet-100 text-violet-800',
  switch: 'bg-teal-100 text-teal-800',
};
const DEVICE_LABELS = { pc: 'PC', router: 'Router', switch: 'Switch' };

/** Shows where a command is typed: on the PC, or on a Cisco router/switch. */
export function DeviceBadge({ device }) {
  return (
    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${DEVICE_STYLES[device] ?? 'bg-slate-100 text-slate-700'}`}>
      {DEVICE_LABELS[device] ?? device}
    </span>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 aria-invalid:border-red-400';
