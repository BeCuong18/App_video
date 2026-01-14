
import React, { useState, useEffect } from 'react';
import { StatsData } from '../types';
import { ChartIcon, ShieldIcon, LoaderIcon, TrashIcon, LockIcon } from './Icons';

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

// --- Stats Modal ---
interface StatsModalProps {
    onClose: () => void;
    isAdmin: boolean;
    activeApiKeyId?: string;
}

export const StatsModal: React.FC<StatsModalProps> = ({ onClose, isAdmin, activeApiKeyId }) => {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = () => {
        if (ipcRenderer) {
            ipcRenderer.invoke('get-stats').then((data: StatsData) => {
                setStats(data);
                setLoading(false);
            }).catch((err: any) => {
                console.error("Failed to load stats", err);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    };

    useEffect(() => { loadStats(); }, []);

    const handleDelete = async (date: string) => { 
        if (ipcRenderer) await ipcRenderer.invoke('delete-stat-date', date);
        loadStats(); 
    };
    
    const handleDeleteAll = async () => { 
        if (ipcRenderer) await ipcRenderer.invoke('delete-all-stats');
        loadStats(); 
    };

    const maxCount = stats?.history.reduce((max, item) => Math.max(max, item.count), 0) || 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-mac-surface rounded-mac-xl w-full max-w-3xl shadow-mac-float border border-white/20 max-h-[85vh] flex flex-col overflow-hidden">
                <div className="p-5 bg-mac-surface-sec/50 border-b border-mac-border/30 flex justify-between items-center shrink-0">
                    <h3 className="text-base font-bold text-mac-text flex items-center gap-2">
                        {isAdmin ? <ShieldIcon className="w-5 h-5 text-mac-accent" /> : <ChartIcon className="w-5 h-5 text-mac-accent" />}
                        Thống Kê Sử Dụng
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 flex items-center justify-center transition text-lg leading-none">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {loading ? ( <div className="flex justify-center py-10"><LoaderIcon /></div> ) : !stats ? ( <p className="text-center text-gray-400">Chưa có dữ liệu.</p> ) : (
                        <div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                {[
                                    { label: 'Video Hoàn Thành', value: stats.total, color: 'text-green-600' },
                                    { label: 'Prompt Đã Tạo', value: stats.promptCount, color: 'text-mac-accent' },
                                    { label: 'Tín Dụng', value: stats.totalCredits, color: 'text-orange-500' },
                                    { label: 'Mã Máy', value: stats.machineId, color: 'text-gray-500', isCode: true }
                                ].map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-mac border border-mac-border/20 shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{item.label}</p>
                                        {item.isCode ? (
                                            <p className="text-[10px] font-mono text-gray-600 bg-gray-50 p-1 rounded break-all">{item.value}</p>
                                        ) : (
                                            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {activeApiKeyId && stats.modelUsage?.[activeApiKeyId] && (
                                <div className="mb-6 bg-white p-5 rounded-mac border border-mac-border/20 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-900 mb-4">Hạn Mức Trong Ngày (Key Đang Dùng)</h4>
                                    <div className="space-y-3">
                                        {Object.entries(stats.modelUsage[activeApiKeyId]).map(([model, countVal]) => {
                                            const count = countVal as number;
                                            return (
                                                <div key={model} className="flex items-center gap-4">
                                                    <span className="text-xs font-medium text-gray-500 w-32 truncate">{model}</span>
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${count >= 18 ? 'bg-red-500' : 'bg-mac-accent'}`} 
                                                            style={{ width: `${Math.min((count / 20) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{count}/20</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-mac border border-mac-border/30 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-bold text-xs border-b border-mac-border/30">
                                        <tr>
                                            <th className="px-4 py-3">Ngày</th>
                                            <th className="px-4 py-3 text-right">Số lượng</th>
                                            {isAdmin && <th className="px-4 py-3 text-center">Thao tác</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {stats.history.length === 0 ? ( <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-xs">Trống</td></tr> ) : (
                                            stats.history.map((item) => (
                                                <tr key={item.date} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{item.date}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-mac-text">{item.count}</td>
                                                    {isAdmin && (
                                                        <td className="px-4 py-3 text-center">
                                                            <button onClick={() => handleDelete(item.date)} className="text-gray-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Admin Login Modal ---
interface AdminLoginModalProps {
    onClose: () => void;
    onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onClose, onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (ipcRenderer) {
            const result = await ipcRenderer.invoke('verify-admin', { username, password });
            if (result.success) onLoginSuccess();
            else setError('Thông tin đăng nhập không đúng');
        } else {
             if (username === 'bescuong' && password === '285792684') onLoginSuccess();
             else setError('Mock: Sai thông tin');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-mac-surface rounded-mac-xl max-w-xs w-full shadow-mac-float border border-white/20 p-6">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <LockIcon className="w-6 h-6 text-gray-500" />
                    </div>
                    <h3 className="text-base font-bold text-mac-text">Đăng Nhập Quản Trị</h3>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-3">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tên đăng nhập" className="w-full text-sm px-4 h-10" required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" className="w-full text-sm px-4 h-10" required />
                    {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                    
                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs transition">Hủy</button>
                        <button type="submit" disabled={loading} className="flex-1 h-10 rounded-lg bg-mac-text hover:bg-black text-white font-semibold text-xs transition flex justify-center items-center">
                            {loading ? <LoaderIcon /> : 'Đăng Nhập'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Alert Modal ---
interface AlertModalProps {
  title: string;
  message: string;
  type: 'completion' | 'update';
  onClose: () => void;
  onConfirm?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ title, message, type, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-mac-surface rounded-mac-xl max-w-sm w-full shadow-mac-float border border-white/20 p-6 text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${type === 'update' ? 'bg-blue-100 text-mac-accent' : 'bg-green-100 text-green-600'}`}>
             {type === 'update' ? <span className="text-xl">🚀</span> : <span className="text-xl">✓</span>}
          </div>
          <h3 className="text-lg font-bold text-mac-text mb-2">{title}</h3>
          <p className="text-mac-text-sec text-sm mb-6 leading-relaxed">{message}</p>
          <div className="flex justify-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm transition">Đóng</button>
            {onConfirm && (
              <button onClick={onConfirm} className={`px-5 py-2.5 rounded-lg font-semibold text-white text-sm transition ${type === 'update' ? 'bg-mac-accent hover:bg-mac-accent-hover' : 'bg-green-600 hover:bg-green-700'}`}>
                {type === 'update' ? 'Cập nhật' : 'Tuyệt vời'}
              </button>
            )}
          </div>
      </div>
    </div>
  );
};
