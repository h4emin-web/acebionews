import { Search, X } from "lucide-react";
import { useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
};

export const SearchBar = ({ value, onChange, suggestions }: Props) => {
  const [focused, setFocused] = useState(false);
  const filtered = value.length > 0
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : [];

  return (
    <div className="relative w-full max-w-xl">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg bg-card border transition-all duration-200 ${focused ? "border-primary ring-2 ring-primary/10" : "border-border"}`}>
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="원료의약품명 검색 (예: 세마글루타이드, 암로디핀...)"
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
        />
        {value && (
          <button onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {focused && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              onMouseDown={() => onChange(s)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors text-foreground"
            >
              <span className="text-primary font-mono text-xs mr-2">API</span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
