import React, { useState, useMemo } from 'react';
import { Download, Filter, Calendar, List } from 'lucide-react';
import { OTRecord, Employee } from '../types';
import { MOCK_EMPLOYEES } from '../constants';
import { cn } from '../lib/utils';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import * as XLSX from 'xlsx';

interface OTListProps {
  records: OTRecord[];
}

type Period = 'day' | 'week' | 'month' | 'year';

export default function OTList({ records }: OTListProps) {
  const [period, setPeriod] = useState<Period>('day');
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const filteredRecords = useMemo(() => {
    const target = parseISO(targetDate);
    return records.filter(record => {
      const recordDate = parseISO(record.date);
      switch (period) {
        case 'day': return isSameDay(recordDate, target);
        case 'week': return isSameWeek(recordDate, target, { weekStartsOn: 1 });
        case 'month': return isSameMonth(recordDate, target);
        case 'year': return isSameYear(recordDate, target);
        default: return true;
      }
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [records, period, targetDate]);

  const exportExcel = () => {
    const data = filteredRecords.map(r => {
      const emp = MOCK_EMPLOYEES.find(e => e.id === r.employeeId);
      return {
        'Mã Nhân Viên': emp?.employeeCode,
        'Họ Tên': emp?.name,
        'Bộ Phận': emp?.department,
        'Ngày': format(parseISO(r.date), 'dd/MM/yyyy'),
        'Số Giờ': r.hours,
        'Lý Do': r.reason
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Overtime");
    
    const fileName = `OT_Report_${period}_${targetDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chu kỳ báo cáo</label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all capitalize",
                  period === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mốc thời gian</label>
          <input
            type="date"
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <button
          onClick={exportExcel}
          disabled={filteredRecords.length === 0}
          className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-6 py-2 rounded-lg flex items-center gap-2 font-bold text-sm hover:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Download className="w-4 h-4" />
          Xuất Excel (.xlsx)
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30">
          <h3 className="font-bold text-slate-800 text-sm">Danh sách đăng ký gần đây</h3>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">STT</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhân viên</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bộ phận</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Số giờ</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lý do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length > 0 ? filteredRecords.map((r, i) => {
                const emp = MOCK_EMPLOYEES.find(e => e.id === r.employeeId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">#{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 uppercase leading-none mb-1">{emp?.name}</div>
                      <div className="text-[10px] font-semibold text-indigo-500 font-mono tracking-tighter">{emp?.employeeCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{emp?.department}</td>
                    <td className="px-6 py-4 text-slate-600">{format(parseISO(r.date), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm">
                        {r.hours}h
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 italic max-w-xs truncate">{r.reason || 'Không có ghi chú'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 italic">
                    <List className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    Không tìm thấy dữ liệu cho khoảng thời gian này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
