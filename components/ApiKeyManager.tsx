import React, { useState } from 'react';
import { ApiKey } from '../types';
import { KeyIcon, TrashIcon, CheckIcon } from './Icons';

interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onKeySelect: (key: ApiKey) => void;
  onKeyAdd: (key: ApiKey) => void;
  onKeyDelete: (keyId: string) => void;
}

export const ApiKeyManagerScreen: React.FC<ApiKeyManagerProps> = ({ apiKeys, onKeySelect, onKeyAdd, onKeyDelete }) => {
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newKeyName.trim() || !newKeyValue.trim()) {
            setError('Vui lòng nhập đầy đủ thông tin.');
            return;
        }
        onKeyAdd({
            id: crypto.randomUUID(),
            name: newKeyName.trim(),
            value: newKeyValue.trim(),
        });
        setNewKeyName('');
        setNewKeyValue('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10 bg-cute-cream">
            <div className="w-full max-w-2xl mx-auto">
                <div className="glass-card rounded-[40px] p-8 shadow-2xl border-4 border-white bg-white/90">
                    <h1 className="text-3xl font-black tracking-tight mb-2 text-center text-stone-700 drop-shadow-sm">
                        <span className="text-cute-mint-dark">API Key</span> Manager
                    </h1>
                    <p className="text-stone-400 mb-8 text-center text-sm font-bold">
                        Quản lý khóa kết nối Google Gemini AI.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* List Column */}
                        <div className="order-2 md:order-1">
                            <h2 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 ml-2">Danh sách khóa</h2>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {apiKeys.length === 0 ? (
                                    <p className="text-stone-400 italic text-sm text-center py-6 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-100">Chưa có khóa nào.</p>
                                ) : (
                                    apiKeys.map(key => (
                                        <div key={key.id} className="group flex items-center justify-between p-3 bg-white rounded-2xl border-2 border-stone-100 hover:border-cute-mint transition-all shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-3 bg-yellow-50 rounded-xl text-cute-yellow">
                                                    <KeyIcon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-stone-700 truncate">{key.name}</p>
                                                    <p className="text-[10px] text-stone-400 font-mono truncate">••••••••••••{key.value.slice(-4)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onKeySelect(key)} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-500 rounded-lg transition" title="Sử dụng">
                                                    <CheckIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => onKeyDelete(key.id)} className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-400 rounded-lg transition" title="Xóa">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Add Column */}
                        <div className="order-1 md:order-2 bg-stone-50 rounded-[32px] p-6 border-2 border-stone-100 h-fit">
                            <h2 className="text-xs font-black text-stone-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-cute-pink inline-block shadow-sm"></span> Thêm khóa mới
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        className="w-full bg-white border-2 border-stone-100 rounded-2xl p-3 text-sm text-stone-700 focus:border-cute-pink transition font-bold"
                                        placeholder="Tên gợi nhớ (VD: Key Chính)"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="password"
                                        value={newKeyValue}
                                        onChange={(e) => setNewKeyValue(e.target.value)}
                                        className="w-full bg-white border-2 border-stone-100 rounded-2xl p-3 text-sm text-stone-700 focus:border-cute-pink transition font-mono font-bold"
                                        placeholder="AI Studio API Key"
                                    />
                                </div>
                                {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
                                <button
                                    type="submit"
                                    className="w-full bg-cute-pink text-white font-black py-3 rounded-2xl hover:bg-cute-pink-dark transition shadow-lg text-sm uppercase tracking-wide transform hover:scale-[1.02] border-4 border-white"
                                >
                                    Lưu Khóa
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};