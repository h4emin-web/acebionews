import { Building2, ExternalLink, Globe, Mail, Phone, ShieldCheck } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-2">
        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">{m.name}</span>
        {m.whoGmp && (
          <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5">
            <ShieldCheck className="w-2.5 h-2.5" />
            WHO-GMP
          </Badge>
        )}
      </div>
      <div className="pl-5.5 flex flex-col gap-0.5 ml-1">
        {m.city && m.country && (
          <span className="text-[10px] text-muted-foreground">{m.city}, {m.country}</span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline flex items-center gap-1 w-fit"
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[200px]">{m.website}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        )}
        {m.email && (
          <a
            href={`mailto:${m.email}`}
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 w-fit transition-colors"
          >
            <Mail className="w-3 h-3 shrink-0" />
            {m.email}
          </a>
        )}
        {m.phone && (
          <a
            href={`tel:${m.phone}`}
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 w-fit transition-colors"
          >
            <Phone className="w-3 h-3 shrink-0" />
            {m.phone}
          </a>
        )}
      </div>
    </div>
  );
}

function RegionGroup({ title, manufacturers }: { title: string; manufacturers: Manufacturer[] }) {
  if (manufacturers.length === 0) return null;
  return (
    <div>
      <h3 className="text-[11px] font-bold text-muted-foreground px-3 py-1.5 bg-muted/30">{title}</h3>
      <div className="divide-y divide-border">
        {manufacturers.map((m, i) => (
          <ManufacturerItem key={`${m.name}-${i}`} m={m} />
        ))}
      </div>
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
      <div className="card-elevated rounded-lg overflow-hidden">
        <RegionGroup title="🇮🇳 인도" manufacturers={data.india} />
        <RegionGroup title="🇨🇳 중국" manufacturers={data.china} />
        <RegionGroup title="🌍 해외 (일본·유럽·미국 등)" manufacturers={data.global} />
      </div>
    </div>
  );
}
