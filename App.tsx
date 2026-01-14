
import React, { useState, useEffect, useRef } from 'react';
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
    
    // Web file input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sử dụng ref để giữ trackedFiles mới nhất cho interval mà không cần reset interval liên tục
    const trackedFilesRef = useRef<TrackedFile[]>([]);
    useEffect(() => { trackedFilesRef.current = trackedFiles; }, [trackedFiles]);

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
            } else {
                // WEB MODE INITIALIZATION
                const savedPresets = localStorage.getItem('presets');
                if (savedPresets) setPresets(JSON.parse(savedPresets));
                
                const savedKeysStr = localStorage.getItem('api-keys');
                if (savedKeysStr) savedKeys = JSON.parse(savedKeysStr);
                
                currentMachineId = 'WEB-CLIENT-' + Math.random().toString(36).substring(7);
                currentLicense = localStorage.getItem('license-key') || '';
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
        } else {
            localStorage.setItem('presets', JSON.stringify(newPresets));
        }
    };

    const handleActivate = async (key: string) => {
        if (key && key.trim().length > 5) {
            if (ipcRenderer) {
                await ipcRenderer.invoke('save-app-config', { licenseKey: key.trim() });
            }
            setIsActivated(true);
            localStorage.setItem('license-key', key.trim());
            return true;
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
        const currentFiles = trackedFilesRef.current;
        if (currentFiles.length === 0) return;

        try {
            const promises = currentFiles.map(async (file) => {
                if (!file.path) return file;
                try {
                    const res = await ipcRenderer.invoke('find-videos-for-jobs', { jobs: file.jobs, excelFilePath: file.path });
                    if (res.success) {
                        return { ...file, jobs: res.jobs };
                    }
                } catch (e) { 
                    return file; 
                }
                return file;
            });

            const updatedFiles = await Promise.all(promises);
            setTrackedFiles(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(updatedFiles)) {
                    return updatedFiles;
                }
                return prev;
            });
        } catch (error) {
            console.error("Auto reload error:", error);
        }
    };

    useEffect(() => {
        let interval: any;
        if (activeTab === 'tracker' && isElectron) {
            handleReloadVideos();
            interval = setInterval(handleReloadVideos, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

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
            imagePath: formData.uploadedImages[0]?.path || formData.uploadedImages[0]?.name || '', 
            imagePath2: formData.uploadedImages[1]?.path || formData.uploadedImages[1]?.name || '', 
            imagePath3: formData.uploadedImages[2]?.path || formData.uploadedImages[2]?.name || ''
        }));
        
        const wsData = jobs.map(j => ({
            JOB_ID: j.id, PROMPT: j.prompt, IMAGE_PATH: j.imagePath, IMAGE_PATH_2: j.imagePath2, IMAGE_PATH_3: j.imagePath3, 
            STATUS: '', VIDEO_NAME: j.videoName, TYPE_VIDEO: j.typeVideo
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Prompts');
        
        if (ipcRenderer) {
            const content = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            const res = await ipcRenderer.invoke('save-file-dialog', { defaultPath: `${safeName}.xlsx`, fileContent: content });
            if (res.success) {
                setTrackedFiles(p => [...p, { name: `${safeName}.xlsx`, jobs, path: res.filePath }]);
                setActiveTab('tracker');
                ipcRenderer.send('start-watching-file', res.filePath);
            }
        } else {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setTrackedFiles(p => [...p, { name: `${safeName}.xlsx`, jobs, path: '' }]);
            setActiveTab('tracker');
            setFeedback({ type: 'success', message: 'Đã tải xuống file Excel!' });
        }
    };

    const handleWebOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1) as any[][];
            
            const jobs: VideoJob[] = data.map((r,i) => ({
                 id: r[0]||`job_${i}`, prompt: r[1]||'', 
                 imagePath: r[2]||'', imagePath2: r[3]||'', imagePath3: r[4]||'',
                 status: r[5] as any || 'Pending',
                 videoName: r[6]||'', typeVideo: r[7]||'', videoPath: r[8]||undefined
            }));
            
            setTrackedFiles(prev => [...prev, { name: file.name, jobs, path: '' }]);
            setFeedback({ type: 'success', message: `Đã mở file ${file.name} (Chế độ Xem Web)` });
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!configLoaded) return <div className="h-screen bg-mac-bg flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-mac-accent border-t-transparent animate-spin"></div></div>;
    if (!isActivated) return <Activation machineId={machineId} onActivate={handleActivate} />;

    const activeApiKey = apiKeys.find(k => k.id === activeApiKeyId);
    const currentFile = trackedFiles[activeTrackerFileIndex];
    const stats = currentFile ? {
        completed: currentFile.jobs.filter(j => j.status === 'Completed').length,
        inProgress: currentFile.jobs.filter(j => ['Processing','Generating'].includes(j.status)).length,
        total: currentFile.jobs.length
    } : null;

    return (
        <div className="h-screen overflow-hidden flex flex-col font-sans text-mac-text bg-mac-bg">
            <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".xlsx" onChange={handleWebOpenFile}/>

            {/* macOS Glass Header */}
            <header className="glass-panel z-50 px-6 py-4 flex items-center justify-between shrink-0 h-18">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-mac bg-gradient-to-br from-mac-accent to-blue-600 flex items-center justify-center text-white shadow-mac-card">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-mac-text leading-none tracking-tight">Prompt Generator</h1>
                        <p className="text-[11px] text-mac-text-sec font-medium mt-1">Phiên bản Pro</p>
                    </div>
                </div>

                {/* macOS Big Tabs (Segmented Control style but larger) */}
                {activeTab !== 'api-manager' && (
                    <div className="bg-mac-gray-light/60 p-1.5 rounded-xl flex gap-1 shadow-inner backdrop-blur-md">
                        <button 
                            onClick={() => setActiveTab('generator')}
                            className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'generator' ? 'bg-white shadow-sm text-mac-text scale-[1.02]' : 'text-mac-text-sec hover:text-mac-text hover:bg-white/50'}`}
                        >
                            Tạo Kịch Bản
                        </button>
                        <button 
                            onClick={() => setActiveTab('tracker')}
                            className={`px-8 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'tracker' ? 'bg-white shadow-sm text-mac-text scale-[1.02]' : 'text-mac-text-sec hover:text-mac-text hover:bg-white/50'}`}
                        >
                            Xưởng Phim
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 rounded-lg border border-mac-border/30 backdrop-blur-sm">
                        <div className={`w-2 h-2 rounded-full ${activeApiKey ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-medium text-mac-text-sec truncate max-w-[100px]">{activeApiKey?.name || 'Chưa chọn Key'}</span>
                    </div>

                    <div className="flex items-center bg-white/50 rounded-lg p-1 border border-mac-border/30">
                        <button onClick={() => setActiveTab(activeTab === 'api-manager' ? 'generator' : 'api-manager')} className={`p-2 rounded-md transition ${activeTab === 'api-manager' ? 'bg-mac-accent text-white shadow-sm' : 'text-mac-text-sec hover:bg-black/5'}`}>
                            <KeyIcon className="w-5 h-5"/>
                        </button>
                        <div className="w-px h-4 bg-mac-border/50 mx-1"></div>
                        <button onClick={() => setShowStats(true)} className="p-2 text-mac-text-sec hover:bg-black/5 rounded-md transition">
                            <ChartIcon className="w-5 h-5"/>
                        </button>
                        {isElectron && (
                            <button onClick={() => setShowAdminLogin(true)} className="p-2 text-mac-text-sec hover:bg-black/5 rounded-md transition">
                                <ShieldIcon className="w-5 h-5"/>
                            </button>
                        )}
                    </div>
                </div>
            </header>

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
                                } else {
                                    if(fileInputRef.current) fileInputRef.current.click();
                                }
                            }} 
                            onCloseFile={(idx) => {
                                const f = trackedFiles[idx];
                                if(f.path && ipcRenderer) ipcRenderer.send('stop-watching-file', f.path);
                                setTrackedFiles(p => p.filter((_,i) => i !== idx));
                                if(activeTrackerFileIndex >= idx) setActiveTrackerFileIndex(Math.max(0, activeTrackerFileIndex - 1));
                            }} 
                            stats={stats} ffmpegFound={ffmpegFound} isCombining={isCombining}
                            isElectron={!!isElectron}
                            onPlayVideo={(path) => {
                                if(ipcRenderer) ipcRenderer.send('open-video-path', path);
                            }} 
                            onShowFolder={(path) => ipcRenderer && ipcRenderer.send('open-folder', path.substring(0, path.lastIndexOf(navigator.userAgent.includes("Windows")?'\\':'/')))} 
                            onOpenToolFlows={() => ipcRenderer && ipcRenderer.invoke('open-tool-flow')} 
                            onSetToolFlowPath={handleSetToolFlowPath}
                            onReloadVideos={handleReloadVideos} 
                            onRetryStuck={() => currentFile?.path && ipcRenderer && ipcRenderer.invoke('retry-stuck-jobs', {filePath: currentFile.path})} 
                            onRetryJob={(id) => currentFile?.path && ipcRenderer && ipcRenderer.invoke('retry-job', {filePath: currentFile.path, jobId: id})} 
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
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-mac-float bg-white/80 backdrop-blur-md border border-white/20 flex items-center gap-3 z-[300] animate-slide-up`}>
                    <div className={`w-2 h-2 rounded-full ${feedback.type === 'error' ? 'bg-red-500' : feedback.type === 'success' ? 'bg-green-500' : 'bg-mac-accent'}`}></div>
                    <span className="text-sm font-medium text-mac-text">{feedback.message}</span>
                </div>
            )}
            {showStats && <StatsModal onClose={() => setShowStats(false)} isAdmin={isAdminLoggedIn} activeApiKeyId={activeApiKeyId} />}
            {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLoginSuccess={() => setIsAdminLoggedIn(true)} />}
            {alertModal && <AlertModal {...alertModal} onClose={() => setAlertModal(null)} />}
        </div>
    );
};

export default App;
