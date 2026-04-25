import React, { useState, useMemo, useRef } from 'react';
import { Download, Upload, Search, Calendar, User, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { OTRecord, Employee } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryListProps {
  records: OTRecord[];
  employees: Employee[];
  onAddRecords: (records: Omit<OTRecord, 'id' | 'createdAt'>[], newEmployees?: Employee[]) => void;
  onDeleteRecords: (ids: string[]) => void;
  onClearAll: () => void;
}

export default function HistoryList({ records, employees, onAddRecords, onDeleteRecords, onClearAll }: HistoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredHistory = useMemo(() => {
    return records
      .filter(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const searchLower = searchTerm.toLowerCase();
        return (
          emp?.name.toLowerCase().includes(searchLower) ||
          emp?.employeeCode.toLowerCase().includes(searchLower) ||
          emp?.department.toLowerCase().includes(searchLower) ||
          r.employeeName?.toLowerCase().includes(searchLower) ||
          r.employeeCode?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [records, employees, searchTerm]);

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');
    
    worksheet.columns = [
      { header: 'Stt', key: 'stt', width: 10 },
      { header: 'MNV', key: 'mnv', width: 15 },
      { header: 'Họ và tên', key: 'name', width: 25 },
      { header: 'Bộ phận', key: 'dept', width: 20 },
      { header: 'Chức vụ', key: 'job', width: 20 },
      { header: 'Ngày tăng ca', key: 'date', width: 15 },
      { header: 'Số giờ tăng ca', key: 'hours', width: 15 },
    ];

    worksheet.addRow([1, 'NV001', 'Nguyễn Văn A', 'Sản xuất', 'Công nhân', '25/04/2024', 2.5]);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Mau_Danh_Sach_Tang_Ca.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) throw new Error('Không tìm thấy sheet dữ liệu');

      const newRecords: Omit<OTRecord, 'id' | 'createdAt'>[] = [];
      const newEmployeesFound: Employee[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;

        const mnv = row.getCell(2).text?.trim();
        const name = row.getCell(3).text?.trim();
        const dept = row.getCell(4).text?.trim();
        const job = row.getCell(5).text?.trim();
        
        let dateVal = row.getCell(6).value;
        const hours = parseFloat(row.getCell(7).text) || 0;

        if (!mnv || !name) return;

        let dateStr = '';
        if (dateVal instanceof Date) {
          dateStr = format(dateVal, 'yyyy-MM-dd');
        } else if (typeof dateVal === 'string') {
          if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
              const d = parts[0].padStart(2, '0');
              const m = parts[1].padStart(2, '0');
              const y = parts[2];
              dateStr = `${y}-${m}-${d}`;
            }
          } else {
            dateStr = dateVal;
          }
        }

        let employee = employees.find(e => e.employeeCode === mnv) || newEmployeesFound.find(e => e.employeeCode === mnv);
        
        if (!employee) {
          employee = {
            id: Math.random().toString(36).substring(2, 11),
            employeeCode: mnv,
            name: name,
            department: dept || 'Chưa xác định',
            jobTitle: job || ''
          };
          newEmployeesFound.push(employee);
        }

        newRecords.push({
          employeeId: employee.id,
          employeeName: name,
          employeeCode: mnv,
          department: dept || 'N/A',
          jobTitle: job || '',
          date: dateStr || format(new Date(), 'yyyy-MM-dd'),
          startTime: '17:00',
          endTime: '19:00',
          hours: hours,
          reason: 'Imported from Excel',
        });
      });

      if (newRecords.length > 0) {
        onAddRecords(newRecords, newEmployeesFound);
        alert(`Đã tải lên thành công ${newRecords.length} bản ghi${newEmployeesFound.length > 0 ? ` và thêm ${newEmployeesFound.length} nhân viên mới` : ''}!`);
      } else {
        alert('Không tìm thấy dữ liệu hợp lệ trong file. Vui lòng kiểm tra lại định dạng file mẫu.');
      }
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại định dạng.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredHistory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredHistory.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} bản ghi đã chọn?`)) {
      onDeleteRecords(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử tăng ca không? Hành động này không thể hoàn tác.")) {
      onClearAll();
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, mã NV, bộ phận..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition-all"
            >
              <AlertCircle className="w-4 h-4" />
              Xóa tất cả
            </button>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Tải file mẫu
            </button>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? 'Đang tải...' : 'Tải lên Excel'}
            </button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between px-6 py-3 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-indigo-700">
                Đang chọn: {selectedIds.length} bản ghi
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
              >
                Bỏ chọn
              </button>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Xóa mục đã chọn
            </button>
          </motion.div>
        )}
      </div>

      {/* Main History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-4 py-4 text-xs font-bold text-slate-800 border-r border-slate-200 text-center w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={filteredHistory.length > 0 && selectedIds.length === filteredHistory.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 border-r border-slate-200 text-center w-16">
                  <div>Stt</div>
                  <div className="text-indigo-400 font-medium">No</div>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 border-r border-slate-200 text-center w-28">
                  <div>MNV</div>
                  <div className="text-indigo-400 font-medium">ID</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-800 border-r border-slate-200">
                  <div>Họ và tên</div>
                  <div className="text-indigo-400 font-medium">Full Name</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-800 border-r border-slate-200">
                  <div>Bộ phận</div>
                  <div className="text-indigo-400 font-medium">Department</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-800 border-r border-slate-200">
                  <div>Chức vụ</div>
                  <div className="text-indigo-400 font-medium">Job Title</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-800 border-r border-slate-200 text-center">
                  <div>Ngày tăng ca</div>
                  <div className="text-indigo-400 font-medium">Date</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-800 text-center">
                  <div>Số giờ tăng ca</div>
                  <div className="text-indigo-400 font-medium">Hour OT</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((r, i) => {
                  const emp = employees.find(e => e.id === r.employeeId) || {
                    name: r.employeeName,
                    employeeCode: r.employeeCode,
                    department: r.department,
                    jobTitle: r.jobTitle
                  };
                  return (
                    <tr key={r.id} className={cn(
                      "hover:bg-slate-50 transition-colors",
                      selectedIds.includes(r.id) && "bg-indigo-50/30"
                    )}>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-medium border-r border-slate-100 italic">{i + 1}</td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          {emp?.employeeCode}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-700 border-r border-slate-100 uppercase text-xs">{emp?.name}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 border-r border-slate-100 font-medium">{emp?.department}</td>
                      <td className="px-6 py-3 text-xs text-slate-500 border-r border-slate-100 italic">{emp?.jobTitle || 'N/A'}</td>
                      <td className="px-6 py-3 text-center text-slate-600 border-r border-slate-100 text-xs">
                        {format(parseISO(r.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-slate-800 font-bold text-sm border-2 border-slate-100">
                          {r.hours}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-300">
                    <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium italic">Không có lịch sử tăng ca nào được tìm thấy</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng cộng bản ghi</p>
          <div className="text-3xl font-black text-slate-800">{filteredHistory.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng giờ tăng ca</p>
          <div className="text-3xl font-black text-indigo-600">
            {filteredHistory.reduce((acc, curr) => acc + curr.hours, 0).toFixed(1)}h
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-400">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Lưu ý nhập liệu</p>
          <div className="text-xs text-slate-500 leading-relaxed italic">
            File Excel cần có các cột theo thứ tự: Stt, MNV, Họ tên, Bộ phận, Chức vụ, Ngày, Số giờ.
          </div>
        </div>
      </div>
    </div>
  );
}
