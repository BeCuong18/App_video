
import React, { useState } from 'react';
import { TrackedFile, VideoJob, JobStatus } from '../types';
import { PlayIcon, FolderIcon, TrashIcon, RetryIcon, ExternalLinkIcon, CogIcon, UploadIcon, LoaderIcon, VideoIcon, CopyIcon, LinkIcon } from './Icons';

interface TrackerProps {
    trackedFiles: TrackedFile[];
    activeFileIndex: number;
    setActiveFileIndex: (index: number) => void;
    onOpenFile: () => void;
    onCloseFile: (index: number) => void;
    stats: any; 
    ffmpegFound: boolean | null;
    isCombining: boolean;
    onPlayVideo: (path: string) => void;
    onShowFolder: (path: string) => void;
    onOpenToolFlows: () => void;
    onSetToolFlowPath: () => void;
    onReloadVideos: () => void;
    onRetryStuck: () => void;
    onRetryJob: (id: string) => void;
    onDeleteVideo: (id: string, path: string) => void;
    onCombine: (mode: 'normal' | 'timed') => void;
    onCombineAll: () => void;
    onLinkVideo: (id: string, fileIdx: number) => void;
}

export const Tracker: React.FC<TrackerProps> = (props) => {
    const { trackedFiles, activeFileIndex, setActiveFileIndex, stats } = props;
    const currentFile = trackedFiles[activeFileIndex];
    const [copyFeedback, setCopyFeedback] = useState(false);

    const handleCopyPath = () => {
        if (currentFile?.path) {
            const fullPath = currentFile.path;
            const separator = fullPath.includes('\\') ? '\\' : '/';
            const folderPath = fullPath.substring(0, fullPath.lastIndexOf(separator));

            navigator.clipboard.writeText(folderPath);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        }
    };

    const getStatusBadge = (status: JobStatus) => {
        const base = "status-badge";
        switch (status) {
            case 'Pending': return `${base} status-pending`;
            case 'Processing': return `${base} status-processing`;
            case 'Generating': return `${base} status-generating`;
            case 'Completed': return `${base} status-completed`;
            case 'Failed': return `${base} status-failed`;
            default: return base;
        }
    };

    const renderResultCell = (job: VideoJob) => {
        if (job.status === 'Completed') {
            if (job.videoPath) {
                return (
                    <div className="w-full aspect-video bg-tet-brown rounded-2xl overflow-hidden relative group mx-auto border-4 border-white shadow-md hover:border-tet-gold transition-all duration-300 transform hover:scale-105">
                        <video 
                            src={job.videoPath} 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                            muted 
                            loop 
                            playsInline 
                            onMouseOver={e => e.currentTarget.play().catch(()=>{})} 
                            onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        ></video>
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-[9px] font-bold text-tet-brown bg-white px-2 py-1 rounded-full shadow-sm">Preview</span>
                        </div>
                        <button 
                            onClick={() => props.onPlayVideo(job.videoPath!)} 
                            className="absolute bottom-2 right-2 p-2 bg-tet-gold text-tet-brown rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 hover:bg-white"
                            title="Mở file gốc"
                        >
                            <PlayIcon className="w-3 h-3"/>
                        </button>
                    </div>
                );
            }
            return (
                <div className="w-full aspect-video bg-white rounded-2xl flex flex-col items-center justify-center text-center p-2 mx-auto border-2 border-dashed border-tet-green group hover:border-tet-gold transition-colors">
                    <VideoIcon className="w-6 h-6 text-tet-green mb-2 group-hover:text-tet-gold transition-colors" />
                    <button onClick={() => props.onLinkVideo(job.id, activeFileIndex)} className="text-[10px] font-bold text-tet-green hover:text-white uppercase tracking-wide border border-tet-green hover:border-tet-gold px-3 py-1.5 rounded-full transition-colors bg-white hover:bg-tet-green flex items-center gap-1">
                        <LinkIcon className="w-3 h-3"/> Link File
                    </button>
                </div>
            );
        }
        if (job.status === 'Processing' || job.status === 'Generating') return <div className="w-full aspect-video flex items-center justify-center bg-white rounded-2xl border border-tet-green/30 shadow-inner"><LoaderIcon /></div>;
        return <div className="w-full aspect-video flex items-center justify-center bg-white rounded-2xl border border-tet-green/30"><span className="text-2xl opacity-20 grayscale">🎬</span></div>;
    };

    if (trackedFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[65vh] text-center border-4 border-dashed border-tet-gold/50 rounded-[40px] bg-white/80 animate-fade-in backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full oriental-pattern opacity-5 pointer-events-none"></div>
                
                <div className="flex gap-4 mb-6">
                     <span className="text-6xl animate-bounce-slow filter drop-shadow-md">🍉</span>
                     <span className="text-6xl animate-bounce-slow animation-delay-500 filter drop-shadow-md">🍍</span>
                     <span className="text-6xl animate-bounce-slow animation-delay-1000 filter drop-shadow-md">🥭</span>
                </div>

                <h3 className="text-3xl font-black text-tet-red mb-2 tracking-tight drop-shadow-sm uppercase">Xưởng Phim Ngày Tết</h3>
                <p className="text-tet-brown mb-8 max-w-sm font-bold opacity-80">Mở file Excel để bắt đầu khai máy đầu xuân nào!</p>
                
                <button onClick={props.onOpenFile} className="bg-gradient-to-r from-tet-red to-tet-red-dark text-tet-gold font-black py-4 px-10 rounded-full hover:shadow-xl transition shadow-lg shadow-red-500/30 uppercase tracking-widest text-sm transform hover:scale-105 border-4 border-tet-gold">
                    📂 Mở Dự Án Mới
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-[75vh] glass-card rounded-[40px] overflow-hidden border-4 border-tet-gold shadow-2xl bg-white/90">
            {/* Sidebar (Vertical List) - RED SCROLL STYLE */}
            <div className="w-72 bg-tet-red border-r-4 border-tet-gold flex flex-col shrink-0 relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-10 pointer-events-none"></div>
                
                <div className="p-4 border-b border-white/20 relative z-10">
                    <button onClick={props.onOpenFile} className="w-full bg-tet-gold hover:bg-white text-tet-red-dark font-extrabold py-3.5 px-4 rounded-2xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider transform hover:rotate-1 border-2 border-tet-red">
                        <UploadIcon className="w-4 h-4" /> Mở Dự Án Mới
                    </button>
                    <div className="mt-3 text-[10px] text-tet-gold font-black uppercase tracking-widest text-center bg-black/20 py-1 rounded-lg">
                        Đang theo dõi: {trackedFiles.length} file
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative z-10">
                    {trackedFiles.map((file, idx) => {
                        const isActive = idx === activeFileIndex;
                        const progress = file.jobs.length > 0 ? (file.jobs.filter(j=>j.status==='Completed').length / file.jobs.length) * 100 : 0;
                        return (
                            <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group relative p-3 rounded-2xl cursor-pointer transition-all border-2 ${isActive ? 'bg-tet-gold border-white shadow-lg transform scale-[1.02]' : 'bg-black/10 border-transparent hover:bg-black/20 hover:border-tet-gold/50'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`font-bold text-xs truncate w-44 ${isActive ? 'text-tet-red-dark' : 'text-white group-hover:text-tet-gold'}`}>{file.name}</span>
                                    <button onClick={(e) => {e.stopPropagation(); props.onCloseFile(idx);}} className={`p-1 w-6 h-6 flex items-center justify-center rounded-full transition leading-none font-bold ${isActive ? 'bg-white text-tet-red hover:scale-110' : 'text-white/50 hover:bg-red-900 hover:text-white'}`}>&times;</button>
                                </div>
                                {/* Progress Bar Background */}
                                <div className={`w-full h-2 rounded-full overflow-hidden ${isActive ? 'bg-white/50' : 'bg-black/30'}`}>
                                    {/* Progress Bar Fill */}
                                    <div className={`h-full transition-all duration-500 rounded-full ${progress === 100 ? 'bg-tet-green' : 'bg-white'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="flex justify-between mt-1.5">
                                    <span className={`text-[9px] uppercase tracking-wider font-bold ${isActive ? 'text-tet-red-dark/70' : 'text-white/70'}`}>Tiến độ</span>
                                    <span className={`text-[9px] font-mono font-bold ${isActive ? 'text-tet-red-dark' : 'text-white'}`}>{Math.round(progress)}%</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-4 border-t border-white/20 bg-tet-red-dark/30 relative z-10">
                    <button onClick={props.onCombineAll} disabled={props.isCombining} className="w-full bg-white hover:bg-tet-gold text-tet-red font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 transition border-4 border-white transform hover:-translate-y-0.5">
                        {props.isCombining ? 'Đang Xử Lý...' : '⚡ Ghép Tất Cả'}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-tet-cream relative overflow-hidden min-w-0">
                
                {/* Toolbar Header - Responsive Wrap */}
                <div className="p-4 border-b-2 border-tet-gold bg-white/50 flex items-center justify-between flex-wrap gap-4 z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="text-center px-4 py-1.5 bg-emerald-100 rounded-2xl border border-white shadow-sm min-w-[80px]">
                            <div className="text-xl font-black text-emerald-600 leading-none">{stats?.completed || 0}/{stats?.total || 0}</div>
                            <div className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest mt-0.5">Xong</div>
                        </div>
                        <div className="text-center px-4 py-1.5 bg-blue-100 rounded-2xl border border-white shadow-sm min-w-[80px]">
                            <div className="text-xl font-black text-blue-500 leading-none">{stats?.inProgress || 0}</div>
                            <div className="text-[9px] text-blue-400 uppercase font-bold tracking-widest mt-0.5">Xử lý</div>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                        <button onClick={props.onReloadVideos} className="bg-white hover:bg-blue-50 text-blue-500 px-4 py-2.5 rounded-xl shadow-sm border border-stone-100 transition transform hover:scale-105 flex items-center gap-2 font-bold text-xs" title="Tải lại video">
                            <RetryIcon className="w-4 h-4"/> <span>Tải lại</span>
                        </button>
                        <button onClick={props.onRetryStuck} className="bg-white hover:bg-yellow-50 text-yellow-500 px-4 py-2.5 rounded-xl shadow-sm border border-stone-100 transition transform hover:scale-105 flex items-center gap-2 font-bold text-xs" title="Reset job bị kẹt">
                            <ExternalLinkIcon className="w-4 h-4"/> <span>Reset Lỗi</span>
                        </button>
                        
                        <div className="h-6 w-0.5 bg-stone-200 mx-1 rounded-full hidden md:block"></div>
                        
                        <div className="flex items-center gap-1">
                            <button onClick={props.onOpenToolFlows} className="bg-tet-brown hover:bg-stone-700 text-white px-4 py-2.5 rounded-xl shadow-md font-bold text-xs flex items-center gap-2 uppercase tracking-wide transform hover:scale-105 border-2 border-stone-300">
                                <PlayIcon className="w-3 h-3"/> Mở ToolFlows
                            </button>
                            <button onClick={props.onSetToolFlowPath} className="bg-stone-200 hover:bg-stone-300 text-stone-600 p-2.5 rounded-xl shadow-sm transition transform hover:scale-105 border-2 border-stone-100" title="Cài đặt đường dẫn ToolFlows">
                                <CogIcon className="w-4 h-4"/>
                            </button>
                        </div>
                        
                        <button onClick={() => props.onShowFolder(currentFile.path!)} className="bg-stone-200 hover:bg-stone-300 text-stone-600 px-4 py-2.5 rounded-xl shadow-sm transition transform hover:scale-105 flex items-center gap-2 font-bold text-xs" title="Mở thư mục">
                            <FolderIcon className="w-4 h-4"/> <span>Mở Thư Mục</span>
                        </button>

                        <button onClick={handleCopyPath} className="bg-stone-100 hover:bg-tet-gold hover:text-white text-stone-500 px-4 py-2.5 rounded-xl shadow-sm transition transform hover:scale-105 flex items-center gap-2 font-bold text-xs" title="Copy đường dẫn thư mục">
                            <CopyIcon className="w-4 h-4"/> <span>{copyFeedback ? 'Đã Copy!' : 'Copy Path'}</span>
                        </button>
                    </div>
                </div>

                {/* Combine Actions Bar */}
                {props.ffmpegFound && (
                    <div className="px-6 py-3 bg-white/40 border-b border-white flex gap-3 z-10 shrink-0">
                        <button onClick={() => props.onCombine('normal')} disabled={props.isCombining} className="bg-tet-green hover:bg-emerald-600 text-white px-6 py-2 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-widest disabled:opacity-50 transition border-2 border-white">Ghép Thường</button>
                        <button onClick={() => props.onCombine('timed')} disabled={props.isCombining} className="bg-blue-400 hover:bg-blue-500 text-white px-6 py-2 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-widest disabled:opacity-50 transition border-2 border-white">Ghép Theo Nhạc</button>
                    </div>
                )}

                {/* Job Table - Fixed Layout */}
                <div className="flex-1 overflow-auto custom-scrollbar p-0 z-0 bg-tet-cream">
                    <table className="w-full text-tet-brown job-table border-collapse table-fixed min-w-[800px]">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="w-20 text-center rounded-tl-2xl">ID</th>
                                <th className="w-32 text-center">Status</th>
                                <th className="w-auto text-left pl-6">Video Name</th>
                                <th className="w-64 text-center">Preview</th>
                                <th className="w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentFile.jobs.map((job) => (
                                <tr key={job.id} className="transition-colors group hover:bg-white border-b-2 border-white">
                                    <td className="font-mono text-xs text-center font-bold text-stone-400 bg-white/40 group-hover:bg-white">{job.id.replace('Job_', '')}</td>
                                    <td className="text-center bg-white/40 group-hover:bg-white"><span className={getStatusBadge(job.status)}>{job.status}</span></td>
                                    <td className="pl-6 font-mono text-xs text-tet-brown font-medium truncate bg-white/40 group-hover:bg-white" title={job.videoName}>{job.videoName}</td>
                                    <td className="py-4 px-2 text-center bg-white/40 group-hover:bg-white">{renderResultCell(job)}</td>
                                    <td className="bg-white/40 group-hover:bg-white">
                                        <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {job.videoPath && (
                                                <button onClick={() => props.onDeleteVideo(job.id, job.videoPath!)} className="p-2 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 rounded-full transition" title="Xóa video"><TrashIcon className="w-4 h-4"/></button>
                                            )}
                                            <button onClick={() => props.onRetryJob(job.id)} className="p-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-500 hover:text-yellow-600 rounded-full transition" title="Reset trạng thái"><RetryIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
