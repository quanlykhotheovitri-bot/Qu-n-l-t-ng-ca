import React, { useState, useMemo, useRef } from 'react';
import { Search, Plus, User, Clock, AlertTriangle, Upload, UserPlus, Trash2, CheckCircle2 } from 'lucide-react';
import { Employee, OTRecord, LIMITS } from '../types';
import { cn } from '../lib/utils';
import { format, startOfWeek, parseISO } from 'date-fns';
import { getCycleIntervalForDate, getCycleYear, getCycleMonth } from '../lib/dateUtils';
import * as XLSX from 'xlsx';

interface RegistrationProps {
  onAddRecord: (record: Omit<OTRecord, 'id' | 'createdAt'>) => void;
  records: OTRecord[];
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

export default function Registration({ onAddRecord, records, employees, setEmployees }: RegistrationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [startTime, setStartTime] = useState<string>('17:00');
  const [endTime, setEndTime] = useState<string>('19:00');
  const [hours, setHours] = useState<string>('2');
  const [reason, setReason] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Employee Management States
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', employeeCode: '', department: '', jobTitle: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(term) || 
      emp.employeeCode.toLowerCase().includes(term)
    );
  }, [searchTerm, employees]);

  const employeeStats = useMemo(() => {
    const now = new Date();
    // Monday as start of week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const cycleInterval = getCycleIntervalForDate(now);
    const currentCycleYear = getCycleYear(now);

    const statsMap: Record<string, { week: number; month: number; year: number }> = {};
    
    // Initialize
    employees.forEach(emp => {
      statsMap[emp.id] = { week: 0, month: 0, year: 0 };
    });

    // One-pass accumulation over records
    records.forEach(r => {
      if (!statsMap[r.employeeId]) return;
      
      try {
        const recordDate = parseISO(r.date);
        
        // Check week (isWithinInterval is inclusive of start/end)
        if (recordDate >= weekStart) {
          statsMap[r.employeeId].week += r.hours;
        }
        // Check month (Cycle: 26th of last month to 25th of current)
        if (recordDate >= cycleInterval.start && recordDate <= cycleInterval.end) {
          statsMap[r.employeeId].month += r.hours;
        }
        // Check year (Cycle Year)
        if (getCycleYear(recordDate) === currentCycleYear) {
          statsMap[r.employeeId].year += r.hours;
        }
      } catch (e) {
        console.error("Invalid date in record", r);
      }
    });

    return statsMap;
  }, [employees, records]);

  const handleDeleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSelectedEmployees(prev => prev.filter(e => e.id !== id));
    setDeletingId(null);
  };

  const calculateHours = (start: string, end: string) => {
    try {
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      
      let diffM = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffM < 0) diffM += 24 * 60;
      
      return (diffM / 60).toFixed(1);
    } catch {
      return "0";
    }
  };

  const handleTimeChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') {
      setStartTime(val);
      setHours(calculateHours(val, endTime));
    } else {
      setEndTime(val);
      setHours(calculateHours(startTime, val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployees.length === 0 || !hours || !date || !startTime || !endTime) return;

    const addedNames: string[] = [];
    const duplicateNames: string[] = [];

    selectedEmployees.forEach(employee => {
      const isDuplicate = records.some(r => r.employeeId === employee.id && r.date === date);
      if (isDuplicate) {
        duplicateNames.push(employee.name);
        return;
      }

      onAddRecord({
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        department: employee.department,
        jobTitle: employee.jobTitle,
        date,
        startTime,
        endTime,
        hours: parseFloat(hours),
        reason
      });
      addedNames.push(employee.name);
    });

    if (duplicateNames.length > 0) {
      alert(`Các nhân viên sau đã có đăng ký ngày ${format(parseISO(date), 'dd/MM/yyyy')}: ${duplicateNames.join(', ')}`);
    }

    if (addedNames.length > 0) {
      setReason('');
      setSelectedEmployees([]);
    }
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name || !newEmp.employeeCode) {
      alert("Vui lòng nhập đầy đủ Tên và Mã nhân viên.");
      return;
    }

    const employee: Employee = {
      id: generateId(),
      ...newEmp
    };

    setEmployees(prev => [employee, ...prev]);
    setNewEmp({ name: '', employeeCode: '', department: '', jobTitle: '' });
    setIsAddingEmployee(false);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header: 1 to get array of arrays for better flexibility
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!jsonData || jsonData.length < 2) {
          alert("File không có dữ liệu hoặc không đúng định dạng. Cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.");
          return;
        }

        // Detect headers by looking for keywords
        const headerRow = jsonData[0].map(h => (h || '').toString().toLowerCase().trim());
        const dataRows = jsonData.slice(1);

        const newEmployees: Employee[] = dataRows.map(row => {
          const emp: any = { id: generateId() };
          headerRow.forEach((header, idx) => {
            const val = row[idx]?.toString().trim();
            if (!val) return;

            if (header.includes('tên') || header.includes('name') || header.includes('họ')) {
              emp.name = val;
            } else if (header.includes('mã') || header.includes('id') || header.includes('mnv') || header.includes('code')) {
              emp.employeeCode = val;
            } else if (header.includes('phận') || header.includes('department') || header.includes('dept')) {
              emp.department = val;
            } else if (header.includes('vụ') || header.includes('title') || header.includes('position')) {
              emp.jobTitle = val;
            }
          });
          return emp as Employee;
        }).filter(emp => emp.name && emp.employeeCode);

        if (newEmployees.length > 0) {
          setEmployees(prev => {
            // Filter out existing employee codes to avoid duplicates
            const existingCodes = new Set(prev.map(e => e.employeeCode));
            const uniqueNew = newEmployees.filter(e => !existingCodes.has(e.employeeCode));
            
            if (uniqueNew.length === 0) {
              alert("Tất cả nhân viên trong file đã tồn tại trong hệ thống.");
              return prev;
            }
            
            alert(`Đã nhập thành công ${uniqueNew.length} nhân viên mới.`);
            return [...uniqueNew, ...prev];
          });
        } else {
          alert("Không tìm thấy dữ liệu nhân viên hợp lệ. Vui lòng kiểm tra lại các cột tiêu đề (Ví dụ: MNV, Họ và Tên, Bộ phận, Chức vụ).");
        }
      } catch (err) {
        console.error("Excel Import Error:", err);
        alert("Có lỗi xảy ra khi đọc file. Vui lòng đảm bảo file đúng định dạng.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="max-w-7xl mx-auto space-y-4 lg:space-y-6">
        {/* Search and Registration Section */}
        <div className="space-y-4 lg:space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Tìm kiếm & Đăng ký</h2>
              {selectedEmployees.length > 0 && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-in fade-in zoom-in-95">
                  <span className="text-[10px] font-black uppercase tracking-widest">Đã chọn: {selectedEmployees.length} NV</span>
                </div>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans h-[42px]"
                placeholder="Nhập tên hoặc mã nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {searchTerm && filteredEmployees.length > 0 && (
              <div className="mt-2 border border-slate-200 bg-white rounded-lg overflow-hidden shadow-lg divide-y divide-slate-100 z-10 relative">
                {filteredEmployees.map(emp => {
                  const isSelected = selectedEmployees.some(selected => selected.id === emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedEmployees(prev => prev.filter(e => e.id !== emp.id));
                        } else {
                          setSelectedEmployees(prev => [...prev, emp]);
                        }
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="font-bold text-slate-800 text-sm truncate uppercase">{emp.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{emp.employeeCode} • {emp.department}</div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedEmployees.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin đăng ký ({selectedEmployees.length} NV)</h2>
                <button 
                  onClick={() => setSelectedEmployees([])}
                  className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 hover:bg-red-50 rounded uppercase tracking-widest"
                >
                  Hủy tất cả
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {selectedEmployees.map(emp => (
                  <div key={emp.id} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 group">
                    <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">{emp.name}</span>
                    <button 
                      onClick={() => setSelectedEmployees(prev => prev.filter(e => e.id !== emp.id))}
                      className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 lg:gap-4">
                <div className="col-span-2 lg:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ngày tăng ca</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-[42px]"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="col-span-2 lg:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Số giờ (h)</label>
                  <input
                    type="number"
                    step="0.5"
                    readOnly
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-indigo-600 h-[42px]"
                    value={hours}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Từ (From)</label>
                  <input
                    type="time"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-[42px]"
                    value={startTime}
                    onChange={(e) => handleTimeChange('start', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Đến (To)</label>
                  <input
                    type="time"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-[42px]"
                    value={endTime}
                    onChange={(e) => handleTimeChange('end', e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Lý do / Ghi chú</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-20 lg:h-24 resize-none"
                    placeholder="Nhập lý do..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10 flex items-center justify-center gap-2 uppercase tracking-wide text-xs h-[48px]"
                  >
                    <Plus className="w-5 h-5" />
                    Đăng ký tăng ca
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* New Section: Employee List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center gap-4">
              <h2 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">Nhân viên</h2>
              <div className="flex gap-2 min-w-0">
                <button 
                  onClick={() => setIsAddingEmployee(!isAddingEmployee)}
                  className={cn(
                    "p-2 rounded-lg transition-all border shadow-sm flex-shrink-0",
                    isAddingEmployee 
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-white text-slate-500 border-slate-200 hover:text-indigo-600 hover:border-indigo-200"
                  )}
                  title="Thêm nhân viên"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white text-slate-500 border border-slate-200 rounded-lg transition-all hover:text-green-600 hover:border-green-200 shadow-sm flex-shrink-0"
                  title="Nhập từ Excel"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportExcel} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold whitespace-nowrap flex items-center">{employees.length} NV</span>
              </div>
            </div>

            {isAddingEmployee && (
              <div className="p-4 bg-slate-50 border-b border-slate-200 animate-in fade-in slide-in-from-top-2">
                <form onSubmit={handleAddEmployee} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Tên nhân viên"
                    className="col-span-2 lg:col-span-1 px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={newEmp.name}
                    onChange={(e) => setNewEmp({...newEmp, name: e.target.value})}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Mã NV"
                    className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={newEmp.employeeCode}
                    onChange={(e) => setNewEmp({...newEmp, employeeCode: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Bộ phận"
                    className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={newEmp.department}
                    onChange={(e) => setNewEmp({...newEmp, department: e.target.value})}
                  />
                  <div className="col-span-2 flex justify-end gap-3 mt-1">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsAddingEmployee(false);
                        setNewEmp({ name: '', employeeCode: '', department: '', jobTitle: '' });
                      }}
                      className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 shadow-sm uppercase tracking-widest"
                    >
                      Lưu
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto selection:bg-indigo-100">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-100 sticky top-0 z-10">
                    <th className="px-4 py-3 border-b border-slate-200 text-center w-12">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees(employees);
                          } else {
                            setSelectedEmployees([]);
                          }
                        }}
                        checked={selectedEmployees.length === employees.length && employees.length > 0}
                      />
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-center w-12 text-[10px] font-bold text-slate-500 uppercase">STT</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">MNV</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">Họ và tên</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">Bộ phận</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center text-[10px] font-bold text-indigo-600 uppercase">Tuần</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center text-[10px] font-bold text-indigo-600 uppercase">Tháng</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center text-[10px] font-bold text-indigo-600 uppercase">Năm</th>
                    <th className="px-4 py-3 border-b border-slate-200 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {employees.map((emp, idx) => {
                    const isSelected = selectedEmployees.some(sel => sel.id === emp.id);
                    return (
                      <tr key={emp.id} className={cn("hover:bg-slate-50 transition-colors group", isSelected && "bg-indigo-50/30")}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setSelectedEmployees(prev => prev.filter(e => e.id !== emp.id));
                              } else {
                                setSelectedEmployees(prev => [...prev, emp]);
                              }
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-[10px] text-slate-300 font-mono italic">#{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-500 italic bg-indigo-50/20">{emp.employeeCode}</td>
                        <td className="px-6 py-3 font-bold text-slate-800 uppercase text-xs tracking-tighter">{emp.name}</td>
                        <td className="px-6 py-3 text-xs text-slate-500 italic">{emp.department}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded",
                            (employeeStats[emp.id]?.week || 0) >= LIMITS.week ? "bg-red-100 text-red-600" : 
                            (employeeStats[emp.id]?.week || 0) >= LIMITS.week * 0.8 ? "bg-orange-100 text-orange-600" : 
                            "bg-slate-100 text-slate-700"
                          )}>
                            {employeeStats[emp.id]?.week || 0}h
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded",
                            (employeeStats[emp.id]?.month || 0) >= LIMITS.month ? "bg-red-100 text-red-600" : 
                            (employeeStats[emp.id]?.month || 0) >= LIMITS.month * 0.8 ? "bg-orange-100 text-orange-600" : 
                            "bg-slate-100 text-slate-700"
                          )}>
                            {employeeStats[emp.id]?.month || 0}h
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded",
                            (employeeStats[emp.id]?.year || 0) >= LIMITS.year ? "bg-red-100 text-red-600" : 
                            (employeeStats[emp.id]?.year || 0) >= LIMITS.year * 0.8 ? "bg-orange-100 text-orange-600" : 
                            "bg-slate-100 text-slate-700"
                          )}>
                            {employeeStats[emp.id]?.year || 0}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {deletingId === emp.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                                <button 
                                  onClick={() => handleDeleteEmployee(emp.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                >
                                  Xóa
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedEmployees(prev => prev.filter(e => e.id !== emp.id));
                                    } else {
                                      setSelectedEmployees(prev => [...prev, emp]);
                                    }
                                  }}
                                  className={cn(
                                    "text-[10px] font-bold py-1 px-3 rounded-lg transition-all uppercase tracking-widest border",
                                    isSelected 
                                      ? "bg-indigo-600 text-white border-indigo-600" 
                                      : "text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                                  )}
                                >
                                  {isSelected ? 'Đã chọn' : 'Chọn'}
                                </button>
                                <button 
                                  onClick={() => setDeletingId(emp.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard() { return null; }
