import { Building2, Globe, Mail, Phone, Shield, ShieldCheck, MapPin } from "lucide-react";
import { PillLoader } from "@/components/PillLoader";
import type { ManufacturerData, Manufacturer } from "@/hooks/useNewsData";

type Props = {
  keyword: string;
  data: ManufacturerData | undefined;
  loading: boolean;
};

const countryFlags: Record<string, string> = {
  India: "in", China: "cn", Japan: "jp", Germany: "de", France: "fr",
  Italy: "it", Spain: "es", Switzerland: "ch", UK: "gb", USA: "us",
  "United States": "us", "South Korea": "kr", Canada: "ca", Australia: "au",
  Netherlands: "nl", Belgium: "be", Sweden: "se", Denmark: "dk",
  Ireland: "ie", Israel: "il", Singapore: "sg", Taiwan: "tw",
};

function getFlagCode(country: string): string | null {
  return countryFlags[country] || null;
}

function ManufacturerCard({ m }: { m: Manufacturer }) {
  const flag = getFlagCode(m.country);
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2.5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold text-foreground truncate">{m.name}</h4>
        </div>
        {m.whoGmp ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-3 h-3" />
            WHO-GMP
          </span>
        ) : (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
            <Shield className="w-3 h-3" />
            Non-GMP
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {flag && <img src={`https://flagcdn.com/16x12/${flag}.png`} alt={m.country} className="w-4 h-3" />}
        <MapPin className="w-3 h-3" />
        <span>{m.city}, {m.country}</span>
      </div>
      <div className="space-y-1 pt-1 border-t border-border/50">
        {m.website && (
          <a href={m.website.startsWith("http") ? m.website : `https://${m.website}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">{m.website.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {m.email && (
          <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{m.email}</span>
          </a>
        )}
        {m.phone && (
          <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{m.phone}</span>
          </a>
        )}
        {!m.website && !m.email && !m.phone && (
          <p className="text-xs text-muted-foreground/60 italic">연락처 정보 없음</p>
        )}
      </div>
    </div>
  );
}

function RegionSection({ title, icon, manufacturers }: { title: string; icon: string; manufacturers: Manufacturer[] }) {
  if (manufacturers.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
        <span className="text-xs font-normal text-muted-foreground">({manufacturers.length}곳)</span>
      </h3>
      <div className="grid gap-2 sm:grid-cols-1">
        {manufacturers.map((m, i) => (
          <ManufacturerCard key={`${m.name}-${i}`} m={m} />
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="w-4 h-4" />
        <span>"{keyword}" 원료의약품 제조원</span>
      </div>
      <RegionSection title="인도" icon="🇮🇳" manufacturers={data.india} />
      <RegionSection title="중국" icon="🇨🇳" manufacturers={data.china} />
      <RegionSection title="해외 (일본·유럽·미국 등)" icon="🌍" manufacturers={data.global} />
    </div>
  );
}
