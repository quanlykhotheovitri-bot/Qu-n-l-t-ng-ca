import React, { useMemo } from 'react';
import { AlertCircle, User, Activity } from 'lucide-react';
import { OTRecord, Employee, LIMITS } from '../types';
import { cn } from '../lib/utils';
import { startOfWeek, startOfYear, isWithinInterval, parseISO } from 'date-fns';
import { getCycleIntervalForDate } from '../lib/dateUtils';

interface AlertListProps {
  records: OTRecord[];
  employees: Employee[];
}

interface AlertEntry {
  employee: Partial<Employee>;
  weekHours: number;
  monthHours: number;
  yearHours: number;
  isWeekWarning: boolean;
  isMonthWarning: boolean;
  isYearWarning: boolean;
  isWeekExceeded: boolean;
  isMonthExceeded: boolean;
  isYearExceeded: boolean;
}

export default function AlertList({ records, employees }: AlertListProps) {
  const alerts = useMemo(() => {
    const list: AlertEntry[] = [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const cycleInterval = getCycleIntervalForDate(now);
    const yearStart = startOfYear(now);

    // Get all unique employee IDs from both active list and historical records
    const allEmployeeIds = new Set([
      ...employees.map(e => e.id),
      ...records.map(r => r.employeeId)
    ]);

    allEmployeeIds.forEach(empId => {
      const empRecords = records.filter(r => r.employeeId === empId);
      
      // Try to get employee info from active list, fallback to latest record snapshot
      const activeEmp = employees.find(e => e.id === empId);
      const latestRecord = empRecords.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];
      
      const empInfo: Partial<Employee> = activeEmp || {
        id: empId,
        name: latestRecord?.employeeName,
        employeeCode: latestRecord?.employeeCode,
        department: latestRecord?.department,
        jobTitle: latestRecord?.jobTitle
      };

      if (empRecords.length === 0) return; // Skip if no history for this ID

      const weekHours = empRecords
        .filter(r => isWithinInterval(parseISO(r.date), { start: weekStart, end: now }))
        .reduce((sum, r) => sum + r.hours, 0);

      const monthHours = empRecords
        .filter(r => isWithinInterval(parseISO(r.date), cycleInterval))
        .reduce((sum, r) => sum + r.hours, 0);

      const yearHours = empRecords
        .filter(r => isWithinInterval(parseISO(r.date), { start: yearStart, end: now }))
        .reduce((sum, r) => sum + r.hours, 0);

      const isWeekExceeded = weekHours >= LIMITS.week;
      const isMonthExceeded = monthHours >= LIMITS.month;
      const isYearExceeded = yearHours >= LIMITS.year;

      const isWeekWarning = !isWeekExceeded && weekHours >= LIMITS.week * 0.8;
      const isMonthWarning = !isMonthExceeded && monthHours >= LIMITS.month * 0.8;
      const isYearWarning = !isYearExceeded && yearHours >= LIMITS.year * 0.8;

      if (isWeekWarning || isMonthWarning || isYearWarning || isWeekExceeded || isMonthExceeded || isYearExceeded) {
        list.push({
          employee: empInfo,
          weekHours,
          monthHours,
          yearHours,
          isWeekWarning,
          isMonthWarning,
          isYearWarning,
          isWeekExceeded,
          isMonthExceeded,
          isYearExceeded,
        });
      }
    });

    return list.sort((a, b) => {
      // Sort by severity
      const getSeverity = (e: AlertEntry) => {
        let score = 0;
        if (e.isYearExceeded) score += 100;
        if (e.isMonthExceeded) score += 50;
        if (e.isWeekExceeded) score += 20;
        if (e.isYearWarning) score += 10;
        if (e.isMonthWarning) score += 5;
        if (e.isWeekWarning) score += 2;
        return score;
      };
      return getSeverity(b) - getSeverity(a);
    });
  }, [records]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="bg-red-50 border border-red-100 rounded-xl p-4 lg:p-6 flex flex-col lg:flex-row lg:justify-between lg:items-center shadow-sm gap-4">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 flex-shrink-0">
            <AlertCircle className="w-5 lg:w-6 h-5 lg:h-6" />
          </div>
          <div>
            <h3 className="font-bold text-red-700 text-xs lg:text-sm flex items-center gap-2 uppercase tracking-wide">
              Cảnh báo vượt ngưỡng
            </h3>
            <p className="text-red-500 text-[9px] lg:text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-80">
              Ngưỡng quy định: 12h/W • 40h/M • 300h/Y
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6 pb-12">
        {alerts.length > 0 ? alerts.map((alert) => (
          <div 
            key={alert.employee.id} 
            className={cn(
              "bg-white border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md",
              (alert.isWeekExceeded || alert.isMonthExceeded || alert.isYearExceeded) ? "border-red-200" : "border-slate-200"
            )}
          >
            <div className="p-4 lg:p-5 flex gap-3 lg:gap-4 border-b border-slate-100 bg-slate-50/30">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center text-slate-400 flex-shrink-0">
                <User className="w-5 lg:w-6 h-5 lg:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-slate-800 text-sm lg:text-lg leading-tight uppercase truncate">
                    {alert.employee.name}
                  </div>
                  <span className="bg-slate-800 text-white text-[8px] lg:text-[10px] px-1.5 py-0.5 rounded font-bold font-mono tracking-tighter whitespace-nowrap">
                    {alert.employee.employeeCode}
                  </span>
                </div>
                <div className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                  {alert.employee.department}
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-5 grid grid-cols-3 gap-2 lg:gap-4">
              <AlertStatBox 
                label="Tuần" 
                value={alert.weekHours} 
                limit={LIMITS.week} 
                isExceeded={alert.isWeekExceeded} 
                isWarning={alert.isWeekWarning} 
              />
              <AlertStatBox 
                label="Tháng" 
                value={alert.monthHours} 
                limit={LIMITS.month} 
                isExceeded={alert.isMonthExceeded} 
                isWarning={alert.isMonthWarning} 
              />
              <AlertStatBox 
                label="Năm" 
                value={alert.yearHours} 
                limit={LIMITS.year} 
                isExceeded={alert.isYearExceeded} 
                isWarning={alert.isYearWarning} 
              />
            </div>

            <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Activity className="w-3 h-3 text-slate-400" />
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phân tích rủi ro hệ thống</span>
               </div>
               {(alert.isWeekExceeded || alert.isMonthExceeded || alert.isYearExceeded) && (
                 <span className="text-[9px] font-black text-red-500 uppercase tracking-widest animate-pulse">Critical Alert</span>
               )}
            </div>
          </div>
        )) : (
          <div className="col-span-full py-24 text-center bg-white border border-dashed border-slate-200 rounded-xl shadow-sm">
             <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-200" />
             <p className="font-bold text-slate-300 uppercase tracking-widest text-sm">Hiện tại không có nhân viên nào trong danh sách cảnh báo</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertStatBox({ label, value, limit, isExceeded, isWarning }: { 
  label: string; 
  value: number; 
  limit: number; 
  isExceeded: boolean; 
  isWarning: boolean;
}) {
  return (
    <div className={cn(
      "p-2 lg:p-3 rounded-lg flex flex-col items-center justify-center transition-all border",
      isExceeded 
        ? "bg-red-600 text-white border-red-700 shadow-lg shadow-red-200" 
        : isWarning 
          ? "bg-orange-100 text-orange-700 border-orange-200" 
          : "bg-slate-50 text-slate-400 border-slate-100"
    )}>
      <span className={cn("text-[8px] lg:text-[9px] font-black uppercase mb-1 opacity-70")}>{label}</span>
      <div className="font-black text-sm lg:text-xl leading-none">{value}h</div>
      <div className={cn(
        "text-[7px] lg:text-[8px] mt-1.5 lg:mt-2 font-bold uppercase tracking-tighter opacity-70",
        isExceeded ? "text-white" : ""
      )}>
        Limit: {limit}h
      </div>
    </div>
  );
}
