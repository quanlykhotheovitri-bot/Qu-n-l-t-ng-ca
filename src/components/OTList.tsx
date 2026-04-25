import React, { useState, useMemo } from 'react';
import { Download, Filter, Calendar, List, Edit2, Trash2, Save, X } from 'lucide-react';
import { OTRecord, Employee } from '../types';
import { MOCK_EMPLOYEES } from '../constants';
import { cn } from '../lib/utils';
import { format, parseISO, isSameDay, isSameWeek, startOfWeek, endOfWeek } from 'date-fns';
import { isSameCycleMonth, getCycleIntervalForDate, getCycleYear } from '../lib/dateUtils';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface OTListProps {
  records: OTRecord[];
  employees: Employee[];
  onUpdateRecord: (id: string, updatedFields: Partial<OTRecord>) => void;
  onDeleteRecord: (id: string) => void;
  canDelete?: boolean;
}

type Period = 'day' | 'week' | 'month' | 'year';

export default function OTList({ records, employees, onUpdateRecord, onDeleteRecord, canDelete = true }: OTListProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<OTRecord>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const target = parseISO(targetDate);
    return records.filter(record => {
      const recordDate = parseISO(record.date);
      switch (period) {
        case 'day': return isSameDay(recordDate, target);
        case 'week': return isSameWeek(recordDate, target, { weekStartsOn: 1 });
        case 'month': return isSameCycleMonth(recordDate, target);
        case 'year': return getCycleYear(recordDate) === getCycleYear(target);
        default: return true;
      }
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [records, period, targetDate]);

  const summaryData = useMemo(() => {
    const target = parseISO(targetDate);
    const weekStart = startOfWeek(target, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(target, { weekStartsOn: 1 });
    const cycleInterval = getCycleIntervalForDate(target);
    const targetCycleYear = getCycleYear(target);

    const summaryMap: Record<string, { employee: Employee; week: number; month: number; year: number }> = {};

    employees.forEach(emp => {
      summaryMap[emp.id] = { employee: emp, week: 0, month: 0, year: 0 };
    });

    records.forEach(r => {
      const recordDate = parseISO(r.date);
      const empId = r.employeeId;
      
      if (!summaryMap[empId]) return;

      // Year total (Cycle Year)
      if (getCycleYear(recordDate) === targetCycleYear) {
        summaryMap[empId].year += r.hours;
      }
      // Month total (Cycle)
      if (recordDate >= cycleInterval.start && recordDate <= cycleInterval.end) {
        summaryMap[empId].month += r.hours;
      }
      // Week total
      if (recordDate >= weekStart && recordDate <= weekEnd) {
        summaryMap[empId].week += r.hours;
      }
    });

    return Object.values(summaryMap).filter(s => s.week > 0 || s.month > 0 || s.year > 0);
  }, [records, employees, targetDate]);

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
    const worksheet = workbook.addWorksheet(viewMode === 'summary' ? 'Báo cáo tổng kết' : 'BM tăng ca tự nguyện');

    const target = parseISO(targetDate);
    const dayStr = format(target, 'dd');
    const monthStr = format(target, 'MM');
    const yearStr = format(target, 'yyyy');

    if (viewMode === 'summary') {
      worksheet.columns = [
        { header: 'Stt', key: 'stt', width: 6 },
        { header: 'MNV', key: 'mnv', width: 15 },
        { header: 'Họ và tên', key: 'name', width: 30 },
        { header: 'Bộ phận', key: 'dept', width: 20 },
        { header: 'Tổng Tuần (h)', key: 'week', width: 15 },
        { header: 'Tổng Tháng (h)', key: 'month', width: 15 },
        { header: 'Tổng Năm (h)', key: 'year', width: 15 },
      ];

      summaryData.forEach((s, i) => {
        worksheet.addRow({
          stt: i + 1,
          mnv: s.employee.employeeCode,
          name: s.employee.name,
          dept: s.employee.department,
          week: s.week,
          month: s.month,
          year: s.year,
        });
      });

      // Simple styling for summary
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { horizontal: 'center' };
      
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Bao_cao_tong_hop_OT_${targetDate}.xlsx`);
      return; // Exit early for summary mode
    }

    // Detailed export (existing code logic)
    worksheet.columns = [
        { key: 'stt', width: 4.5 },
        { key: 'mnv', width: 10 },
        { key: 'name', width: 33 },
        { key: 'dept', width: 15 },
        { key: 'job', width: 15 },
        { key: 'from', width: 9 },
        { key: 'to', width: 9 },
        { key: 'sign', width: 16 },
        { key: 'note', width: 22 },
      ];
      // (Simplified export logic for brevity or keep current logic)
      // For now, let's keep the formatted export for detailed view.
      // [Previous complex title/logo rows would go here if restored]

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
    <div className="space-y-4 lg:space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-end gap-4 lg:gap-6">
        <div className="flex-1 min-w-0 lg:min-w-[200px]">
          <label className="block text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 lg:mb-2 ml-1">Chế độ xem</label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('summary')}
              className={cn(
                "flex-1 py-1.5 lg:py-2 text-[10px] lg:text-xs font-bold rounded-lg transition-all uppercase tracking-tighter",
                viewMode === 'summary' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Tổng hợp
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={cn(
                "flex-1 py-1.5 lg:py-2 text-[10px] lg:text-xs font-bold rounded-lg transition-all uppercase tracking-tighter",
                viewMode === 'detailed' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Chi tiết
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 lg:min-w-[240px]">
          <label className="block text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 lg:mb-2 ml-1">Chu kỳ báo cáo</label>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex-1 py-1.5 lg:py-2 text-[8px] lg:text-[10px] font-bold rounded-lg transition-all uppercase tracking-tighter",
                  period === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 lg:mb-2 ml-1">Mốc thời gian</label>
          <div className="space-y-1">
            <input
              type="date"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans h-[42px]"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            {period === 'month' && (
              <p className="text-[9px] lg:text-[10px] text-indigo-500 font-bold italic text-center lg:text-left">
                Chu kỳ: {format(getCycleIntervalForDate(parseISO(targetDate)).start, 'dd/MM')} - {format(getCycleIntervalForDate(parseISO(targetDate)).end, 'dd/MM')}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={exportExcel}
          disabled={filteredRecords.length === 0}
          className="lg:w-auto h-[42px] px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-wide disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Xuất Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            {viewMode === 'summary' ? 'Danh sách tổng hợp nhân viên' : 'Danh sách đăng ký gần đây'}
          </h3>
          <span className="text-[10px] text-slate-400 italic">
            {viewMode === 'summary' ? `Tính đến ngày ${format(parseISO(targetDate), 'dd/MM/yyyy')}` : ''}
          </span>
        </div>
        <div className="overflow-x-auto selection:bg-indigo-100 flex-1">
          {viewMode === 'summary' ? (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100 w-16">STT</th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Nhân viên</th>
                  <th className="hidden md:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Bộ phận</th>
                  <th className="px-3 sm:px-6 py-4 text-[10px] font-bold text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/30 border-r border-slate-100">T</th>
                  <th className="px-3 sm:px-6 py-4 text-[10px] font-bold text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/30 border-r border-slate-100">M</th>
                  <th className="px-3 sm:px-6 py-4 text-[10px] font-bold text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/30">Y</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {summaryData.length > 0 ? summaryData.map((s, i) => (
                  <tr key={s.employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="hidden sm:table-cell px-6 py-4 text-slate-300 font-mono italic text-xs border-r border-slate-100">#{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 sm:px-6 py-4 border-r border-slate-100">
                      <div className="font-bold text-slate-800 uppercase leading-tight text-[10px] sm:text-sm mb-1">{s.employee.name}</div>
                      <div className="text-[9px] sm:text-[10px] font-bold text-indigo-500 font-mono bg-indigo-50 inline-block px-1.5 rounded">{s.employee.employeeCode}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-slate-600 font-medium border-r border-slate-100 italic">{s.employee.department}</td>
                    <td className="px-3 sm:px-6 py-4 text-center font-bold text-indigo-600 bg-indigo-50/10 border-r border-slate-100 text-xs">{s.week}</td>
                    <td className="px-3 sm:px-6 py-4 text-center font-bold text-indigo-600 bg-indigo-50/10 border-r border-slate-100 text-xs">{s.month}</td>
                    <td className="px-3 sm:px-6 py-4 text-center font-bold text-indigo-600 bg-indigo-50/10 text-xs">{s.year}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-300 italic">
                      <List className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      Không có dữ liệu tổng hợp trong chu kỳ này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="hidden lg:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100 w-16">STT</th>
                <th className="px-4 sm:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Nhân viên</th>
                <th className="hidden xl:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Bộ phận</th>
                <th className="px-4 sm:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Ngày</th>
                <th className="px-4 sm:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-100">Giờ</th>
                <th className="hidden md:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-r border-slate-100">Thời gian</th>
                <th className="hidden lg:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100">Lý do</th>
                <th className="px-4 sm:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">#</th>
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
                  <tr key={r.id} className={cn("hover:bg-slate-50 group transition-colors", isEditing && "bg-indigo-50/50")}>
                    <td className="hidden lg:table-cell px-6 py-4 text-slate-300 font-mono italic text-xs border-r border-slate-100">#{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 sm:px-6 py-4 border-r border-slate-100">
                      <div className="font-bold text-slate-800 uppercase leading-tight text-[10px] sm:text-sm mb-1">{emp?.name}</div>
                      <div className="text-[9px] sm:text-[10px] font-bold text-indigo-500 font-mono bg-indigo-50 inline-block px-1.5 rounded">{emp?.employeeCode}</div>
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4 text-slate-500 border-r border-slate-100">{emp?.department}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-600 border-r border-slate-100 font-medium text-[10px] sm:text-xs">
                      {isEditing ? (
                        <input 
                          type="date" 
                          className="px-2 py-1 border border-slate-200 rounded text-[10px] outline-none focus:border-indigo-500 w-full"
                          value={editValues.date}
                          onChange={(e) => handleEditChange('date', e.target.value)}
                        />
                      ) : format(parseISO(r.date), 'dd/MM')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center border-r border-slate-100">
                      <span className="px-1.5 sm:px-2 py-1 bg-indigo-100 text-indigo-600 rounded font-bold text-[10px] sm:text-xs">
                        {isEditing ? editValues.hours : r.hours}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-center border-r border-slate-100">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            className="bg-white border border-slate-200 rounded px-1 py-1 text-[10px] outline-none"
                            value={editValues.startTime}
                            onChange={(e) => handleEditChange('startTime', e.target.value)}
                          />
                          <span className="text-slate-300">-</span>
                          <input 
                            type="time" 
                            className="bg-white border border-slate-200 rounded px-1 py-1 text-[10px] outline-none"
                            value={editValues.endTime}
                            onChange={(e) => handleEditChange('endTime', e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-slate-500 lowercase bg-slate-100 px-2 py-0.5 rounded-full inline-block">{r.startTime} - {r.endTime}</div>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-xs text-slate-400 italic max-w-xs truncate border-r border-slate-100">
                      {isEditing ? (
                        <textarea 
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500"
                          value={editValues.reason}
                          onChange={(e) => handleEditChange('reason', e.target.value)}
                        />
                      ) : (r.reason || '...')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={handleEditSave}
                              className="p-1 sm:p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            >
                              <Save className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            </button>
                            <button 
                              onClick={handleEditCancel}
                              className="p-1 sm:p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                            >
                              <X className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            </button>
                          </>
                        ) : deletingId === r.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                            <button 
                              onClick={() => { onDeleteRecord(r.id); setDeletingId(null); }}
                              className="px-1.5 sm:px-2 py-1 bg-red-600 text-white text-[9px] sm:text-[10px] font-bold rounded hover:bg-red-700"
                            >
                              Xóa
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="px-1.5 sm:px-2 py-1 bg-slate-100 text-slate-500 text-[9px] sm:text-[10px] font-bold rounded"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditStart(r)}
                              className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            </button>
                            {canDelete && (
                              <button 
                                onClick={() => setDeletingId(r.id)}
                                className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-300 italic">
                    <List className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    Không tìm thấy dữ liệu phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
