import React, { useState, useEffect } from 'react';
import { Layout, Clock, List, AlertTriangle, Menu, X, ChevronRight, Calendar, LogOut } from 'lucide-react';
import { OTRecord, Employee } from './types';
import Registration from './components/Registration';
import OTList from './components/OTList';
import HistoryList from './components/HistoryList';
import AlertList from './components/AlertList';
import Login from './components/Login';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_EMPLOYEES } from './constants';

type Tab = 'registration' | 'list' | 'history' | 'alerts';

interface UserState {
  username: string;
  role: 'admin' | 'user';
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('registration');
  const [user, setUser] = useState<UserState | null>(() => {
    const saved = localStorage.getItem('ot_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [records, setRecords] = useState<OTRecord[]>(() => {
    const saved = localStorage.getItem('ot_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('ot_employees');
    return saved ? JSON.parse(saved) : MOCK_EMPLOYEES;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  useEffect(() => {
    localStorage.setItem('ot_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('ot_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ot_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ot_user');
    }
  }, [user]);

  const handleLogin = (username: string, role: 'admin' | 'user') => {
    setUser({ username, role });
  };

  const handleLogout = () => {
    setUser(null);
  };

  const canDelete = user?.role === 'admin';

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
    if (!canDelete) return;
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const deleteRecords = (ids: string[]) => {
    if (!canDelete) return;
    setRecords(prev => prev.filter(r => !ids.includes(r.id)));
  };

  const clearAllRecords = () => {
    if (!canDelete) return;
    setRecords([]);
  };

  const navItems = [
    { id: 'registration' as Tab, label: 'Đăng ký', icon: Clock, info: 'Nhập thông tin OT hàng ngày' },
    { id: 'list' as Tab, label: 'Danh sách', icon: List, info: 'Xem & xuất báo cáo Excel' },
    { id: 'history' as Tab, label: 'Lịch sử', icon: Calendar, info: 'Lịch sử toàn bộ dữ liệu' },
    { id: 'alerts' as Tab, label: 'Cảnh báo', icon: AlertTriangle, info: 'Cảnh báo 12h/40h/300h' },
  ];

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden relative">
      {/* Sidebar Navigation - Desktop */}
      <aside className={cn(
        "bg-slate-900 text-white h-screen sticky top-0 transition-all duration-300 hidden lg:flex flex-col z-50",
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
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={cn("flex items-center justify-between gap-3 transition-opacity duration-300", !isSidebarOpen && "opacity-0 invisible")}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold uppercase">
                {user.username.substring(0, 2)}
              </div>
              <div className="text-xs overflow-hidden">
                <p className="font-medium whitespace-nowrap">{user.username}</p>
                <p className="text-slate-400 whitespace-nowrap uppercase text-[10px]">{user.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 bg-indigo-600 rounded flex lg:hidden items-center justify-center"
            )}>
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-sm lg:text-lg font-bold text-slate-800 uppercase tracking-tight truncate max-w-[200px]">
              {navItems.find(n => n.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <button 
              onClick={handleLogout}
              className="lg:hidden p-2 text-slate-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="hidden sm:block px-3 py-1.5 text-[10px] lg:text-xs font-bold bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600 shadow-sm uppercase">
              {user.role}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl w-full mx-auto space-y-6 pb-24 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
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
                    canDelete={canDelete}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryList 
                    records={records} 
                    employees={employees}
                    onAddRecords={addRecords}
                    onDeleteRecords={deleteRecords}
                    onClearAll={clearAllRecords}
                    canDelete={canDelete}
                  />
                )}
                {activeTab === 'alerts' && (
                  <AlertList records={records} employees={employees} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around z-50 pb-safe shadow-2xl">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                activeTab === item.id ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <item.icon className={cn("w-6 h-6", activeTab === item.id ? "fill-indigo-50" : "")} />
              <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
              {item.id === 'alerts' && records.length > 0 && (
                <div className="absolute top-1 ml-4 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
