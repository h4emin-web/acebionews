import { Loader2, FlaskConical, Pill, Target, AlertTriangle, Building2, TrendingUp, Beaker, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type IngredientProfile = {
  nameKo: string;
  nameEn: string;
  cas: string | null;
  category: string;
  mechanism: string;
  indications: string[];
  dosageForms: string[];
  sideEffects: string[];
  originatorCompany: string;
  originatorBrand: string;
  patentStatus: string;
  marketTrend: string;
  relatedApis: string[];
};

type Props = {
  keyword: string;
  profile: IngredientProfile | null;
  loading: boolean;
  onRelatedClick?: (api: string) => void;
};

export const SearchResultsPanel = ({ keyword, profile, loading, onRelatedClick }: Props) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">원료 정보 분석중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">원료 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{profile.nameKo}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">{profile.nameEn}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{profile.category}</Badge>
          {profile.cas && <span className="text-[10px] text-muted-foreground font-mono">CAS: {profile.cas}</span>}
        </div>
      </div>

      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        <div className="divide-y divide-border">
          {/* 작용기전 */}
          <Section icon={<Beaker className="w-3.5 h-3.5 text-primary" />} title="작용기전">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{profile.mechanism}</p>
          </Section>

          {/* 적응증 */}
          <Section icon={<Target className="w-3.5 h-3.5 text-primary" />} title="적응증">
            <div className="flex flex-wrap gap-1.5">
              {profile.indications.map((ind, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-normal">{ind}</Badge>
              ))}
            </div>
          </Section>

          {/* 제형 */}
          {profile.dosageForms?.length > 0 && (
            <Section icon={<Pill className="w-3.5 h-3.5 text-primary" />} title="제형">
              <div className="flex flex-wrap gap-1.5">
                {profile.dosageForms.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">{f}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* 부작용 */}
          {profile.sideEffects?.length > 0 && (
            <Section icon={<AlertTriangle className="w-3.5 h-3.5 text-destructive" />} title="주요 부작용">
              <div className="flex flex-wrap gap-1.5">
                {profile.sideEffects.map((s, i) => (
                  <span key={i} className="text-[10px] text-muted-foreground bg-destructive/5 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </Section>
          )}

          {/* 오리지네이터 */}
          {profile.originatorCompany && (
            <Section icon={<Building2 className="w-3.5 h-3.5 text-primary" />} title="오리지네이터">
              <p className="text-[11px] text-foreground font-medium">{profile.originatorCompany}</p>
              {profile.originatorBrand && (
                <p className="text-[10px] text-muted-foreground">브랜드: {profile.originatorBrand}</p>
              )}
              {profile.patentStatus && (
                <p className="text-[10px] text-muted-foreground mt-1">{profile.patentStatus}</p>
              )}
            </Section>
          )}

          {/* 시장 동향 */}
          {profile.marketTrend && (
            <Section icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />} title="시장 동향">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{profile.marketTrend}</p>
            </Section>
          )}

          {/* 관련 API */}
          {profile.relatedApis?.length > 0 && (
            <Section icon={<Link2 className="w-3.5 h-3.5 text-primary" />} title="관련/경쟁 API">
              <div className="flex flex-wrap gap-1.5">
                {profile.relatedApis.map((api, i) => (
                  <button
                    key={i}
                    onClick={() => onRelatedClick?.(api)}
                    className="text-[10px] text-primary bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    {api}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="px-4 py-3 space-y-1.5">
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] font-semibold text-foreground">{title}</span>
    </div>
    {children}
  </div>
);
