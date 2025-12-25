
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { TrackedFile, VideoJob, Preset, FormData } from './types';
import { Activation } from './components/Activation';
import { StatsModal, AdminLoginModal, AlertModal } from './components/AppModals';
import { Generator } from './components/Generator';
import { Tracker } from './components/Tracker';
import { ChartIcon, ShieldIcon } from './components/Icons';

const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const ipcRenderer = isElectron && (window as any).require ? (window as any).require('electron').ipcRenderer : null;

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'generator' | 'tracker'>('generator');
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

    useEffect(() => {
        if (!ipcRenderer) { setIsActivated(true); setConfigLoaded(true); return; }
        ipcRenderer.invoke('get-app-config').then((config: any) => {
            setMachineId(config.machineId || '');
            setIsActivated(!!config.licenseKey);
            if (config.presets) setPresets(config.presets);
            setConfigLoaded(true);
        });
        
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
    }, []); 

    const handleGenerateSuccess = async (scenes: any[], formData: FormData) => {
        const safeName = (formData.projectName || 'MV').replace(/[^a-z0-9_]/gi, '_');
        const jobs: VideoJob[] = scenes.map((p,i) => ({
            id: `Job_${i+1}`, 
            prompt: p.prompt_text, 
            status: 'Pending', 
            videoName: `${safeName}_${i+1}`, 
            typeVideo: formData.videoType === 'in2v' ? 'IN2V' : 'TEXT',
            imagePath: formData.uploadedImages[0]?.name || '', 
            imagePath2: formData.uploadedImages[1]?.name || '', 
            imagePath3: formData.uploadedImages[2]?.name || ''
        }));
        
        const wsData = jobs.map(j => ({
            JOB_ID: j.id, PROMPT: j.prompt, IMAGE_PATH: j.imagePath, IMAGE_PATH_2: j.imagePath2, IMAGE_PATH_3: j.imagePath3, 
            STATUS: j.status, VIDEO_NAME: j.videoName, TYPE_VIDEO: j.typeVideo
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
    if (!isActivated) return <Activation machineId={machineId} onActivate={async () => true} />;

    return (
        <div className="h-screen overflow-hidden flex flex-col font-sans text-tet-brown">
            <header className="px-8 py-3 bg-gradient-to-r from-tet-red-dark via-tet-red to-tet-red-dark border-b-4 border-tet-gold shadow-lg flex justify-between items-center z-50 rounded-b-[40px] mx-4 mt-2 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-tet-gold p-2 rounded-full border-4 border-tet-red shadow-md animate-bounce-slow">
                        <span className="text-4xl">🐎</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-tet-gold drop-shadow-md">CHÚC MỪNG NĂM MỚI</h1>
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Prompt Generator Pro 2026</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowStats(true)} className="p-3 bg-tet-gold text-tet-red-dark rounded-full shadow-md border-2 border-white"><ChartIcon className="w-5 h-5"/></button>
                    <button onClick={() => setShowAdminLogin(true)} className="p-3 bg-tet-red text-white rounded-full shadow-md border-2 border-white"><ShieldIcon className="w-5 h-5"/></button>
                </div>
            </header>

            <div className="flex justify-center gap-4 py-4 shrink-0">
                <button onClick={() => setActiveTab('generator')} className={`px-8 py-3 rounded-full font-extrabold uppercase text-xs border-2 ${activeTab === 'generator' ? 'bg-tet-red text-white border-tet-gold' : 'bg-white text-tet-brown'}`}>✨ Kịch Bản Tết</button>
                <button onClick={() => setActiveTab('tracker')} className={`px-8 py-3 rounded-full font-extrabold uppercase text-xs border-2 ${activeTab === 'tracker' ? 'bg-tet-green text-white border-tet-gold' : 'bg-white text-tet-brown'}`}>🎬 Xưởng Phim</button>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
                <div className="max-w-[1600px] mx-auto h-full overflow-y-auto custom-scrollbar">
                    {activeTab === 'generator' ? (
                        <Generator presets={presets} onSavePresets={p => setPresets(p)} onGenerateSuccess={handleGenerateSuccess} onFeedback={setFeedback} />
                    ) : (
                        <Tracker 
                            trackedFiles={trackedFiles} activeFileIndex={activeTrackerFileIndex} setActiveFileIndex={setActiveTrackerFileIndex} 
                            onOpenFile={() => {}} onCloseFile={() => {}} stats={{}} ffmpegFound={ffmpegFound} isCombining={isCombining}
                            onPlayVideo={() => {}} onShowFolder={() => {}} onOpenToolFlows={() => {}} onSetToolFlowPath={() => {}}
                            onReloadVideos={() => {}} onRetryStuck={() => {}} onRetryJob={() => {}} onDeleteVideo={() => {}}
                            onCombine={() => {}} onCombineAll={() => {}} onLinkVideo={() => {}}
                        />
                    )}
                </div>
            </div>

            {feedback && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-3xl shadow-2xl bg-white border-2 border-tet-gold z-[200]">{feedback.message}</div>}
            {showStats && <StatsModal onClose={() => setShowStats(false)} isAdmin={isAdminLoggedIn} onDeleteAll={() => {}} onDeleteHistory={() => {}} />}
            {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLoginSuccess={() => setIsAdminLoggedIn(true)} />}
            {alertModal && <AlertModal {...alertModal} onClose={() => setAlertModal(null)} />}
        </div>
    );
};

export default App;
