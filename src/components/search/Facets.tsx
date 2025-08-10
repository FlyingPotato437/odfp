"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  selected: URLSearchParams;
  onToggle: (key: string, value: string) => void;
};

export function Facets({ selected, onToggle }: Props) {
  const qs = selected.toString();
  const { data } = useSWR(`/api/v1/stats/facets?${qs}`, fetcher);
  const stats = data || { publishers: {}, formats: {}, services: {}, variables: {}, decades: {} };

  const renderGroup = (title: string, items: Record<string, number>, key: string) => (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {Object.entries(items)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => {
            const active = selected.get(key)?.toLowerCase() === name.toLowerCase();
            return (
              <li key={name}>
                <button
                  className={`flex w-full items-center justify-between rounded px-2 py-1 ${active ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                  onClick={() => onToggle(key, active ? "" : name)}
                >
                  <span>{name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{count}</span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderGroup("Publisher", stats.publishers, "publisher")}
      {renderGroup("Format", stats.formats, "format")}
      {renderGroup("Service", stats.services, "service")}
      {renderGroup("Variables", stats.variables, "variables")}
      {renderGroup("Decade", stats.decades, "decade")}
    </div>
  );
}

