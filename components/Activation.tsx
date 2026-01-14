
import React, { useState, useRef } from 'react';
import { LoaderIcon, CopyIcon, CheckIcon, LockIcon } from './Icons';

interface ActivationProps {
  machineId: string;
  onActivate: (key: string) => Promise<boolean>;
}

export const Activation: React.FC<ActivationProps> = ({ machineId, onActivate }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const machineIdInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setError('');
    setIsActivating(true);
    const success = await onActivate(key.trim());
    if (!success) setError('Mã kích hoạt không hợp lệ.');
    setIsActivating(false);
  };

  const handleCopy = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (machineIdInputRef.current) {
        machineIdInputRef.current.select();
        document.execCommand('copy');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-mac-bg">
      <div className="w-full max-w-sm bg-mac-surface rounded-mac-xl shadow-mac-float border border-white/20 p-8 text-center">
        <div className="w-16 h-16 bg-mac-surface-sec rounded-2xl flex items-center justify-center mx-auto mb-6">
           <LockIcon className="w-8 h-8 text-mac-accent" />
        </div>
        
        <h1 className="text-xl font-bold text-mac-text mb-2">Kích Hoạt Bản Quyền</h1>
        <p className="text-sm text-gray-500 mb-8">Vui lòng nhập mã bản quyền để mở khóa tính năng Pro.</p>
        
        <div className="mb-6 bg-mac-surface-sec p-4 rounded-mac border border-mac-border/20">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Mã Phần Cứng</label>
          <div className="relative flex items-center">
            <input
              ref={machineIdInputRef}
              type="text"
              readOnly
              value={machineId || 'Đang tạo...'}
              className="w-full bg-transparent border-none text-mac-text font-mono text-sm text-center font-medium focus:ring-0 p-0"
            />
            <button
              onClick={handleCopy}
              className="absolute right-0 p-1 text-gray-400 hover:text-mac-accent transition"
              title="Sao chép"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full text-center text-sm h-12 px-4"
            placeholder="Dán mã kích hoạt tại đây"
            required
          />
          
          <button
            type="submit"
            disabled={isActivating || !machineId}
            className="w-full bg-mac-accent text-white font-semibold py-3 rounded-mac hover:bg-mac-accent-hover transition shadow-lg shadow-blue-500/20 disabled:opacity-50 text-sm flex items-center justify-center"
          >
            {isActivating ? <LoaderIcon /> : 'Kích Hoạt Ngay'}
          </button>
          
          {error && (
            <div className="text-red-500 text-xs font-medium mt-4 bg-red-50 py-2 px-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
