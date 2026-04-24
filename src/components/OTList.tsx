import React, { useState, useMemo } from 'react';
import { Download, Filter, Calendar, List, Edit2, Trash2, Save, X } from 'lucide-react';
import { OTRecord, Employee } from '../types';
import { MOCK_EMPLOYEES } from '../constants';
import { cn } from '../lib/utils';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface OTListProps {
  records: OTRecord[];
  employees: Employee[];
  onUpdateRecord: (id: string, updatedFields: Partial<OTRecord>) => void;
  onDeleteRecord: (id: string) => void;
}

type Period = 'day' | 'week' | 'month' | 'year';

export default function OTList({ records, employees, onUpdateRecord, onDeleteRecord }: OTListProps) {
  const [period, setPeriod] = useState<Period>('day');
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<OTRecord>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleEditStart = (record: OTRecord) => {
    setEditingId(record.id);
    setEditValues(record);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const calculateHours = (start: string, end: string) => {
    try {
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      let diffM = (endH * 60 + endM) - (startH * 60 + startM);
      if (diffM < 0) diffM += 24 * 60;
      return parseFloat((diffM / 60).toFixed(1));
    } catch { return 0; }
  };

  const handleEditChange = (field: keyof OTRecord, value: any) => {
    setEditValues(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'startTime' || field === 'endTime') {
        const h = calculateHours(updated.startTime || '00:00', updated.endTime || '00:00');
        updated.hours = h;
      }
      return updated;
    });
  };

  const handleEditSave = () => {
    if (editingId && editValues) {
      onUpdateRecord(editingId, editValues);
      setEditingId(null);
      setEditValues({});
    }
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    // ... existing export code ...
    const worksheet = workbook.addWorksheet('BM tăng ca tự nguyện');

    const target = parseISO(targetDate);
    const dayStr = format(target, 'dd');
    const monthStr = format(target, 'MM');
    const yearStr = format(target, 'yyyy');

    // Define column widths - matching the visual proportions
    worksheet.columns = [
      { key: 'stt', width: 4.5 },   // A
      { key: 'mnv', width: 10 },    // B
      { key: 'name', width: 33 },   // C
      { key: 'dept', width: 15 },   // D
      { key: 'job', width: 15 },    // E
      { key: 'from', width: 9 },    // F
      { key: 'to', width: 9 },      // G
      { key: 'sign', width: 16 },   // H
      { key: 'note', width: 22 },   // I
    ];

    // Row 1: Company Name & Form Code
    const row1 = worksheet.getRow(1);
    row1.getCell(1).value = 'Công ty TNHH OrthoLite VN';
    row1.getCell(1).font = { bold: true, name: 'Times New Roman', size: 11 };
    
    row1.getCell(9).value = 'HR.F-01/P-12';
    row1.getCell(9).alignment = { horizontal: 'right' };
    row1.getCell(9).font = { name: 'Times New Roman', size: 11 };

    // Row 3: Main Title
    worksheet.mergeCells('A3:I3');
    const titleCell = worksheet.getCell('A3');
    titleCell.value = 'GIẤY ĐỀ NGHỊ TĂNG CA TỰ NGUYỆN';
    titleCell.font = { bold: true, size: 14, name: 'Times New Roman', color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: English Subtitle
    worksheet.mergeCells('A4:I4');
    const subtitleCell = worksheet.getCell('A4');
    subtitleCell.value = 'Voluntary Overtime Request Form';
    subtitleCell.font = { bold: true, size: 12, name: 'Times New Roman', color: { argb: 'FF00B0F0' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 6: Report Date line (Right aligned under title area)
    worksheet.mergeCells('E6:I6');
    const dateLineCell = worksheet.getCell('E6');
    dateLineCell.value = {
      richText: [
        { text: '........., Ngày/ ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Day ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: dayStr, font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: ' Tháng/ ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Month ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: monthStr, font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: ' Năm/ ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Year ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: yearStr, font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: ' ......', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } }
      ]
    };
    dateLineCell.alignment = { horizontal: 'right' };

    // Row 8: Kính gửi (To)
    const row8 = worksheet.getRow(8);
    row8.getCell(1).value = {
      richText: [
        { text: 'Kính gửi:/ ', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'To:', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } }
      ]
    };
    
    // Row 9: BD line
    worksheet.mergeCells('B9:I9');
    const row9 = worksheet.getRow(9);
    row9.getCell(2).value = {
      richText: [
        { text: '- Ban Giám đốc Công ty/ ', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Company Board of Directors;', font: { name: 'Times New Roman', color: { argb: 'FF00B0F0' } } }
      ]
    };
    
    // Row 10: HR Dept
    worksheet.mergeCells('B10:I10');
    const row10 = worksheet.getRow(10);
    row10.getCell(2).value = {
      richText: [
        { text: '- Phòng Hành chính Nhân sự/ ', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'HR & Administration Department.', font: { name: 'Times New Roman', color: { argb: 'FF00B0F0' } } }
      ]
    };

    // Row 11: Ngày tăng ca (Overtime Date)
    const row11 = worksheet.getRow(11);
    row11.getCell(1).value = {
      richText: [
        { text: 'Ngày tăng ca/ ', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Overtime Date', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: ' : ', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Ngày/ ', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Day ', font: { name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: `${dayStr} `, font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Tháng/ ', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Month ', font: { name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: `${monthStr} `, font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Năm/ ', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Year ', font: { name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: `${yearStr}`, font: { name: 'Times New Roman', color: { argb: 'FF000000' } } }
      ]
    };

    // Row 12: Lý do (Reason)
    const row12 = worksheet.getRow(12);
    row12.getCell(1).value = {
      richText: [
        { text: 'Lý do tăng ca/ ', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Overtime reason', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } },
        { text: ' : ', font: { bold: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: filteredRecords[0]?.reason || '................................................................................', font: { name: 'Times New Roman', color: { argb: 'FF000000' } } }
      ]
    };

    // Row 14: Approval statement
    worksheet.mergeCells('A14:I14');
    const approvalCell = worksheet.getCell('A14');
    approvalCell.value = {
      richText: [
        { text: 'Đề nghị Công ty chấp thuận cho chúng tôi được tăng ca: / ', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF000000' } } },
        { text: 'Request for Company approval to work overtime:', font: { italic: true, name: 'Times New Roman', color: { argb: 'FF00B0F0' } } }
      ]
    };

    // Table Header Rows (15 & 16)
    const headerRow1 = worksheet.getRow(15);
    const headerRow2 = worksheet.getRow(16);
    headerRow1.height = 30;
    headerRow2.height = 20;
    
    // Borders and Alignment function
    const applyTableStyle = (cell: any) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    };

    // Merge for Headers
    [1, 2, 3, 4, 5, 8, 9].forEach(col => {
      worksheet.mergeCells(15, col, 16, col);
      applyTableStyle(worksheet.getCell(15, col));
    });
    worksheet.mergeCells(15, 6, 15, 7);
    applyTableStyle(worksheet.getCell(15, 6));

    // Labels
    const setLabel = (cell: any, vn: string, en: string) => {
      cell.value = {
        richText: [
          { text: vn + '\n', font: { bold: true, name: 'Times New Roman', size: 9, color: { argb: 'FF000000' } } },
          { text: en, font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF00B0F0' } } }
        ]
      };
    };

    setLabel(headerRow1.getCell(1), 'Stt', 'No');
    setLabel(headerRow1.getCell(2), 'MNV', 'ID');
    setLabel(headerRow1.getCell(3), 'Họ và tên', 'Full Name');
    setLabel(headerRow1.getCell(4), 'Bộ phận', 'Department');
    setLabel(headerRow1.getCell(5), 'Chức vụ', 'Job Title');
    
    headerRow1.getCell(6).value = {
      richText: [
        { text: 'Thời gian tăng ca\n', font: { bold: true, name: 'Times New Roman', size: 9, color: { argb: 'FF000000' } } },
        { text: 'Overtime Time', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF00B0F0' } } }
      ]
    };

    headerRow2.getCell(6).value = { 
      richText: [
        { text: 'Từ/ ', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF000000' } } },
        { text: 'From', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF00B0F0' } } }
      ] 
    };
    headerRow2.getCell(7).value = { 
      richText: [
        { text: 'Đến/', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF000000' } } },
        { text: 'To', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF00B0F0' } } }
      ] 
    };
    applyTableStyle(headerRow2.getCell(6));
    applyTableStyle(headerRow2.getCell(7));

    headerRow1.getCell(8).value = {
      richText: [
        { text: 'Người lao động đăng ký tên\n', font: { bold: true, name: 'Times New Roman', size: 8, color: { argb: 'FF000000' } } },
        { text: "Employees' signature", font: { bold: true, name: 'Times New Roman', size: 7, color: { argb: 'FF00B0F0' } } }
      ]
    };

    setLabel(headerRow1.getCell(9), 'Ghi chú', 'Note');

    // Add Data Rows - Ensure at least 5 rows like the template
    const recordCount = filteredRecords.length;
    const minRows = 5;
    const totalRowsCount = Math.max(recordCount, minRows);
    
    let currentRowIdx = 17;
    for (let j = 0; j < totalRowsCount; j++) {
      const rec = filteredRecords[j];
      // Lookup fallback for legacy records
      const e = rec ? (employees.find(emp => emp.id === rec.employeeId) || {
        name: rec.employeeName,
        employeeCode: rec.employeeCode,
        department: rec.department,
        jobTitle: rec.jobTitle
      }) : null;
      
      const row = worksheet.getRow(currentRowIdx + j);
      row.height = 25;

      const cellValues = [
        (j + 1),
        e?.employeeCode || '',
        e?.name || '',
        e?.department || '',
        e?.jobTitle || '',
        rec?.startTime || '',
        rec?.endTime || '',
        '',
        rec?.reason || ''
      ];

      cellValues.forEach((v, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = v;
        applyTableStyle(cell);
        if (idx === 2 || idx === 3 || idx === 4) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
      });
    }

    // Signatures
    const sigRow = currentRowIdx + totalRowsCount + 2;
    worksheet.getRow(sigRow).height = 20;

    worksheet.mergeCells(sigRow, 1, sigRow, 3);
    const reqBy = worksheet.getCell(sigRow, 1);
    reqBy.value = {
      richText: [
        { text: 'Người đề nghị/ ', font: { bold: true, name: 'Times New Roman', size: 11, color: { argb: 'FF000000' } } },
        { text: 'Requested by', font: { bold: true, name: 'Times New Roman', size: 11, color: { argb: 'FF00B0F0' } } }
      ]
    };
    reqBy.alignment = { horizontal: 'center' };

    worksheet.mergeCells(sigRow, 7, sigRow, 9);
    const headBy = worksheet.getCell(sigRow, 7);
    headBy.value = {
      richText: [
        { text: 'Trưởng bộ phận/ ', font: { bold: true, name: 'Times New Roman', size: 11, color: { argb: 'FF000000' } } },
        { text: 'Department Head', font: { bold: true, name: 'Times New Roman', size: 11, color: { argb: 'FF00B0F0' } } }
      ]
    };
    headBy.alignment = { horizontal: 'center' };

    // Signature Subtitles
    const subSig1 = sigRow + 1;
    worksheet.mergeCells(subSig1, 1, subSig1, 3);
    worksheet.getCell(subSig1, 1).value = '(Ký, ghi rõ họ tên)';
    worksheet.getCell(subSig1, 1).font = { italic: true, name: 'Times New Roman', size: 10, color: { argb: 'FF000000' } };
    worksheet.getCell(subSig1, 1).alignment = { horizontal: 'center' };

    worksheet.mergeCells(subSig1, 7, subSig1, 9);
    worksheet.getCell(subSig1, 7).value = '(Xác nhận, ký, ghi rõ họ tên)';
    worksheet.getCell(subSig1, 7).font = { italic: true, name: 'Times New Roman', size: 10, color: { argb: 'FF000000' } };
    worksheet.getCell(subSig1, 7).alignment = { horizontal: 'center' };

    const subSig2 = sigRow + 2;
    worksheet.mergeCells(subSig2, 1, subSig2, 3);
    worksheet.getCell(subSig2, 1).value = 'Signature (Full name)';
    worksheet.getCell(subSig2, 1).font = { italic: true, name: 'Times New Roman', size: 10, color: { argb: 'FF00B0F0' } };
    worksheet.getCell(subSig2, 1).alignment = { horizontal: 'center' };

    worksheet.mergeCells(subSig2, 7, subSig2, 9);
    worksheet.getCell(subSig2, 7).value = 'Signature (Full name)';
    worksheet.getCell(subSig2, 7).font = { italic: true, name: 'Times New Roman', size: 10, color: { argb: 'FF00B0F0' } };
    worksheet.getCell(subSig2, 7).alignment = { horizontal: 'center' };

    // Generate & Save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `BM_OT_Request_${targetDate}.xlsx`);
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
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Thời gian</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lý do</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length > 0 ? filteredRecords.map((r, i) => {
                const emp = employees.find(e => e.id === r.employeeId) || {
                  name: r.employeeName,
                  employeeCode: r.employeeCode,
                  department: r.department
                };
                const isEditing = editingId === r.id;

                return (
                  <tr key={r.id} className={cn("hover:bg-slate-50 group transition-colors", isEditing && "bg-indigo-50 hover:bg-indigo-50")}>
                    <td className="px-6 py-4 text-slate-400 font-medium">#{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 uppercase leading-none mb-1">{emp?.name || 'Unknown'}</div>
                      <div className="text-[10px] font-semibold text-indigo-500 font-mono tracking-tighter">{emp?.employeeCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{emp?.department}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {isEditing ? (
                        <input 
                          type="date" 
                          className="px-2 py-1 border rounded text-xs"
                          value={editValues.date}
                          onChange={(e) => handleEditChange('date', e.target.value)}
                        />
                      ) : format(parseISO(r.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm">
                        {isEditing ? editValues.hours : r.hours}h
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            className="bg-white border rounded px-1 py-0.5 text-[10px]"
                            value={editValues.startTime}
                            onChange={(e) => handleEditChange('startTime', e.target.value)}
                          />
                          <span>-</span>
                          <input 
                            type="time" 
                            className="bg-white border rounded px-1 py-0.5 text-[10px]"
                            value={editValues.endTime}
                            onChange={(e) => handleEditChange('endTime', e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-slate-500">{r.startTime} - {r.endTime}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 italic max-w-xs truncate">
                      {isEditing ? (
                        <textarea 
                          className="w-full px-2 py-1 border rounded"
                          value={editValues.reason}
                          onChange={(e) => handleEditChange('reason', e.target.value)}
                        />
                      ) : (r.reason || 'Không có ghi chú')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 px-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={handleEditSave}
                              className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                              title="Lưu"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={handleEditCancel}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : deletingId === r.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                            <button 
                              onClick={() => { onDeleteRecord(r.id); setDeletingId(null); }}
                              className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors"
                            >
                              Xóa
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditStart(r)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeletingId(r.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-300 italic">
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
