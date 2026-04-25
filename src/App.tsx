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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './lib/firebase';

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
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  // Auth synchronization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Here we define role based on email or a specific flag
        // For simplicity, we can use a list of admins or check for certain emails
        const isAdminEmail = firebaseUser.email === 'admin@otmaster.com' || firebaseUser.email === 'quanlykhotheovitri@gmail.com';
        setUser({
          username: firebaseUser.displayName || firebaseUser.email || 'User',
          role: isAdminEmail ? 'admin' : 'user'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data synchronization - Records
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'records'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OTRecord));
      setRecords(docs);
    });
    return () => unsubscribe();
  }, [user]);

  // Data synchronization - Employees
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = (username: string, role: 'admin' | 'user') => {
    // This is now handled by onAuthStateChanged after Google login
    // but we can keep it for manual overrides if needed, though not recommended with Firebase
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  const canDelete = user?.role === 'admin';

  const addRecord = async (newRecord: Omit<OTRecord, 'id' | 'createdAt'>) => {
    const id = generateId();
    const record: OTRecord = {
      ...newRecord,
      id,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'records', id), record);
    } catch (error) {
      console.error("Error adding record:", error);
    }
  };

  const addRecords = async (newRecords: Omit<OTRecord, 'id' | 'createdAt'>[], newEmployees: Employee[] = []) => {
    const batch = writeBatch(db);
    
    newRecords.forEach(nr => {
      const id = generateId();
      const record: OTRecord = {
        ...nr,
        id,
        createdAt: new Date().toISOString(),
      };
      batch.set(doc(db, 'records', id), record);
    });

    if (newEmployees.length > 0) {
      const existingCodes = new Set(employees.map(e => e.employeeCode));
      newEmployees.forEach(e => {
        if (!existingCodes.has(e.employeeCode)) {
          const id = generateId();
          batch.set(doc(db, 'employees', id), { ...e, id });
        }
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error adding bulk records:", error);
    }
  };

  const updateRecord = async (id: string, updatedFields: Partial<OTRecord>) => {
    try {
      await setDoc(doc(db, 'records', id), updatedFields, { merge: true });
    } catch (error) {
      console.error("Error updating record:", error);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!canDelete) return;
    try {
      await deleteDoc(doc(db, 'records', id));
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const deleteRecords = async (ids: string[]) => {
    if (!canDelete) return;
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.delete(doc(db, 'records', id));
    });
    try {
      await batch.commit();
    } catch (error) {
      console.error("Error deleting multi records:", error);
    }
  };

  const clearAllRecords = async () => {
    if (!canDelete) return;
    const batch = writeBatch(db);
    records.forEach(r => {
      batch.delete(doc(db, 'records', r.id));
    });
    try {
      await batch.commit();
    } catch (error) {
      console.error("Error clearing records:", error);
    }
  };

  const updateEmployees = async (updater: (prev: Employee[]) => Employee[]) => {
    // This is tricky because we usually want direct firestore updates
    // For manual employee additions:
    const newEmployees = updater(employees);
    const trulyNew = newEmployees.filter(ne => !employees.find(e => e.id === ne.id));
    
    for (const emp of trulyNew) {
      await setDoc(doc(db, 'employees', emp.id), emp);
    }
  };

  const navItems = [
    { id: 'registration' as Tab, label: 'Đăng ký', icon: Clock, info: 'Nhập thông tin OT hàng ngày' },
    { id: 'list' as Tab, label: 'Danh sách', icon: List, info: 'Xem & xuất báo cáo Excel' },
    { id: 'history' as Tab, label: 'Lịch sử', icon: Calendar, info: 'Lịch sử toàn bộ dữ liệu' },
    { id: 'alerts' as Tab, label: 'Cảnh báo', icon: AlertTriangle, info: 'Cảnh báo 12h/40h/300h' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

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
                    setEmployees={updateEmployees}
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
