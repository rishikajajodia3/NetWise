import { inputClass } from './ui.jsx';

const NOT_TESTED = 'not_tested';

/** One dropdown per symptom, generated from the definitions returned by the API. */
export default function SymptomForm({ symptoms, selections, onChange }) {
  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      {Object.entries(symptoms).map(([key, def]) => {
        const id = `symptom-${key}`;
        const value = selections[key];
        const tested = value !== NOT_TESTED;
        return (
          <div key={key}>
            <label htmlFor={id} className="mb-1 flex items-start gap-2 text-sm font-medium text-slate-800">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tested ? 'bg-blue-600' : 'bg-slate-300'}`}
                aria-hidden="true"
              />
              {def.label}
            </label>
            <select
              id={id}
              value={value}
              onChange={(e) => onChange(key, e.target.value)}
              aria-describedby={`${id}-help`}
              className={`${inputClass} ${tested ? 'border-blue-400' : 'text-slate-500'}`}
            >
              {Object.entries(def.values).map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              ))}
            </select>
            <p id={`${id}-help`} className="mt-1 text-xs text-slate-500">
              {def.howToTest}
            </p>
          </div>
        );
      })}
    </div>
  );
}
