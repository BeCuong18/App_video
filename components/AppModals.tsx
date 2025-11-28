import React, { useState, useEffect } from 'react';
import { StatsData } from '../types';
import { ChartIcon, ShieldIcon, LoaderIcon, TrashIcon, LockIcon } from './Icons';

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

// --- Stats Modal ---
interface StatsModalProps {
    onClose: () => void;
    isAdmin: boolean;
    onDeleteHistory: (date: string) => void;
    onDeleteAll: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ onClose, isAdmin, onDeleteHistory, onDeleteAll }) => {
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

    const handleDelete = async (date: string) => { await onDeleteHistory(date); loadStats(); };
    const handleDeleteAll = async () => { await onDeleteAll(); loadStats(); };

    const maxCount = stats?.history.reduce((max, item) => Math.max(max, item.count), 0) || 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
            <div className={`glass-card border-4 border-white rounded-[40px] max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white/90`}>
                <div className="p-6 border-b-2 border-dashed border-stone-100 flex justify-between items-center bg-white/50">
                    <h3 className="text-xl font-black text-stone-700 flex items-center gap-3 uppercase tracking-wide">
                        {isAdmin ? <ShieldIcon className="w-6 h-6 text-cute-pink" /> : <ChartIcon className="w-6 h-6 text-cute-yellow" />}
                        {isAdmin ? 'QUẢN TRỊ VIÊN' : 'THỐNG KÊ SẢN XUẤT'}
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-400 flex items-center justify-center transition font-bold text-lg">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-cute-cream">
                    {loading ? ( <div className="flex justify-center py-10"><LoaderIcon /></div> ) : !stats ? ( <p className="text-center text-stone-400">Không có dữ liệu.</p> ) : (
                        <div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                {[
                                    { label: 'Video Hoàn Thành', value: stats.total, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                                    { label: 'Prompt Đã Tạo', value: stats.promptCount, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
                                    { label: 'Credits Sử Dụng', value: stats.totalCredits, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-100' },
                                    { label: 'Machine ID', value: stats.machineId, color: 'text-stone-500', bg: 'bg-stone-100 border-stone-200', isCode: true }
                                ].map((item, idx) => (
                                    <div key={idx} className={`${item.bg} p-5 rounded-3xl text-center border-2 shadow-sm`}>
                                        <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold mb-2">{item.label}</p>
                                        {item.isCode ? (
                                            <p className="text-[10px] font-mono text-stone-600 break-all bg-white p-2 rounded-lg">{item.value}</p>
                                        ) : (
                                            <p className={`text-3xl font-black ${item.color} drop-shadow-sm`}>{item.value}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isAdmin && (
                                <div className="mb-8 p-6 bg-white rounded-3xl border-2 border-stone-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-stone-600 font-bold text-sm uppercase tracking-wide flex items-center gap-2"><ChartIcon className="w-4 h-4 text-cute-yellow"/> Biểu đồ năng suất</h4>
                                        <button onClick={() => { if(confirm("Xóa TOÀN BỘ lịch sử?")) handleDeleteAll(); }} className="bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition shadow-md border-2 border-white">
                                            <TrashIcon className="w-3 h-3"/> Reset All
                                        </button>
                                    </div>
                                    <div className="flex items-end gap-2 h-40 pt-4 pb-2 px-2 overflow-x-auto custom-scrollbar border-b-2 border-dashed border-stone-100">
                                        {stats.history.length === 0 ? <p className="text-stone-400 w-full text-center text-sm">Chưa có dữ liệu biểu đồ</p> : 
                                            stats.history.slice(0, 30).reverse().map((item) => (
                                                <div key={item.date} className="flex flex-col items-center gap-1 group relative min-w-[24px] flex-1 h-full justify-end">
                                                    <div className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-cute-brown px-2 py-1 rounded-lg shadow-lg z-10 whitespace-nowrap font-bold">{item.count} video</div>
                                                    <div 
                                                        className="w-full bg-cute-mint-dark hover:bg-cute-mint transition-all rounded-t-lg"
                                                        style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: '8px' }}
                                                    ></div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            <h4 className="text-sm font-bold text-stone-600 mb-4 border-l-4 border-cute-pink pl-3 uppercase tracking-wider">Lịch sử chi tiết</h4>
                            <div className="overflow-hidden rounded-3xl border-2 border-stone-100 bg-white shadow-sm">
                                <table className="w-full text-left text-sm text-stone-700">
                                    <thead className="bg-stone-50 text-stone-400 uppercase font-bold text-[10px] tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3 border-b border-stone-100">Ngày</th>
                                            <th className="px-6 py-3 text-right border-b border-stone-100">Số lượng</th>
                                            {isAdmin && <th className="px-6 py-3 text-center border-b border-stone-100">Hành động</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {stats.history.length === 0 ? ( <tr><td colSpan={isAdmin ? 3 : 2} className="px-6 py-8 text-center text-stone-400 italic">Chưa có dữ liệu</td></tr> ) : (
                                            stats.history.map((item) => (
                                                <tr key={item.date} className="hover:bg-stone-50 transition">
                                                    <td className="px-6 py-3 font-mono text-stone-600 text-xs font-bold">{item.date}</td>
                                                    <td className="px-6 py-3 text-right font-black text-emerald-500">{item.count}</td>
                                                    {isAdmin && (
                                                        <td className="px-6 py-3 text-center">
                                                            <button onClick={() => { if(confirm("Xóa ngày này?")) handleDelete(item.date); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-400 transition mx-auto"><TrashIcon className="w-4 h-4"/></button>
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
            else setError('Thông tin đăng nhập không chính xác');
        } else {
             if (username === 'bescuong' && password === '285792684') onLoginSuccess();
             else setError('Mock: Sai thông tin');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-card border-4 border-white rounded-[32px] max-w-sm w-full shadow-2xl p-8 transform scale-100 transition-all bg-white/90">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4 border-2 border-red-100 shadow-sm animate-bounce-slow">
                        <LockIcon className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-lg font-black text-stone-700 uppercase tracking-wide">Khu Vực Quản Trị</h3>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tên đăng nhập" className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 text-stone-700 focus:border-red-300 transition text-sm font-bold" required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl p-4 text-stone-700 focus:border-red-300 transition text-sm font-bold" required />
                    {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}
                    
                    <div className="flex gap-3 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 font-bold transition text-sm">Hủy</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-red-400 hover:bg-red-500 text-white font-bold transition disabled:opacity-50 text-sm flex justify-center items-center shadow-lg border-2 border-white">
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
      <div className={`glass-card border-4 ${type === 'update' ? 'border-blue-300' : 'border-cute-yellow'} rounded-[40px] max-w-md w-full shadow-2xl transform scale-100 p-8 text-center bg-white`}>
          <div className={`mx-auto flex items-center justify-center h-24 w-24 rounded-full mb-6 ${type === 'update' ? 'bg-blue-50' : 'bg-yellow-50'} border-4 ${type === 'update' ? 'border-blue-200' : 'border-yellow-200'} shadow-lg animate-bounce-slow`}>
             {type === 'update' ? (
                <span className="text-4xl">🚀</span>
             ) : (
                <span className="text-5xl">🎁</span>
             )}
          </div>
          <h3 className="text-2xl font-black text-stone-700 mb-3 uppercase tracking-wide">{title}</h3>
          <p className="text-stone-500 mb-8 leading-relaxed text-sm font-bold">{message}</p>
          <div className="flex justify-center gap-4">
            <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-500 font-bold transition text-sm">Đóng</button>
            {onConfirm && (
              <button onClick={onConfirm} className={`px-6 py-3 rounded-2xl font-bold transition shadow-lg text-white text-sm uppercase tracking-wide transform hover:scale-105 border-4 border-white ${type === 'update' ? 'bg-blue-500 hover:bg-blue-400' : 'bg-cute-yellow hover:bg-yellow-300 text-stone-800'}`}>
                {type === 'update' ? 'Cập nhật' : 'Tuyệt vời'}
              </button>
            )}
          </div>
      </div>
    </div>
  );
};