import React, { useState, useRef } from 'react';
import { LoaderIcon, CopyIcon } from './Icons';

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
    setError('');
    setIsActivating(true);
    if (!(await onActivate(key.trim()))) {
      setError('Mã kích hoạt không chính xác. Vui lòng kiểm tra lại.');
    }
    setIsActivating(false);
  };

  const handleCopy = async () => {
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
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10 bg-cute-cream">
      <div className="w-full max-w-md mx-auto">
        <div className="glass-card rounded-[40px] p-10 shadow-2xl text-center border-4 border-white relative overflow-hidden bg-white/90">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cute-pink via-cute-yellow to-cute-mint"></div>
          
          <div className="mb-6 inline-block p-6 rounded-full bg-pink-50 border-4 border-pink-100 shadow-sm animate-wiggle">
            <span className="text-6xl drop-shadow-sm filter contrast-125">🎀</span>
          </div>
          
          <h1 className="text-3xl font-black tracking-tight mb-2 text-stone-700 drop-shadow-sm">
            Kích Hoạt <span className="text-cute-pink-dark">Pro</span>
          </h1>
          <p className="text-stone-400 mb-8 text-sm font-bold">
            Nhập mã bản quyền để mở khóa tính năng Cute Christmas!
          </p>
          
          <div className="mb-6 bg-stone-50 p-5 rounded-3xl border-2 border-stone-100 group hover:border-cute-pink transition-colors">
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">
              Mã Máy Tính (Machine ID)
            </label>
            <div className="relative">
              <input
                ref={machineIdInputRef}
                type="text"
                readOnly
                value={machineId}
                className="w-full bg-transparent border-none text-stone-700 font-mono text-center text-lg focus:ring-0 tracking-wider font-bold"
              />
              <button
                onClick={handleCopy}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-cute-mint-dark transition"
                title="Sao chép"
              >
                {copied ? <span className="text-cute-mint-dark font-bold text-xs">Đã copy</span> : <CopyIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-left">
              <label htmlFor="licenseKey" className="block text-xs font-black text-stone-400 mb-2 uppercase tracking-wide ml-2">
                Nhập Mã Kích Hoạt
              </label>
              <textarea
                id="licenseKey"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                rows={2}
                className="w-full bg-white border-2 border-stone-100 rounded-3xl p-5 text-stone-700 placeholder-stone-300 focus:ring-0 focus:border-cute-pink transition text-center font-mono text-sm shadow-inner font-bold"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isActivating}
              className="w-full bg-gradient-to-r from-cute-pink to-cute-pink-dark text-white font-black py-4 px-8 rounded-2xl hover:shadow-lg transition-all transform hover:scale-[1.02] shadow-pink-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border-4 border-white"
            >
              {isActivating ? <LoaderIcon /> : 'MỞ KHÓA NGAY'}
            </button>
            
            {error && (
              <div className="text-red-500 font-bold bg-red-50 border border-red-100 p-3 rounded-xl text-xs animate-pulse">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};