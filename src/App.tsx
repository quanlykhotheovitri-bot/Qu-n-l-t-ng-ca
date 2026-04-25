import React, { useState, useEffect } from 'react';
import { Layout, Clock, List, AlertTriangle, Menu, X, ChevronRight, Calendar } from 'lucide-react';
import { OTRecord, Employee } from './types';
import Registration from './components/Registration';
import OTList from './components/OTList';
import HistoryList from './components/HistoryList';
import AlertList from './components/AlertList';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_EMPLOYEES } from './constants';

type Tab = 'registration' | 'list' | 'history' | 'alerts';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('registration');
  const [records, setRecords] = useState<OTRecord[]>(() => {
    const saved = localStorage.getItem('ot_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('ot_employees');
    return saved ? JSON.parse(saved) : MOCK_EMPLOYEES;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('ot_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('ot_employees', JSON.stringify(employees));
  }, [employees]);

  const addRecord = (newRecord: Omit<OTRecord, 'id' | 'createdAt'>) => {
    const record: OTRecord = {
      ...newRecord,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setRecords(prev => [record, ...prev]);
  };

  const addRecords = (newRecords: Omit<OTRecord, 'id' | 'createdAt'>[], newEmployees: Employee[] = []) => {
    const finalRecords: OTRecord[] = newRecords.map(nr => ({
      ...nr,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }));
    setRecords(prev => [...finalRecords, ...prev]);
    
    if (newEmployees.length > 0) {
      setEmployees(prev => {
        const existingCodes = new Set(prev.map(e => e.employeeCode));
        const trulyNew = newEmployees.filter(e => !existingCodes.has(e.employeeCode));
        return [...prev, ...trulyNew];
      });
    }
  };

  const updateRecord = (id: string, updatedFields: Partial<OTRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updatedFields } : r));
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const deleteRecords = (ids: string[]) => {
    setRecords(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const clearAllRecords = () => {
    setRecords([]);
  };

  const navItems = [
    { id: 'registration' as Tab, label: 'Đăng ký tăng ca', icon: Clock, info: 'Nhập thông tin OT hàng ngày' },
    { id: 'list' as Tab, label: 'Danh sách tăng ca', icon: List, info: 'Xem & xuất báo cáo Excel' },
    { id: 'history' as Tab, label: 'Lịch sử tăng ca', icon: Calendar, info: 'Lịch sử toàn bộ dữ liệu' },
    { id: 'alerts' as Tab, label: 'Danh sách vượt ngưỡng', icon: AlertTriangle, info: 'Cảnh báo 12h/40h/300h' },
  ];

  const exceededCount = records.filter(r => r.hours > 8).length; // Just a dummy badge logic for demo

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={cn(
        "bg-slate-900 text-white h-screen sticky top-0 transition-all duration-300 flex flex-col z-50",
        isSidebarOpen ? "w-72" : "w-16"
      )}>
        <div className="p-6 flex items-center justify-between h-16">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-300", !isSidebarOpen && "w-0 opacity-0")}>
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">OT-Master Pro</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hover:bg-slate-800 p-2 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 opacity-80", activeTab === item.id && "opacity-100")} />
              {isSidebarOpen && (
                <div className="text-left overflow-hidden">
                  <div className="whitespace-nowrap">{item.label}</div>
                </div>
              )}
              {item.id === 'alerts' && isSidebarOpen && (
                 <span className="absolute right-4 bg-red-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                   {records.length > 0 ? "!" : "0"}
                 </span>
              )}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 border border-slate-700 shadow-xl rounded-md">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className={cn("flex items-center gap-3 transition-opacity duration-300", !isSidebarOpen && "opacity-0")}>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">AD</div>
            <div className="text-xs overflow-hidden">
              <p className="font-medium whitespace-nowrap">Admin User</p>
              <p className="text-slate-400 whitespace-nowrap">Quản lý nhân sự</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <h1 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">
            {navItems.find(n => n.id === activeTab)?.label}
          </h1>
          <div className="flex gap-3">
            <button className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              Hướng dẫn (PDF)
            </button>
            <div className="px-4 py-2 text-xs font-semibold bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600 shadow-sm">
              Status: Connected
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'registration' && (
                <Registration 
                  onAddRecord={addRecord} 
                  records={records} 
                  employees={employees}
                  setEmployees={setEmployees}
                />
              )}
              {activeTab === 'list' && (
                <OTList 
                  records={records} 
                  employees={employees} 
                  onUpdateRecord={updateRecord}
                  onDeleteRecord={deleteRecord}
                />
              )}
              {activeTab === 'history' && (
                <HistoryList 
                  records={records} 
                  employees={employees}
                  onAddRecords={addRecords}
                  onDeleteRecords={deleteRecords}
                  onClearAll={clearAllRecords}
                />
              )}
              {activeTab === 'alerts' && (
                <AlertList records={records} employees={employees} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-auto p-8 bg-white border-t border-slate-200 flex justify-between items-center text-slate-400">
          <div className="text-[10px] font-mono space-y-1 uppercase tracking-widest">
             <div>Build: Prod_V1.1</div>
             <div>Region: Asia_Pacific</div>
          </div>
          <div className="text-[10px] font-medium text-right max-w-xs">
            Hệ thống quản lý tuân thủ quy định lao động quốc tế 
            được thiết kế cho môi trường chuyên nghiệp.
          </div>
        </footer>
      </main>
    </div>
  );
}
