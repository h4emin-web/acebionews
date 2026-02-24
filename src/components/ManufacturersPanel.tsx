import { Building2, ExternalLink } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import type { ManufacturerData, Manufacturer } from "@/hooks/useNewsData";

type Props = {
  keyword: string;
  data: ManufacturerData | undefined;
  loading: boolean;
};

function ManufacturerItem({ m }: { m: Manufacturer }) {
  const url = m.website
    ? m.website.startsWith("http") ? m.website : `https://${m.website}`
    : null;

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors group"
    >
      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="truncate text-foreground group-hover:text-primary transition-colors">{m.name}</span>
      <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary shrink-0 ml-auto" />
    </a>
  ) : (
    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
      <Building2 className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{m.name}</span>
    </div>
  );
}

function RegionGroup({ title, manufacturers }: { title: string; manufacturers: Manufacturer[] }) {
  if (manufacturers.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground px-3">{title}</h3>
      {manufacturers.map((m, i) => (
        <ManufacturerItem key={`${m.name}-${i}`} m={m} />
      ))}
    </div>
  );
}

export function ManufacturersPanel({ keyword, data, loading }: Props) {
  if (loading) {
    return (
      <div className="card-elevated rounded-lg">
        <PillLoader text={`"${keyword}" 제조원 검색중...`} />
      </div>
    );
  }

  if (!data || (data.india.length === 0 && data.china.length === 0 && data.global.length === 0)) {
    return (
      <div className="text-center py-12 card-elevated rounded-lg">
        <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
        <p className="text-muted-foreground text-sm">제조원 정보를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="w-4 h-4" />
        <span>"{keyword}" 원료의약품 제조원</span>
      </div>
      <div className="card-elevated rounded-lg p-2 space-y-3">
        <RegionGroup title="인도" manufacturers={data.india} />
        <RegionGroup title="중국" manufacturers={data.china} />
        <RegionGroup title="해외 (일본·유럽·미국 등)" manufacturers={data.global} />
      </div>
    </div>
  );
}
