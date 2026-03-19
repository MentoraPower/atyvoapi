import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScheduleCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const ScheduleCalendar = ({ selectedDate, onSelectDate }: ScheduleCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const tomorrow = addDays(startOfDay(new Date()), 1);

  return (
    <div className="glass-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((wd) => (
          <div key={wd} className="text-center text-xs font-medium text-muted-foreground py-2">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, currentMonth);
          const selected = selectedDate && isSameDay(d, selectedDate);
          const past = isBefore(d, tomorrow);
          const todayDate = isToday(d);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <button
              key={i}
              disabled={past || !inMonth || isWeekend}
              onClick={() => onSelectDate(d)}
              className={`
                relative h-10 sm:h-12 rounded-xl text-sm font-medium transition-all duration-200
                ${!inMonth ? "text-muted-foreground/30 cursor-default" : ""}
                ${inMonth && (past || isWeekend) ? "text-muted-foreground/40 cursor-not-allowed" : ""}
                ${inMonth && !past && !isWeekend && !selected ? "text-foreground hover:bg-foreground/5 active:bg-foreground/10 cursor-pointer" : ""}
                ${selected ? "bg-[#00000013] text-foreground font-semibold rounded-xl" : ""}
                ${todayDate && !selected ? "bg-foreground/10 rounded-xl" : ""}
              `}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleCalendar;
