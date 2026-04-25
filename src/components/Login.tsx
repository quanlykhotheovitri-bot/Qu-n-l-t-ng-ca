import React, { useState } from 'react';
import { Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { loginWithGoogle } from '../lib/firebase';

interface LoginProps {
  onLogin: (username: string, role: 'admin' | 'user') => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      // Role will be handled by App.tsx through onAuthStateChanged
    } catch (err: any) {
      setError('Đăng nhập thất bại. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Quản Lý Tăng Ca</h1>
            <p className="text-indigo-100 text-sm mt-1">Đăng nhập bằng Google để tiếp tục</p>
          </div>

          <div className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100 italic">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-lg shadow-slate-100 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
              ) : (
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              )}
              Đăng nhập bằng Google
            </button>
            
            <div className="pt-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hệ thống quản lý nội bộ</p>
              <p className="text-[9px] text-slate-400 mt-2">Dữ liệu sẽ được đồng bộ theo thời gian thực</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
