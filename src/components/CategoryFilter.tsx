type Props = {
  categories: string[];
  active: string | null;
  onChange: (c: string | null) => void;
  regionFilter: string | null;
  onRegionChange: (r: string | null) => void;
};

export const CategoryFilter = ({ categories, active, onChange, regionFilter, onRegionChange }: Props) => {
  const regions = ["국내", "해외"];

  return (
    <div className="flex flex-wrap gap-2">
      {/* Region filters */}
      {regions.map((r) => (
        <button
          key={r}
          onClick={() => onRegionChange(regionFilter === r ? null : r)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            regionFilter === r
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {r}
        </button>
      ))}

      <div className="w-px h-6 bg-border self-center mx-1" />

      {/* Category filters */}
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          !active
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        }`}
      >
        전체
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(active === c ? null : c)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === c
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
};
