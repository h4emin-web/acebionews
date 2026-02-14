import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  currentMonth: Date;
  onChange: (d: Date) => void;
};

const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export const MonthSelector = ({ currentMonth, onChange }: Props) => {
  const prev = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    onChange(d);
  };
  const next = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    const now = new Date();
    if (d <= now) onChange(d);
  };

  const isCurrentMonth =
    currentMonth.getFullYear() === new Date().getFullYear() &&
    currentMonth.getMonth() === new Date().getMonth();

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
        {currentMonth.getFullYear()}년 {monthNames[currentMonth.getMonth()]}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
