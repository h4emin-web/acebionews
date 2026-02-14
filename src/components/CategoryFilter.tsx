type Props = {
  categories: string[];
  active: string | null;
  onChange: (c: string | null) => void;
  regionFilter: string | null;
  onRegionChange: (r: string | null) => void;
  countryFilter: string | null;
  onCountryChange: (c: string | null) => void;
  countries: { code: string; flag: string; name: string }[];
};

export const CategoryFilter = ({
  categories, active, onChange,
  regionFilter, onRegionChange,
  countryFilter, onCountryChange, countries,
}: Props) => {
  const regions = ["국내", "해외"];

  const btnClass = (isActive: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
      isActive
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-secondary-foreground border-border hover:border-primary/30"
    }`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {regions.map((r) => (
          <button key={r} onClick={() => onRegionChange(regionFilter === r ? null : r)} className={btnClass(regionFilter === r)}>
            {r}
          </button>
        ))}

        <div className="w-px h-6 bg-border self-center mx-0.5" />

        {countries.map((c) => (
          <button key={c.code} onClick={() => onCountryChange(countryFilter === c.code ? null : c.code)} className={btnClass(countryFilter === c.code)}>
            {c.flag} {c.name}
          </button>
        ))}

        <div className="w-px h-6 bg-border self-center mx-0.5" />

        <button onClick={() => onChange(null)} className={btnClass(!active)}>전체</button>
        {categories.map((c) => (
          <button key={c} onClick={() => onChange(active === c ? null : c)} className={btnClass(active === c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
};
