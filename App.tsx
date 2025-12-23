
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
import { AppConfig, ApiKey, TrackedFile, VideoJob, Preset } from './types';
import { Activation } from './components/Activation';
import { ApiKeyManagerScreen } from './components/ApiKeyManager';
import { StatsModal, AdminLoginModal, AlertModal } from './components/AppModals';
import { Generator } from './components/Generator';
import { Tracker } from './components/Tracker';
import { ChartIcon, ShieldIcon, KeyIcon } from './components/Icons';

const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const ipcRenderer = isElectron && (window as any).require ? (window as any).require('electron').ipcRenderer : null;
const SECRET_KEY = 'your-super-secret-key-for-mv-prompt-generator-pro-2024';

const App: React.FC = () => {
    // --- Global State ---
    const [activeTab, setActiveTab] = useState<'generator' | 'tracker'>('generator');
    const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
    const [activeTrackerFileIndex, setActiveTrackerFileIndex] = useState(0);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null);
    
    // --- Auth & Config State ---
    const [isActivated, setIsActivated] = useState(false);
    const [machineId, setMachineId] = useState('');
    const [configLoaded, setConfigLoaded] = useState(false);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [activeApiKey, setActiveApiKey] = useState<ApiKey | null>(null);
    const [isManagingKeys, setIsManagingKeys] = useState(false);
    const [presets, setPresets] = useState<Preset[]>([]);

    // --- Modal State ---
    const [showStats, setShowStats] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [alertModal, setAlertModal] = useState<{title: string, message: string, type: 'completion' | 'update', onConfirm?: () => void} | null>(null);

    // --- Process State ---
    const [ffmpegFound, setFfmpegFound] = useState<boolean | null>(null);
    const [isCombining, setIsCombining] = useState(false);

    // --- Helpers ---
    const getEncryptionKey = (mid: string) => CryptoJS.SHA256(mid + SECRET_KEY).toString();
    const encrypt = (text: string) => machineId ? CryptoJS.AES.encrypt(text, getEncryptionKey(machineId)).toString() : '';
    const decrypt = (text: string, mid: string) => {
        try { return CryptoJS.AES.decrypt(text, CryptoJS.SHA256(mid + SECRET_KEY).toString()).toString(CryptoJS.enc.Utf8); } catch { return ''; }
    };

    // --- Initialization Effect ---
    useEffect(() => {
        if (!ipcRenderer) { setIsActivated(true); setConfigLoaded(true); return; }
        ipcRenderer.invoke('get-app-config').then((config: AppConfig) => {
            const mid = config.machineId || '';
            setMachineId(mid);
            
            // Check License
            let valid = false;
            try {
                if (config.licenseKey && mid) {
                    const [rid, sig] = config.licenseKey.split('.');
                    if (rid === mid && sig === CryptoJS.HmacSHA256(mid, SECRET_KEY).toString(CryptoJS.enc.Hex)) valid = true;
                }
            } catch {}
            setIsActivated(valid);

            // Load Keys
            try {
                const keysStr = decrypt(config.apiKeysEncrypted || '', mid);
                const keys = keysStr ? JSON.parse(keysStr) : [];
                setApiKeys(keys);
                if (config.activeApiKeyId) setActiveApiKey(keys.find((k:ApiKey) => k.id === config.activeApiKeyId) || null);
            } catch {}

            // Load Presets
            if (config.presets) setPresets(config.presets);
            setConfigLoaded(true);
        });
        
        // Listeners
        ipcRenderer.on('file-content-updated', (_:any, {path, content}:any) => {
             const wb = XLSX.read(content, {type:'buffer'});
             const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, blankrows:false}).slice(1) as any[][];
             const jobs: VideoJob[] = data.map((r,i) => ({
                 id: r[0]||`job_${i}`, prompt: r[1]||'', imagePath:'', imagePath2:'', imagePath3:'',
                 status: (['Pending','Processing','Generating','Completed','Failed'].includes(r[5])?r[5]:'Pending') as any,
                 videoName: r[6]||'', typeVideo: r[7]||'', videoPath: r[8]||undefined
             })).filter(j => j.id);
             
             setTrackedFiles(prev => prev.map(f => f.path === path ? { ...f, jobs } : f));
        });
        
        ipcRenderer.on('show-alert-modal', (_:any, data:any) => {
            if (data.type === 'update') data.onConfirm = () => ipcRenderer.send('restart_app');
            setAlertModal(data);
        });

        // Check FFmpeg
        ipcRenderer.invoke('check-ffmpeg').then((res:any) => setFfmpegFound(res.found));

        // Auto Reload
        const interval = setInterval(async () => {
             if (activeTab === 'tracker') handleReloadVideos(); 
        }, 10000);

        return () => clearInterval(interval);
    }, [activeTab]); 

    // --- Actions ---
    const handleActivate = async (key: string) => {
        try {
            const [rid, sig] = key.split('.');
            if (rid === machineId && sig === CryptoJS.HmacSHA256(machineId, SECRET_KEY).toString(CryptoJS.enc.Hex)) {
                if (ipcRenderer) ipcRenderer.invoke('save-app-config', { licenseKey: key, machineId });
                setIsActivated(true);
                return true;
            }
        } catch {}
        return false;
    };

    const handleKeyUpdate = (keys: ApiKey[], activeId: string | null) => {
        setApiKeys(keys);
        if (activeId) setActiveApiKey(keys.find(k => k.id === activeId) || null);
        else setActiveApiKey(null);
        if (ipcRenderer) ipcRenderer.invoke('save-app-config', { apiKeysEncrypted: encrypt(JSON.stringify(keys)), activeApiKeyId: activeId });
    };

    const handleGenerateSuccess = async (scenes: any[], formData: any) => {
        const safeName = (formData.projectName || 'MV').replace(/[^a-z0-9_]/gi, '_');
        const jobs: VideoJob[] = scenes.map((p:any,i:number) => ({
            id: `Job_${i+1}`, prompt: p.prompt_text, status: 'Pending', videoName: `${safeName}_${i+1}`, typeVideo: '', imagePath:'', imagePath2:'', imagePath3:''
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(jobs.map(j=>({JOB_ID:j.id, PROMPT:j.prompt, IMAGE_PATH:'', IMAGE_PATH_2:'', IMAGE_PATH_3:'', STATUS:'', VIDEO_NAME:j.videoName, TYPE_VIDEO:''})));
        XLSX.utils.book_append_sheet(wb, ws, 'Prompts');
        const content = XLSX.write(wb, {bookType:'xlsx', type:'array'});
        
        if (ipcRenderer) {
            const res = await ipcRenderer.invoke('save-file-dialog', { defaultPath: `${safeName}.xlsx`, fileContent: content });
            if (res.success) {
                const totalSec = (parseInt(formData.songMinutes)||0)*60 + (parseInt(formData.songSeconds)||0);
                setTrackedFiles(p => [...p, { name: `${safeName}.xlsx`, jobs, path: res.filePath, targetDurationSeconds: totalSec }]);
                setActiveTrackerFileIndex(trackedFiles.length); 
                setActiveTab('tracker');
                setFeedback({type:'success', message:'Đã lưu và bắt đầu theo dõi!'});
                ipcRenderer.send('start-watching-file', res.filePath);
            }
        }
    };

    const handleReloadVideos = async () => {
        if (!ipcRenderer) return;
        setTrackedFiles(prev => {
            prev.forEach(file => {
                if (file.path) {
                    ipcRenderer.invoke('find-videos-for-jobs', { jobs: file.jobs, excelFilePath: file.path })
                        .then((res:any) => {
                             if(res.success && JSON.stringify(res.jobs) !== JSON.stringify(file.jobs)) {
                                 setTrackedFiles(curr => curr.map(f => f.path === file.path ? {...f, jobs: res.jobs} : f));
                             }
                        });
                }
            });
            return prev;
        });
    };

    const handleCombine = async (mode: 'normal' | 'timed') => {
        const file = trackedFiles[activeTrackerFileIndex];
        if (!file || !file.path || !ipcRenderer) return;
        setIsCombining(true);
        setFeedback({type:'info', message:'Đang ghép video...'});
        const completed = file.jobs.filter(j => j.status === 'Completed' && j.videoPath);
        if (completed.length === 0) { setIsCombining(false); setFeedback({type:'error', message:'Chưa có video nào hoàn thành'}); return; }
        
        try {
            const res = await ipcRenderer.invoke('execute-ffmpeg-combine', {
                jobs: completed, targetDuration: file.targetDurationSeconds, mode, excelFileName: file.name
            });
            if (res.success) setFeedback({type:'success', message:'Ghép video thành công!'});
            else if (res.error) setFeedback({type:'error', message: res.error});
            else setFeedback(null);
        } catch (e:any) { setFeedback({type:'error', message:e.message}); }
        setIsCombining(false);
    };

    const handleCombineAll = async () => {
        if (!ipcRenderer) return;
        setIsCombining(true);
        const filesToProcess = trackedFiles.filter(f => f.jobs.some(j => j.status === 'Completed' && j.videoPath))
            .map(f => ({ name: f.name, jobs: f.jobs.filter(j=>j.status==='Completed' && j.videoPath) }));
        
        const res = await ipcRenderer.invoke('execute-ffmpeg-combine-all', filesToProcess);
        if (!res.canceled) {
            setFeedback({ type: res.failures.length ? 'error' : 'success', message: `Đã ghép xong. Thành công: ${res.successes.length}, Lỗi: ${res.failures.length}` });
        } else setFeedback({type:'info', message:'Đã hủy'});
        setIsCombining(false);
    };

    const handleSetToolFlowPath = async () => {
        if (ipcRenderer) {
            const res = await ipcRenderer.invoke('set-tool-flow-path');
            if (res.success) {
                setFeedback({type:'success', message:'Đã cập nhật đường dẫn ToolFlows'});
            }
        }
    };

    // --- Render ---
    if (!configLoaded) return <div className="min-h-screen bg-tet-cream flex items-center justify-center text-tet-brown"><ShieldIcon className="animate-spin w-16 h-16 text-tet-red"/></div>;
    
    if (!isActivated && machineId) return <Activation machineId={machineId} onActivate={handleActivate} />;
    
    if (isActivated && (!activeApiKey || isManagingKeys)) return <ApiKeyManagerScreen apiKeys={apiKeys} onKeyAdd={k => handleKeyUpdate([...apiKeys, k], activeApiKey?.id||null)} onKeyDelete={id => handleKeyUpdate(apiKeys.filter(k=>k.id!==id), activeApiKey?.id===id?null:activeApiKey?.id||null)} onKeySelect={k => {handleKeyUpdate(apiKeys, k.id); setIsManagingKeys(false);}} />;

    const currentFile = trackedFiles[activeTrackerFileIndex];
    const stats = currentFile ? {
        completed: currentFile.jobs.filter(j => j.status === 'Completed').length,
        inProgress: currentFile.jobs.filter(j => ['Processing','Generating'].includes(j.status)).length,
        total: currentFile.jobs.length
    } : null;

    return (
        <div className="relative h-screen overflow-hidden flex flex-col font-sans text-tet-brown">
            {/* Header - Tet Binh Ngo Theme - Highly Decorative */}
            <header className="px-8 py-3 bg-gradient-to-r from-tet-red-dark via-tet-red to-tet-red-dark border-b-4 border-tet-gold shadow-lg flex justify-between items-center sticky top-0 z-50 rounded-b-[40px] mx-4 mt-2 shrink-0">
                <div className="flex items-center gap-4">
                    {/* Tet Logo Block */}
                    <div className="bg-tet-gold p-2 rounded-full border-4 border-tet-red shadow-md animate-bounce-slow">
                        <span className="text-4xl filter drop-shadow-sm cursor-default">🐎</span>
                    </div>
                    
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                             <h1 className="text-2xl font-black tracking-tighter leading-none text-tet-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                                CHÚC MỪNG NĂM MỚI
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-bold text-white uppercase tracking-[0.2em] opacity-90">Prompt Generator Pro</span>
                             <span className="text-[10px] font-bold text-tet-red bg-tet-gold-light px-2 py-0.5 rounded-full border border-tet-gold shadow-sm">2026</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {activeApiKey && (
                        <div onClick={() => setIsManagingKeys(true)} className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800/80 px-4 py-2 rounded-full cursor-pointer transition border border-tet-gold/30 hover:border-tet-gold shadow-sm group">
                            <KeyIcon className="w-4 h-4 text-tet-gold group-hover:text-white transition-colors" />
                            <span className="text-xs font-bold text-tet-gold group-hover:text-white uppercase tracking-wide">{activeApiKey.name}</span>
                        </div>
                    )}
                    <button onClick={() => setShowStats(true)} className="p-3 bg-tet-gold hover:bg-white text-tet-red-dark hover:text-tet-red rounded-full transition shadow-md hover:shadow-lg transform hover:rotate-12 border-2 border-white" title="Thống Kê"><ChartIcon className="w-5 h-5"/></button>
                    <button onClick={() => setShowAdminLogin(true)} className="p-3 bg-tet-red hover:bg-white text-white hover:text-tet-red rounded-full transition shadow-md hover:shadow-lg transform hover:rotate-12 border-2 border-white" title="Admin"><ShieldIcon className="w-5 h-5"/></button>
                </div>
            </header>

            {/* Navigation Tabs - Pills */}
            <div className="flex justify-center gap-4 py-4 shrink-0 relative z-40">
                <button 
                    onClick={() => setActiveTab('generator')} 
                    className={`px-8 py-3 rounded-full font-extrabold uppercase tracking-wider text-xs transition-all shadow-md transform hover:-translate-y-1 flex items-center gap-2 border-2 ${activeTab === 'generator' ? 'bg-tet-red text-white border-tet-gold shadow-tet-red/30' : 'bg-white text-tet-brown hover:bg-tet-red/10 border-white'}`}
                >
                    <span className="text-lg">✨</span> Kịch Bản Tết
                </button>
                <button 
                    onClick={() => setActiveTab('tracker')} 
                    className={`px-8 py-3 rounded-full font-extrabold uppercase tracking-wider text-xs transition-all shadow-md transform hover:-translate-y-1 flex items-center gap-2 border-2 ${activeTab === 'tracker' ? 'bg-tet-green text-white border-tet-gold shadow-tet-green/30' : 'bg-white text-tet-brown hover:bg-tet-green/10 border-white'}`}
                >
                    <span className="text-lg">🎬</span> Xưởng Phim <span className="bg-white text-tet-green px-2 py-0.5 rounded-full text-[10px] shadow-sm ml-1 font-black">{trackedFiles.length}</span>
                </button>
            </div>

            {/* Main Content Container */}
            <div className="flex-1 p-4 md:p-6 overflow-hidden relative z-20">
                 <div className="max-w-[1600px] mx-auto h-full">
                     
                     {/* Generator Tab Wrapper */}
                     <div className={`${activeTab === 'generator' ? 'block' : 'hidden'} h-full overflow-y-auto custom-scrollbar pb-20`}>
                        {/* Decorative Wrapper for Generator */}
                        <div className="relative">
                            <div className="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-tet-gold rounded-tl-3xl opacity-50 pointer-events-none"></div>
                            <div className="absolute -top-4 -right-4 w-20 h-20 border-t-4 border-r-4 border-tet-gold rounded-tr-3xl opacity-50 pointer-events-none"></div>
                            
                            <div className="glass-card p-8 rounded-[40px] shadow-2xl animate-fade-in border-4 border-tet-gold/30 mb-8 bg-white/95 relative overflow-hidden">
                                <Generator 
                                    activeApiKey={activeApiKey} presets={presets} 
                                    onSavePresets={p => { setPresets(p); if(ipcRenderer) ipcRenderer.invoke('save-app-config', {presets:p}); }}
                                    onGenerateSuccess={handleGenerateSuccess}
                                    onFeedback={setFeedback}
                                />
                            </div>

                            <div className="absolute -bottom-4 -left-4 w-20 h-20 border-b-4 border-l-4 border-tet-gold rounded-bl-3xl opacity-50 pointer-events-none"></div>
                            <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-4 border-r-4 border-tet-gold rounded-br-3xl opacity-50 pointer-events-none"></div>
                        </div>
                     </div>

                     {/* Tracker Tab Wrapper */}
                     <div className={`${activeTab === 'tracker' ? 'block' : 'hidden'} h-full`}>
                        <Tracker 
                            trackedFiles={trackedFiles} activeFileIndex={activeTrackerFileIndex} setActiveFileIndex={setActiveTrackerFileIndex}
                            onOpenFile={async () => {
                                if(ipcRenderer) {
                                    const res = await ipcRenderer.invoke('open-file-dialog');
                                    if(res.success) {
                                        const newFiles = res.files.map((f:any) => {
                                            const wb = XLSX.read(f.content, {type:'buffer'});
                                            const jobs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1}).slice(1).map((r:any,i:number)=>({
                                                id: r[0]||`Job_${i}`, status: r[5]||'Pending', videoName: r[6]||'', prompt: r[1]
                                            }));
                                            ipcRenderer.send('start-watching-file', f.path);
                                            return { name: f.name, path: f.path, jobs };
                                        });
                                        setTrackedFiles(prev => [...prev, ...newFiles]);
                                    }
                                }
                            }}
                            onCloseFile={(idx) => {
                                const f = trackedFiles[idx];
                                if(f.path && ipcRenderer) ipcRenderer.send('stop-watching-file', f.path);
                                setTrackedFiles(p => p.filter((_,i) => i !== idx));
                                if(activeTrackerFileIndex >= idx) setActiveTrackerFileIndex(Math.max(0, activeTrackerFileIndex - 1));
                            }}
                            stats={stats} ffmpegFound={ffmpegFound} isCombining={isCombining}
                            onPlayVideo={(path) => ipcRenderer && ipcRenderer.send('open-video-path', path)}
                            onShowFolder={(path) => ipcRenderer && ipcRenderer.send('open-folder', path.substring(0, path.lastIndexOf(navigator.userAgent.includes("Windows")?'\\':'/')))}
                            onOpenToolFlows={() => ipcRenderer && ipcRenderer.invoke('open-tool-flow')}
                            onSetToolFlowPath={handleSetToolFlowPath}
                            onReloadVideos={handleReloadVideos}
                            onRetryStuck={() => currentFile?.path && ipcRenderer.invoke('retry-stuck-jobs', {filePath: currentFile.path})}
                            onRetryJob={(id) => currentFile?.path && ipcRenderer.invoke('retry-job', {filePath: currentFile.path, jobId: id})}
                            onDeleteVideo={async (_id, path) => {
                                if(ipcRenderer) {
                                    const res = await ipcRenderer.invoke('delete-video-file', path);
                                    if(res.success) handleReloadVideos();
                                }
                            }}
                            onCombine={handleCombine}
                            onCombineAll={handleCombineAll}
                            onLinkVideo={async (id, idx) => {
                                if(ipcRenderer) {
                                    const res = await ipcRenderer.invoke('open-video-file-dialog');
                                    if(res.success) {
                                        setTrackedFiles(prev => {
                                            const next = [...prev];
                                            next[idx].jobs = next[idx].jobs.map(j => j.id === id ? {...j, videoPath: res.path, status: 'Completed'} : j);
                                            return next;
                                        });
                                    }
                                }
                            }}
                        />
                     </div>
                 </div>
            </div>

            {/* Feedback Toast - Tet Style */}
            {feedback && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 z-[200] animate-bounce-small font-bold text-sm border-2 ${feedback.type === 'error' ? 'bg-red-50 border-tet-red text-tet-red' : feedback.type === 'success' ? 'bg-yellow-50 border-tet-gold-dark text-tet-gold-dark' : 'bg-blue-50 border-blue-200 text-blue-800'} backdrop-blur-xl`}>
                    <span className="text-xl">{feedback.type === 'success' ? '🧧' : feedback.type === 'error' ? '🧨' : 'ℹ️'}</span>
                    <span>{feedback.message}</span>
                    <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-75 text-xl leading-none">&times;</button>
                </div>
            )}

            {showStats && <StatsModal onClose={() => setShowStats(false)} isAdmin={isAdminLoggedIn} onDeleteAll={() => ipcRenderer.invoke('delete-all-stats')} onDeleteHistory={(d) => ipcRenderer.invoke('delete-stat-date', d)} />}
            {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLoginSuccess={() => { setIsAdminLoggedIn(true); setShowAdminLogin(false); setShowStats(true); }} />}
            {alertModal && <AlertModal {...alertModal} onClose={() => setAlertModal(null)} />}
        </div>
    );
};

export default App;
