import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Building2, Pill, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

type ProductRow = {
  productName: string;
  seller: string;
  manufacturer: string;
  price: number;
  domesticForeign: string;
  ingredient: string;
  prescriptionAmount: number;
  totalPrescriptions: number;
  apiUsage: number;
  dosage: number;
  unit: string;
};

export const ExcelUploadPanel = () => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [ingredientName, setIngredientName] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const wb = XLSX.read(data, { type: "array" });
      // Try the first sheet (result sheet)
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

      // Find ingredient name from first few rows
      let ingredient = "";
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (row) {
          for (const cell of row) {
            if (cell && typeof cell === "string" && cell.length > 1 && !cell.includes("입력") && !cell.includes("영문")) {
              // This might be the ingredient name or use E column
              break;
            }
          }
        }
      }

      // Find header row (contains "제품명")
      let headerIdx = -1;
      for (let i = 0; i < Math.min(15, jsonData.length); i++) {
        const row = jsonData[i];
        if (row && row.some((c: any) => typeof c === "string" && c.includes("제품명"))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        alert("엑셀에서 '제품명' 헤더를 찾을 수 없습니다.");
        return;
      }

      const headers = jsonData[headerIdx] as string[];
      const colMap: Record<string, number> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        const ht = String(h).trim();
        if (ht.includes("제품명")) colMap.productName = idx;
        if (ht.includes("판매사")) colMap.seller = idx;
        if (ht.includes("제조원")) colMap.manufacturer = idx;
        if (ht.includes("약가")) colMap.price = idx;
        if (ht.includes("국내") || ht.includes("외자")) colMap.domesticForeign = idx;
        if (ht === "성분" || ht.includes("성분")) colMap.ingredient = idx;
        if (ht.includes("처방조제액")) colMap.prescriptionAmount = idx;
        if (ht.includes("총 처방량") || ht.includes("총처방량")) colMap.totalPrescriptions = idx;
        if (ht.includes("원료사용량")) colMap.apiUsage = idx;
        if (ht === "용량" || ht.includes("용량")) colMap.dosage = idx;
        if (ht === "단위" || ht.includes("단위")) colMap.unit = idx;
      });

      const rows: ProductRow[] = [];
      for (let i = headerIdx + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || !row[colMap.productName]) continue;

        const ingredientVal = row[colMap.ingredient] ? String(row[colMap.ingredient]).trim() : "";
        if (!ingredient && ingredientVal) ingredient = ingredientVal;

        rows.push({
          productName: String(row[colMap.productName] || ""),
          seller: String(row[colMap.seller] || ""),
          manufacturer: String(row[colMap.manufacturer] || ""),
          price: Number(row[colMap.price] || 0),
          domesticForeign: String(row[colMap.domesticForeign] || ""),
          ingredient: ingredientVal,
          prescriptionAmount: Number(row[colMap.prescriptionAmount] || 0),
          totalPrescriptions: Number(row[colMap.totalPrescriptions] || 0),
          apiUsage: Number(row[colMap.apiUsage] || 0),
          dosage: Number(row[colMap.dosage] || 0),
          unit: String(row[colMap.unit] || ""),
        });
      }

      setIngredientName(ingredient);
      setProducts(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const clearData = () => {
    setProducts([]);
    setIngredientName("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatKRW = (v: number) => {
    if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
    if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
    return v.toLocaleString();
  };

  const totalPrescriptionAmount = products.reduce((s, p) => s + p.prescriptionAmount, 0);
  const totalApiUsage = products.reduce((s, p) => s + p.apiUsage, 0);

  // Group by manufacturer
  const mfrMap = new Map<string, number>();
  products.forEach((p) => {
    mfrMap.set(p.manufacturer, (mfrMap.get(p.manufacturer) || 0) + p.prescriptionAmount);
  });
  const topMfrs = [...mfrMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (products.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">처방 데이터 엑셀 파일을 업로드하면 제품별 처방 현황을 분석합니다</p>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            엑셀 파일 업로드 (.xlsx, .xlsm)
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              {ingredientName || "업로드 데이터"}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {products.length}개 제품
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{fileName}</span>
            <button onClick={clearData} className="p-1 hover:bg-muted rounded transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border divide-x divide-border">
        <div className="px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">총 처방조제액</p>
          <p className="text-sm font-bold text-foreground">{formatKRW(totalPrescriptionAmount)}원</p>
        </div>
        <div className="px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">총 원료사용량</p>
          <p className="text-sm font-bold text-foreground">{totalApiUsage.toFixed(1)} kg</p>
        </div>
        <div className="px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">제품 수</p>
          <p className="text-sm font-bold text-foreground">{products.length}개</p>
        </div>
        <div className="px-4 py-2.5 text-center">
          <p className="text-[10px] text-muted-foreground">제조원 수</p>
          <p className="text-sm font-bold text-foreground">{mfrMap.size}개사</p>
        </div>
      </div>

      {/* Top Manufacturers */}
      {topMfrs.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 제조원별 처방액 TOP 5
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topMfrs.map(([name, amount]) => (
              <Badge key={name} variant="outline" className="text-[9px] font-normal">
                <Building2 className="w-2.5 h-2.5 mr-0.5" />
                {name} ({formatKRW(amount)}원)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">제품명</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">판매사</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">제조원</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">약가(원)</th>
              <th className="px-3 py-2 text-center font-semibold text-foreground whitespace-nowrap">국내/외자</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">처방조제액</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">총 처방량</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">원료사용량(kg)</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">용량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Pill className="w-3 h-3 text-primary shrink-0" />
                    {p.productName}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.seller}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.manufacturer}</td>
                <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{p.price.toLocaleString()}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <Badge variant={p.domesticForeign === "외자" ? "destructive" : "secondary"} className="text-[9px]">
                    {p.domesticForeign}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{formatKRW(p.prescriptionAmount)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{p.totalPrescriptions.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{p.apiUsage.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{p.dosage}{p.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Re-upload */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex justify-end">
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer">
          <Upload className="w-3 h-3" />
          다른 파일 업로드
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      </div>
    </div>
  );
};
