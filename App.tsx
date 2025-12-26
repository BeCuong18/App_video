
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { TrackedFile, VideoJob, Preset, FormData, ApiKey } from './types';
import { Activation } from './components/Activation';
import { StatsModal, AdminLoginModal, AlertModal } from './components/AppModals';
import { Generator } from './components/Generator';
import { Tracker } from './components/Tracker';
import { ApiKeyManagerScreen } from './components/ApiKeyManager';
import { ChartIcon, ShieldIcon, KeyIcon, FolderIcon } from './components/Icons';

const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const ipcRenderer = isElectron && (window as any).require ? (window as any).require('electron').ipcRenderer : null;

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'generator' | 'tracker' | 'api-manager'>('generator');
    const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
    const [activeTrackerFileIndex, setActiveTrackerFileIndex] = useState(0);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [machineId, setMachineId] = useState('');
    const [configLoaded, setConfigLoaded] = useState(false);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [showStats, setShowStats] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [alertModal, setAlertModal] = useState<{title: string, message: string, type: 'completion' | 'update', onConfirm?: () => void} | null>(null);
    const [ffmpegFound, setFfmpegFound] = useState<boolean | null>(null);
    const [isCombining, setIsCombining] = useState(false);
    
    // Form Data Persistent State (Giữ dữ liệu khi chuyển tab)
    const [generatorFormData, setGeneratorFormData] = useState<FormData>({
        idea: '', in2vAtmosphere: '', uploadedImages: [null, null, null], liveArtistName: '', liveArtist: '',
        songMinutes: '3', songSeconds: '30', projectName: '',
        model: 'gemini-3-flash-preview', 
        mvGenre: 'narrative', filmingStyle: 'auto',
        country: 'Việt Nam', musicGenre: 'V-Pop', customMusicGenre: '',
        characterConsistency: true, characterCount: 1, temperature: 0.7
    });

    // API Key States
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [activeApiKeyId, setActiveApiKeyId] = useState<string>('');

    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => {
                setFeedback(null);
            }, 10000); 
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const parseApiKeys = (data: any): ApiKey[] => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    };

    useEffect(() => {
        const init = async () => {
            let savedKeys: ApiKey[] = [];
            let activeId = '';
            let currentMachineId = '';
            let currentLicense = '';

            if (ipcRenderer) {
                const config = await ipcRenderer.invoke('get-app-config');
                currentMachineId = config.machineId || '';
                currentLicense = config.licenseKey || '';
                
                if (config.presets) setPresets(config.presets);
                
                const keysFromMain = parseApiKeys(config.apiKeys);
                const keysFromEncrypted = parseApiKeys(config.apiKeysEncrypted);
                savedKeys = keysFromMain.length > 0 ? keysFromMain : keysFromEncrypted;
                activeId = config.activeApiKeyId || (savedKeys[0]?.id || '');

                ipcRenderer.on('show-alert-modal', (_: any, data: any) => {
                    setAlertModal({
                        title: data.title,
                        message: data.message,
                        type: data.type,
                        onConfirm: data.type === 'update' ? () => {
                            ipcRenderer.send('restart_app');
                        } : undefined
                    });
                });
            }

            const localLicense = localStorage.getItem('license-key');
            if (!currentLicense && localLicense) {
                currentLicense = localLicense;
                if (ipcRenderer) {
                    await ipcRenderer.invoke('save-app-config', { licenseKey: currentLicense });
                }
            }

            setMachineId(currentMachineId);
            setIsActivated(!!currentLicense);
            setApiKeys(savedKeys);
            setActiveApiKeyId(activeId);
            
            if (savedKeys.length === 0) setActiveTab('api-manager');
            else setActiveTab('generator');
            
            setConfigLoaded(true);
        };

        init();

        if (ipcRenderer) {
            ipcRenderer.on('file-content-updated', (_:any, {path, content}:any) => {
                 const wb = XLSX.read(content, {type:'buffer'});
                 const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, blankrows:false}).slice(1) as any[][];
                 const jobs: VideoJob[] = data.map((r,i) => ({
                     id: r[0]||`job_${i}`, prompt: r[1]||'', 
                     imagePath: r[2]||'', imagePath2: r[3]||'', imagePath3: r[4]||'',
                     status: r[5] as any || 'Pending',
                     videoName: r[6]||'', typeVideo: r[7]||'', videoPath: r[8]||undefined
                 }));
                 setTrackedFiles(prev => prev.map(f => f.path === path ? { ...f, jobs } : f));
            });
            ipcRenderer.invoke('check-ffmpeg').then((res:any) => setFfmpegFound(res.found));
        }

        return () => {
            if (ipcRenderer) {
                ipcRenderer.removeAllListeners('show-alert-modal');
                ipcRenderer.removeAllListeners('file-content-updated');
            }
        };
    }, []); 

    const handleSavePresets = async (newPresets: Preset[]) => {
        setPresets(newPresets);
        if (ipcRenderer) {
            await ipcRenderer.invoke('save-app-config', { presets: newPresets });
        }
    };

    const handleActivate = async (key: string) => {
        if (key && key.trim().length > 5) {
            if (ipcRenderer) {
                await ipcRenderer.invoke('save-app-config', { licenseKey: key.trim() });
                setIsActivated(true);
                localStorage.setItem('license-key', key.trim());
                return true;
            }
        }
        return false;
    };

    const saveApiConfig = async (newKeys: ApiKey[], activeId: string) => {
        if (ipcRenderer) {
            await ipcRenderer.invoke('save-app-config', {
                apiKeys: JSON.stringify(newKeys),
                activeApiKeyId: activeId
            });
        }
        localStorage.setItem('api-keys', JSON.stringify(newKeys));
    };

    const handleKeySelect = (key: ApiKey) => {
        setActiveApiKeyId(key.id);
        saveApiConfig(apiKeys, key.id);
        setActiveTab('generator');
        setFeedback({ type: 'success', message: `Đã chọn API Key: ${key.name}` });
    };

    const handleKeyAdd = (key: ApiKey) => {
        const updated = [...apiKeys, key];
        setApiKeys(updated);
        const newActiveId = activeApiKeyId || key.id;
        if (!activeApiKeyId) setActiveApiKeyId(newActiveId);
        saveApiConfig(updated, newActiveId);
    };

    const handleKeyDelete = (id: string) => {
        const updated = apiKeys.filter(k => k.id !== id);
        setApiKeys(updated);
        const newActiveId = activeApiKeyId === id ? (updated[0]?.id || '') : activeApiKeyId;
        setActiveApiKeyId(newActiveId);
        saveApiConfig(updated, newActiveId);
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

    // Fix: Implemented handleSetToolFlowPath to resolve the reference error. This function calls the Electron IPC handler to pick an executable for ToolFlows.
    const handleSetToolFlowPath = async () => {
        if (ipcRenderer) {
            const res = await ipcRenderer.invoke('set-tool-flow-path');
            if (res.success) {
                setFeedback({ type: 'success', message: 'Đã cập nhật đường dẫn ToolFlows' });
            }
        }
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
            if (res.success) setFeedback({type: 'success', message:'Ghép video thành công!'});
            else if (res.error) setFeedback({type:'error', message: res.error});
            else setFeedback(null);
        } catch (e:any) { setFeedback({type:'error', message:e.message}); }
        setIsCombining(false);
    };

    const handleCombineAll = async () => {
        if (!ipcRenderer) return;
        setIsCombining(true);
        setFeedback({type:'info', message:'Đang bắt đầu ghép tất cả...'});
        
        const filesToProcess = trackedFiles
            .filter(f => f.jobs.some(j => j.status === 'Completed' && j.videoPath))
            .map(f => ({ 
                name: f.name, 
                jobs: f.jobs.filter(j => j.status === 'Completed' && j.videoPath) 
            }));
        
        if (filesToProcess.length === 0) {
            setIsCombining(false);
            setFeedback({type:'error', message:'Không tìm thấy video nào đã hoàn thành để ghép.'});
            return;
        }

        try {
            const res = await ipcRenderer.invoke('execute-ffmpeg-combine-all', { files: filesToProcess });
            if (res && res.success) {
                setFeedback({ type: 'success', message: `Đã ghép xong ${res.count} dự án vào thư mục kết quả.` });
            } else if (res && res.error) {
                setFeedback({ type: 'error', message: res.error });
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message });
        }
        setIsCombining(false);
    };

    const handleGenerateSuccess = async (scenes: any[], formData: FormData, detectedType: 'TEXT' | 'IN2V') => {
        const safeName = (formData.projectName || 'MV').replace(/[^a-z0-9_]/gi, '_');
        const jobs: VideoJob[] = scenes.map((p,i) => ({
            id: `Job_${i+1}`, 
            prompt: p.prompt_text, 
            status: 'Pending', 
            videoName: `${safeName}_${i+1}`, 
            typeVideo: detectedType === 'IN2V' ? 'IN2V' : '', 
            imagePath: formData.uploadedImages[0]?.name || '', 
            imagePath2: formData.uploadedImages[1]?.name || '', 
            imagePath3: formData.uploadedImages[2]?.name || ''
        }));
        
        const wsData = jobs.map(j => ({
            JOB_ID: j.id, PROMPT: j.prompt, IMAGE_PATH: j.imagePath, IMAGE_PATH_2: j.imagePath2, IMAGE_PATH_3: j.imagePath3, 
            STATUS: '', VIDEO_NAME: j.videoName, TYPE_VIDEO: j.typeVideo
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Prompts');
        const content = XLSX.write(wb, {bookType:'xlsx', type:'array'});
        
        if (ipcRenderer) {
            const res = await ipcRenderer.invoke('save-file-dialog', { defaultPath: `${safeName}.xlsx`, fileContent: content });
            if (res.success) {
                setTrackedFiles(p => [...p, { name: `${safeName}.xlsx`, jobs, path: res.filePath }]);
                setActiveTab('tracker');
                ipcRenderer.send('start-watching-file', res.filePath);
            }
        }
    };

    if (!configLoaded) return <div className="h-screen bg-tet-cream flex items-center justify-center"><ShieldIcon className="animate-spin w-16 h-16 text-tet-red"/></div>;
    if (!isActivated) return <Activation machineId={machineId} onActivate={handleActivate} />;

    const activeApiKey = apiKeys.find(k => k.id === activeApiKeyId);
    const currentFile = trackedFiles[activeTrackerFileIndex];
    const stats = currentFile ? {
        completed: currentFile.jobs.filter(j => j.status === 'Completed').length,
        inProgress: currentFile.jobs.filter(j => ['Processing','Generating'].includes(j.status)).length,
        total: currentFile.jobs.length
    } : null;

    return (
        <div className="h-screen overflow-hidden flex flex-col font-sans text-tet-brown">
            <header className="px-8 py-3 bg-gradient-to-r from-tet-red-dark via-tet-red to-tet-red-dark border-b-4 border-tet-gold shadow-lg flex justify-between items-center z-50 rounded-b-[40px] mx-4 mt-2 shrink-0">
                <div className="flex items-center gap-4" onClick={() => setActiveTab('generator')} style={{cursor:'pointer'}}>
                    <div className="bg-tet-gold p-2 rounded-full border-4 border-tet-red shadow-md animate-bounce-slow">
                        <span className="text-4xl">🐎</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-tet-gold drop-shadow-md">CHÚC MỪNG NĂM MỚI</h1>
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Prompt Generator Pro 2026</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-2xl border-2 border-white/30 mr-2">
                        <FolderIcon className="w-5 h-5 text-tet-gold" />
                        <div className="text-left">
                            <div className="text-[8px] text-white/70 font-black uppercase tracking-widest">Dự án theo dõi</div>
                            <div className="text-sm font-black text-white leading-none">{trackedFiles.length} File Excel</div>
                        </div>
                    </div>

                    <div className="hidden md:block mr-2 text-right">
                        <div className="text-[10px] text-white/70 font-bold uppercase tracking-widest">API Active</div>
                        <div className="text-xs font-black text-tet-gold truncate max-w-[120px]">{activeApiKey?.name || 'Chưa chọn'}</div>
                    </div>
                    <button 
                        onClick={() => setActiveTab(activeTab === 'api-manager' ? 'generator' : 'api-manager')} 
                        className={`p-3 rounded-full shadow-md border-2 border-white transition-all transform hover:rotate-12 ${activeTab === 'api-manager' ? 'bg-white text-tet-red' : 'bg-tet-gold text-tet-red-dark hover:bg-white'}`} 
                        title="Quản lý API Key"
                    >
                        <KeyIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setShowStats(true)} className="p-3 bg-tet-gold text-tet-red-dark rounded-full shadow-md border-2 border-white transition-transform hover:scale-110"><ChartIcon className="w-5 h-5"/></button>
                    <button onClick={() => setShowAdminLogin(true)} className="p-3 bg-tet-red text-white rounded-full shadow-md border-2 border-white transition-transform hover:scale-110"><ShieldIcon className="w-5 h-5"/></button>
                </div>
            </header>

            {activeTab !== 'api-manager' && (
                <div className="flex justify-center gap-4 py-4 shrink-0">
                    <button onClick={() => setActiveTab('generator')} className={`px-8 py-3 rounded-full font-extrabold uppercase text-xs border-2 ${activeTab === 'generator' ? 'bg-tet-red text-white border-tet-gold' : 'bg-white text-tet-brown'}`}>✨ Kịch Bản Tết</button>
                    <button onClick={() => setActiveTab('tracker')} className={`px-8 py-3 rounded-full font-extrabold uppercase text-xs border-2 ${activeTab === 'tracker' ? 'bg-tet-green text-white border-tet-gold' : 'bg-white text-tet-brown'}`}>🎬 Xưởng Phim</button>
                </div>
            )}

            <div className="flex-1 p-6 overflow-hidden">
                <div className="max-w-[1600px] mx-auto h-full overflow-y-auto custom-scrollbar">
                    {activeTab === 'api-manager' ? (
                        <ApiKeyManagerScreen 
                            apiKeys={apiKeys} 
                            onKeySelect={handleKeySelect} 
                            onKeyAdd={handleKeyAdd} 
                            onKeyDelete={handleKeyDelete} 
                        />
                    ) : activeTab === 'generator' ? (
                        <Generator 
                            formData={generatorFormData}
                            setFormData={setGeneratorFormData}
                            presets={presets} 
                            onSavePresets={handleSavePresets} 
                            onGenerateSuccess={handleGenerateSuccess} 
                            onFeedback={setFeedback} 
                            apiKey={activeApiKey?.value}
                            activeApiKeyId={activeApiKeyId}
                        />
                    ) : (
                        <Tracker 
                            trackedFiles={trackedFiles} activeFileIndex={activeTrackerFileIndex} setActiveFileIndex={setActiveTrackerFileIndex} 
                            onOpenFile={async () => {
                                if(ipcRenderer) {
                                    const res = await ipcRenderer.invoke('open-file-dialog');
                                    if(res.success) {
                                        const newFiles = res.files.map((f:any) => {
                                            const wb = XLSX.read(f.content, {type:'buffer'});
                                            const jobs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1}).slice(1).map((r:any,i:number)=>({
                                                id: r[0]||`Job_${i}`, 
                                                prompt: r[1],
                                                imagePath: r[2]||'', 
                                                imagePath2: r[3]||'', 
                                                imagePath3: r[4]||'',
                                                status: r[5]||'Pending', 
                                                videoName: r[6]||'',
                                                typeVideo: r[7]||''
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
                    )}
                </div>
            </div>

            {feedback && (
                <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-10 py-6 rounded-[40px] shadow-2xl bg-white border-4 flex flex-col items-center gap-4 z-[300] animate-fade-in ${feedback.type === 'error' ? 'border-red-500 shadow-red-100' : 'border-tet-gold shadow-yellow-50'}`}>
                    <div className="flex items-center gap-4 w-full">
                        <div className={`p-3 rounded-full ${feedback.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-tet-gold-dark'}`}>
                           {feedback.type === 'error' ? <span className="text-2xl font-black">!</span> : <span className="text-2xl">🏮</span>}
                        </div>
                        <span className={`font-black text-lg ${feedback.type === 'error' ? 'text-red-600' : 'text-stone-700'}`}>{feedback.message}</span>
                        <button 
                            onClick={() => setFeedback(null)} 
                            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 font-bold ml-auto"
                            title="Đóng thông báo"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="w-full h-1 bg-stone-100 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full animate-[shrink_10s_linear_forwards] ${feedback.type === 'error' ? 'bg-red-500' : 'bg-tet-gold'}`}></div>
                    </div>
                </div>
            )}
            {showStats && <StatsModal onClose={() => setShowStats(false)} isAdmin={isAdminLoggedIn} activeApiKeyId={activeApiKeyId} />}
            {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLoginSuccess={() => setIsAdminLoggedIn(true)} />}
            {alertModal && <AlertModal {...alertModal} onClose={() => setAlertModal(null)} />}
            
            <style>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
};

export default App;
