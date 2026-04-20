import React, { useState, useMemo } from 'react';
import { Search, Plus, User, Clock, AlertTriangle } from 'lucide-react';
import { Employee, OTRecord, LIMITS } from '../types';
import { MOCK_EMPLOYEES } from '../constants';
import { cn } from '../lib/utils';
import { format, startOfWeek, startOfMonth, startOfYear, isWithinInterval, parseISO } from 'date-fns';

interface RegistrationProps {
  onAddRecord: (record: Omit<OTRecord, 'id' | 'createdAt'>) => void;
  records: OTRecord[];
}

export default function Registration({ onAddRecord, records }: RegistrationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [hours, setHours] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return MOCK_EMPLOYEES.filter(emp => 
      emp.name.toLowerCase().includes(term) || 
      emp.employeeCode.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const stats = useMemo(() => {
    if (!selectedEmployee) return null;
    
    const empRecords = records.filter(r => r.employeeId === selectedEmployee.id);
    const now = new Date();
    
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    const weekHours = empRecords
      .filter(r => isWithinInterval(parseISO(r.date), { start: weekStart, end: now }))
      .reduce((sum, r) => sum + r.hours, 0);

    const monthHours = empRecords
      .filter(r => isWithinInterval(parseISO(r.date), { start: monthStart, end: now }))
      .reduce((sum, r) => sum + r.hours, 0);

    const yearHours = empRecords
      .filter(r => isWithinInterval(parseISO(r.date), { start: yearStart, end: now }))
      .reduce((sum, r) => sum + r.hours, 0);

    return { weekHours, monthHours, yearHours };
  }, [selectedEmployee, records]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !hours || !date) return;

    onAddRecord({
      employeeId: selectedEmployee.id,
      date,
      hours: parseFloat(hours),
      reason
    });

    setHours('');
    setReason('');
    // Optionally keep employee selected or clear
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Tìm kiếm nhân viên</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
            placeholder="Nhập tên hoặc mã nhân viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {searchTerm && filteredEmployees.length > 0 && !selectedEmployee && (
          <div className="mt-2 border border-slate-200 bg-white rounded-lg overflow-hidden shadow-lg divide-y divide-slate-100 z-10 relative">
            {filteredEmployees.map(emp => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployee(emp);
                  setSearchTerm('');
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-slate-800">{emp.name}</div>
                  <div className="text-xs text-slate-500">{emp.employeeCode} - {emp.department}</div>
                </div>
                <Plus className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-start">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin đăng ký</h2>
              <button 
                onClick={() => setSelectedEmployee(null)}
                className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
              >
                Hủy chọn
              </button>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center">
                <User className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-lg">{selectedEmployee.name}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{selectedEmployee.employeeCode} • {selectedEmployee.department}</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Ngày tăng ca</label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Số giờ (h)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  min="0.5"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="2.0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Lý do / Ghi chú</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-24 resize-none"
                  placeholder="Hỗ trợ dự án X, hoàn thành báo cáo..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Xác nhận đăng ký
                </button>
              </div>
            </form>
          </div>

          <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-xl shadow-indigo-900/20 space-y-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-6">Thống kê hiện tại</h2>
              
              <div className="space-y-6">
                <StatCard 
                  label="Tuần này" 
                  value={stats?.weekHours || 0} 
                  limit={LIMITS.week} 
                  unit="h"
                />
                <StatCard 
                  label="Tháng này" 
                  value={stats?.monthHours || 0} 
                  limit={LIMITS.month} 
                  unit="h"
                />
                <StatCard 
                  label="Năm nay" 
                  value={stats?.yearHours || 0} 
                  limit={LIMITS.year} 
                  unit="h"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-indigo-800">
              <div className="flex items-center gap-2 text-indigo-300 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Quy định tối đa</span>
              </div>
              <p className="text-[10px] leading-relaxed text-indigo-400 font-medium">
                Ngưỡng quy định nghiêm ngặt: <br />
                <span className="text-white">12h/tuần • 40h/tháng • 300h/năm</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, limit, unit }: { label: string; value: number; limit: number; unit: string }) {
  const percentage = Math.min((value / limit) * 100, 100);
  const isNearLimit = value >= limit * 0.8;
  const isExceeded = value > limit;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-medium text-indigo-200">{label}</span>
        <div className="font-bold text-xl">
          <span className={cn(
            isExceeded ? "text-red-400" : isNearLimit ? "text-orange-400" : "text-white"
          )}>
            {value}
          </span>
          <span className="text-xs text-indigo-400 ml-1 font-medium italic">/ {limit}{unit}</span>
        </div>
      </div>
      <div className="h-1.5 bg-indigo-950 w-full rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-1000 ease-out",
            isExceeded ? "bg-red-500" : isNearLimit ? "bg-orange-500" : "bg-indigo-400"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
