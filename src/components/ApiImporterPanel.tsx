import { NcePatentSection } from "@/components/NcePatentSection";
import { PatentExpirySection } from "@/components/PatentExpirySection";
import { FdaClinicalSection } from "@/components/FdaClinicalSection";
import { MfdsRecallSection } from "@/components/MfdsRecallSection";
import { IndApprovalSection } from "@/components/IndApprovalSection";

type Props = {
  onKeywordClick: (kw: string) => void;
};

export const ApiImporterPanel = ({ onKeywordClick }: Props) => {
  return (
    <div className="space-y-4 sticky top-[100px]" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
      <PatentExpirySection onKeywordClick={onKeywordClick} />
      <NcePatentSection onKeywordClick={onKeywordClick} />
      <FdaClinicalSection onKeywordClick={onKeywordClick} />
      <IndApprovalSection />
      <MfdsRecallSection />
    </div>
  );
};
