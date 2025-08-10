"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  onApply: (params: URLSearchParams) => void;
};

export function Filters({ onApply }: Props) {
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("");
  const [service, setService] = useState("");
  const [publisher, setPublisher] = useState("");
  const [variables, setVariables] = useState<string>("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [size, setSize] = useState(() => typeof window !== "undefined" ? (localStorage.getItem("odfp-size") || "20") : "20");
  const [license, setLicense] = useState("");
  const [platform, setPlatform] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Prefill from URL on first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    setQ(url.searchParams.get("q") || "");
    setFormat(url.searchParams.get("format") || "");
    setService(url.searchParams.get("service") || "");
    setPublisher(url.searchParams.get("publisher") || "");
    setVariables(url.searchParams.get("variables") || "");
    setTimeStart(url.searchParams.get("time_start") || "");
    setTimeEnd(url.searchParams.get("time_end") || "");
    const s = url.searchParams.get("size");
    if (s) setSize(s);
    setLicense(url.searchParams.get("license") || "");
    setPlatform(url.searchParams.get("platform") || "");
  }, []);

  const { data: variableSuggest } = useSWR(`/api/v1/suggest?type=variable&prefix=${encodeURIComponent(variables)}`, fetcher);
  const { data: publisherSuggest } = useSWR(`/api/v1/suggest?type=publisher&prefix=${encodeURIComponent(publisher)}`, fetcher);

  const variableOptions = (variableSuggest?.items || []).slice(0, 5);
  const publisherOptions = (publisherSuggest?.items || []).slice(0, 5);

  const apply = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (format) params.set("format", format);
    if (service) params.set("service", service);
    if (publisher) params.set("publisher", publisher);
    if (variables) params.set("variables", variables);
    if (timeStart) params.set("time_start", timeStart);
    if (timeEnd) params.set("time_end", timeEnd);
    if (size) params.set("size", size);
    if (license) params.set("license", license);
    if (platform) params.set("platform", platform);
    // Reset paging when filters change
    params.set("page", "1");
    try { localStorage.setItem("odfp-size", size); } catch {}
    onApply(params);
  };

  const quickSearches = [
    { label: "🪸 Coral Reef Data", q: "coral reef bleaching hotspot temperature stress", variables: "" },
    { label: "🌊 Sea Surface Temperature", q: "sea surface temperature satellite", variables: "sea_surface_temperature" },
    { label: "💨 Ocean Wind Data", q: "wind ocean atmosphere satellite scatterometer forecast", variables: "wind,eastward,northward,u_component,v_component" },
    { label: "🌊 Wave & Current Data", q: "wave height current buoy", variables: "wave_height,current_speed" },
    { label: "🛰️ Satellite Ocean Color", q: "chlorophyll satellite ocean color", variables: "chlorophyll_concentration" },
    { label: "🌡️ Water Temperature Profiles", q: "water temperature CTD profile", variables: "sea_water_temperature" }
  ];

  const applyQuickSearch = (search: typeof quickSearches[0]) => {
    // Build params directly instead of relying on state
    const params = new URLSearchParams();
    params.set("q", search.q);
    if (search.variables) params.set("variables", search.variables);
    if (format) params.set("format", format);
    if (service) params.set("service", service);
    if (publisher) params.set("publisher", publisher);
    if (timeStart) params.set("time_start", timeStart);
    if (timeEnd) params.set("time_end", timeEnd);
    if (size) params.set("size", size);
    if (license) params.set("license", license);
    if (platform) params.set("platform", platform);
    params.set("page", "1");
    try { localStorage.setItem("odfp-size", size); } catch {}
    
    // Update state to reflect the search
    setQ(search.q);
    setVariables(search.variables);
    
    // Apply the search with correct params
    onApply(params);
  };

  return (
    <div className="space-y-3">
      {/* Quick Search Examples */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">Quick Ocean Data Searches:</div>
        <div className="flex flex-wrap gap-2">
          {quickSearches.map((search) => (
            <button
              key={search.label}
              onClick={() => applyQuickSearch(search)}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-800/50"
            >
              {search.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 rounded-xl border border-slate-200 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="md:col-span-4">
        <Input
          placeholder="Search oceanographic data (e.g., coral reef, sea surface temperature, satellite wind)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
        />
      </div>
      <div className="md:col-span-2">
        <Input placeholder="Ocean variables (e.g., sea_surface_temperature, chlorophyll)" value={variables} onChange={(e) => setVariables(e.target.value)} />
        {variableOptions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-600">
            {variableOptions.map((v: string) => (
              <button key={v} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200" onClick={() => setVariables(v)}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="md:col-span-2">
        <Select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Any format</option>
          <option>NetCDF</option>
          <option>CSV</option>
          <option>GRIB2</option>
          <option>HDF5</option>
          <option>Zarr</option>
          <option>GeoTIFF</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">Any service</option>
          <option>ERDDAP</option>
          <option>OPeNDAP</option>
          <option>THREDDS</option>
          <option>HTTP</option>
          <option>S3</option>
          <option>FTP</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Input placeholder="Publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        {publisherOptions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-600">
            {publisherOptions.map((p: string) => (
              <button key={p} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200" onClick={() => setPublisher(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="md:col-span-2">
        <Input type="date" placeholder="Start" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Input type="date" placeholder="End" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Select value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="10">10 / page</option>
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
        </Select>
      </div>
      {/* Advanced toggle */}
      <div className="md:col-span-2 flex items-center">
        <button
          type="button"
          className="text-sm text-slate-600 hover:underline"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? "Hide advanced" : "Show advanced"}
        </button>
      </div>
      {showAdvanced && (
        <div className="md:col-span-12 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-3">
            <Input placeholder="License (e.g., CC-BY)" value={license} onChange={(e) => setLicense(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Input placeholder="Platform (e.g., satellite, buoy)" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
        </div>
      )}
      <div className="md:col-span-2 flex items-center gap-2">
        <Button onClick={apply} className="w-full">Apply</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setQ("");
            setFormat("");
            setService("");
            setPublisher("");
            setVariables("");
            setTimeStart("");
            setTimeEnd("");
            setSize("20");
            setLicense("");
            setPlatform("");
            const p = new URLSearchParams();
            p.set("page", "1");
            onApply(p);
          }}
        >
          Clear
        </Button>
      </div>
      </div>
    </div>
  );
}

