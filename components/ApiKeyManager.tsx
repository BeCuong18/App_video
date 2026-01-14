
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim() || !newKeyValue.trim()) return;
        onKeyAdd({
            id: crypto.randomUUID(),
            name: newKeyName.trim(),
            value: newKeyValue.trim(),
        });
        setNewKeyName('');
        setNewKeyValue('');
    };

    return (
        <div className="min-h-full flex justify-center p-6">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                
                {/* List Column */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-mac-text-sec ml-1 uppercase tracking-wide">Danh Sách Key</h2>
                    <div className="bg-mac-surface rounded-mac-lg shadow-mac-card border border-mac-border/20 overflow-hidden">
                        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                            {apiKeys.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">Chưa có Key nào.</div>
                            ) : (
                                apiKeys.map(key => (
                                    <div key={key.id} className="group flex items-center justify-between p-4 hover:bg-mac-surface-sec/50 transition">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 text-mac-accent flex items-center justify-center shrink-0">
                                                <KeyIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-mac-text truncate">{key.name}</p>
                                                <p className="text-xs text-gray-400 font-mono truncate">••••{key.value.slice(-6)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onKeySelect(key)} className="px-4 py-1.5 bg-white border border-mac-border hover:bg-green-50 text-gray-600 hover:text-green-600 hover:border-green-200 rounded-lg text-xs font-bold transition">
                                                Chọn
                                            </button>
                                            <button onClick={() => onKeyDelete(key.id)} className="p-2 text-gray-400 hover:text-red-500 transition">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Add Column */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-mac-text-sec ml-1 uppercase tracking-wide">Thêm Key Mới</h2>
                    <div className="bg-mac-surface rounded-mac-lg shadow-mac-card border border-mac-border/20 p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-mac-text-sec mb-2">Tên Key</label>
                                <input
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    className="w-full text-sm h-10 px-3"
                                    placeholder="Ví dụ: Tài khoản Chính"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-mac-text-sec mb-2">Mã Bí Mật (API Secret)</label>
                                <input
                                    type="password"
                                    value={newKeyValue}
                                    onChange={(e) => setNewKeyValue(e.target.value)}
                                    className="w-full text-sm h-10 px-3 font-mono"
                                    placeholder="Dán Key từ Google AI Studio tại đây"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newKeyName || !newKeyValue}
                                className="w-full bg-mac-accent text-white font-semibold py-2.5 rounded-lg hover:bg-mac-accent-hover transition shadow-sm disabled:opacity-50 text-sm mt-2"
                            >
                                Lưu Key
                            </button>
                        </form>
                    </div>
                    
                    <div className="p-4 rounded-mac-lg bg-blue-50 border border-blue-100">
                        <p className="text-xs text-blue-800 leading-relaxed">
                            <strong>Lưu ý:</strong> API Key được lưu cục bộ trên máy tính của bạn. Để sử dụng Gemini 1.5 Pro, hãy đảm bảo tài khoản Google Cloud đã bật thanh toán (Billing).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
