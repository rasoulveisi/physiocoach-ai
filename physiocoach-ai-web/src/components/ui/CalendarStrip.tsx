import { clsx } from 'clsx';

export interface CalendarDay {
  date: Date;
  dayOfWeek: string;
  dayOfMonth: number;
  isToday?: boolean;
  isActive?: boolean;
}

export interface CalendarStripProps {
  days: CalendarDay[];
  onDaySelect?: (day: CalendarDay) => void;
  className?: string;
}

export const CalendarStrip = ({ days, onDaySelect, className }: CalendarStripProps) => {
  return (
    <div className={clsx('flex gap-2 overflow-x-auto pb-1', className)}>
      {days.map((day, index) => {
        const isActive = day.isActive ?? day.isToday;
        
        return (
          <button
            key={index}
            onClick={() => onDaySelect?.(day)}
            className={clsx(
              'flex-shrink-0 flex flex-col items-center justify-center min-w-[52px] h-[68px] rounded-2xl transition-all duration-200 select-none',
              isActive
                ? 'bg-lime-400 text-zinc-950 font-black shadow-sm scale-105'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 font-bold border border-zinc-800',
              'active:scale-95'
            )}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold mb-1">
              {day.dayOfWeek}
            </span>
            <span className={clsx('text-2xl tabular-nums', isActive ? 'font-black' : 'font-bold')}>
              {day.dayOfMonth}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// Helper function to generate days for the strip
export const generateCalendarDays = (centerDate: Date = new Date(), count: number = 7): CalendarDay[] => {
  const days: CalendarDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOffset = Math.floor((count - 1) / 2);
  
  for (let i = 0; i < count; i++) {
    const date = new Date(centerDate);
    date.setDate(date.getDate() - startOffset + i);
    date.setHours(0, 0, 0, 0);
    
    const isToday = date.getTime() === today.getTime();
    
    days.push({
      date,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      dayOfMonth: date.getDate(),
      isToday,
      isActive: isToday,
    });
  }
  
  return days;
};
