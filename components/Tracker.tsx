
import React, { useState } from 'react';
import { TrackedFile, VideoJob, JobStatus } from '../types';
import { PlayIcon, FolderIcon, TrashIcon, RetryIcon, ExternalLinkIcon, UploadIcon, LoaderIcon, LinkIcon, CogIcon } from './Icons';

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
        const base = "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 ";
        switch (status) {
            case 'Pending': return base + "bg-stone-100 text-stone-400 border-stone-200";
            case 'Processing': return base + "bg-blue-50 text-blue-500 border-blue-200 animate-pulse";
            case 'Generating': return base + "bg-amber-50 text-amber-500 border-amber-200 animate-pulse";
            case 'Completed': return base + "bg-emerald-50 text-emerald-600 border-emerald-200";
            case 'Failed': return base + "bg-red-50 text-red-500 border-red-200";
            default: return base;
        }
    };

    const resolveImagePath = (imgName: string) => {
        if (!imgName || !currentFile?.path) return null;
        const separator = currentFile.path.includes('\\') ? '\\' : '/';
        const dir = currentFile.path.substring(0, currentFile.path.lastIndexOf(separator));
        return `file://${dir}${separator}${imgName}`;
    };

    const renderSourceImages = (job: VideoJob) => {
        const images = [job.imagePath, job.imagePath2, job.imagePath3].filter(Boolean);
        if (images.length === 0) return <span className="text-[10px] text-stone-300 italic">Không có ảnh</span>;

        return (
            <div className="flex -space-x-2 hover:space-x-1 transition-all">
                {images.map((img, i) => {
                    const src = resolveImagePath(img);
                    return (
                        <div key={i} className="w-10 h-10 rounded-lg border-2 border-white shadow-sm overflow-hidden bg-stone-100 relative group/img">
                            <img 
                                src={src || ''} 
                                alt="source" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=ERR';
                                }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[8px] text-white font-bold">{i+1}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderResultCell = (job: VideoJob) => {
        if (job.status === 'Completed') {
            if (job.videoPath) {
                return (
                    <div className="w-full max-w-[160px] aspect-video bg-tet-brown rounded-xl overflow-hidden relative group mx-auto border-2 border-white shadow-md hover:border-tet-gold transition-all">
                        <video 
                            src={job.videoPath} 
                            className="w-full h-full object-cover" 
                            muted 
                            onMouseOver={e => e.currentTarget.play().catch(()=>{})} 
                            onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        ></video>
                        <button 
                            onClick={() => props.onPlayVideo(job.videoPath!)} 
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <PlayIcon className="w-6 h-6 text-white"/>
                        </button>
                    </div>
                );
            }
            return (
                <button onClick={() => props.onLinkVideo(job.id, activeFileIndex)} className="text-[9px] font-black text-tet-green border-2 border-dashed border-tet-green px-3 py-2 rounded-xl hover:bg-tet-green hover:text-white transition-all flex items-center gap-1 mx-auto">
                    <LinkIcon className="w-3 h-3"/> LINK VIDEO
                </button>
            );
        }
        if (job.status === 'Processing' || job.status === 'Generating') return <div className="flex justify-center"><LoaderIcon /></div>;
        return <span className="text-stone-300 text-[10px] font-bold italic">CHỜ XỬ LÝ...</span>;
    };

    if (trackedFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[65vh] text-center border-4 border-dashed border-tet-gold/50 rounded-[40px] bg-white/80 animate-fade-in backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full oriental-pattern opacity-5 pointer-events-none"></div>
                <div className="flex gap-4 mb-6">
                     <span className="text-6xl animate-bounce-slow filter drop-shadow-md">🎬</span>
                </div>
                <h3 className="text-3xl font-black text-tet-red mb-2 tracking-tight drop-shadow-sm uppercase">Xưởng Phim Ngày Tết</h3>
                <p className="text-tet-brown mb-8 max-w-sm font-bold opacity-80">Mở file Excel kịch bản để theo dõi tiến độ sản xuất!</p>
                <button onClick={props.onOpenFile} className="bg-gradient-to-r from-tet-red to-tet-red-dark text-tet-gold font-black py-4 px-10 rounded-full hover:shadow-xl transition shadow-lg uppercase tracking-widest text-sm transform hover:scale-105 border-4 border-tet-gold">
                    📂 Mở Dự Án Mới
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-[75vh] glass-card rounded-[40px] overflow-hidden border-4 border-tet-gold shadow-2xl bg-white/90">
            {/* Sidebar (File List) */}
            <div className="w-64 bg-tet-red-dark border-r-4 border-tet-gold flex flex-col shrink-0">
                <div className="p-4 border-b border-white/10">
                    <button onClick={props.onOpenFile} className="w-full bg-tet-gold hover:bg-white text-tet-red-dark font-black py-3 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider">
                        <UploadIcon className="w-4 h-4" /> THÊM DỰ ÁN
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {trackedFiles.map((file, idx) => (
                        <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group relative p-3 rounded-2xl cursor-pointer transition-all border-2 ${idx === activeFileIndex ? 'bg-tet-gold border-white shadow-lg' : 'bg-black/20 border-transparent hover:bg-black/30'}`}>
                            <div className="flex justify-between items-center">
                                <span className={`font-black text-[10px] truncate w-40 uppercase ${idx === activeFileIndex ? 'text-tet-red-dark' : 'text-white/80'}`}>{file.name}</span>
                                <button onClick={(e) => {e.stopPropagation(); props.onCloseFile(idx);}} className={`text-lg font-bold ${idx === activeFileIndex ? 'text-tet-red' : 'text-white/30 hover:text-white'}`}>&times;</button>
                            </div>
                            <div className="mt-2 h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white transition-all" style={{ width: `${(file.jobs.filter(j=>j.status==='Completed').length / (file.jobs.length || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-tet-cream overflow-hidden">
                {/* Header Actions */}
                <div className="p-4 bg-white/60 border-b-2 border-tet-gold flex items-center justify-between flex-wrap gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-white px-4 py-2 rounded-2xl border-2 border-stone-100 shadow-sm">
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Hoàn thành</span>
                            <span className="text-xl font-black text-tet-green">{stats?.completed || 0}/{stats?.total || 0}</span>
                        </div>
                        <button onClick={props.onReloadVideos} className="px-4 py-2.5 bg-white hover:bg-stone-50 text-blue-500 rounded-2xl border-2 border-stone-100 shadow-sm transition flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                            <RetryIcon className="w-4 h-4"/> TẢI LẠI VIDEO
                        </button>
                        <button onClick={props.onRetryStuck} className="px-4 py-2.5 bg-white hover:bg-stone-50 text-amber-500 rounded-2xl border-2 border-stone-100 shadow-sm transition flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                            <ExternalLinkIcon className="w-4 h-4"/> RESET LỖI
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-tet-red rounded-2xl border-2 border-white shadow-md overflow-hidden">
                            <button onClick={props.onOpenToolFlows} className="hover:bg-tet-red-dark text-white px-5 py-2.5 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors">
                                <PlayIcon className="w-3 h-3"/> MỞ TOOLFLOWS
                            </button>
                            <div className="w-px h-6 bg-white/30"></div>
                            <button onClick={props.onSetToolFlowPath} className="hover:bg-tet-red-dark text-white p-2.5 transition-colors" title="Cài đặt đường dẫn Tool">
                                <CogIcon className="w-4 h-4"/>
                            </button>
                        </div>
                        <button onClick={() => props.onShowFolder(currentFile.path!)} className="bg-stone-200 hover:bg-stone-300 text-stone-600 px-4 py-2.5 rounded-2xl transition flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                            <FolderIcon className="w-4 h-4"/> THƯ MỤC
                        </button>
                        <button onClick={handleCopyPath} className="bg-stone-200 hover:bg-tet-gold hover:text-white text-stone-600 px-4 py-2.5 rounded-2xl font-black text-[10px] transition uppercase tracking-widest">
                            {copyFeedback ? 'ĐÃ COPY' : 'COPY PATH'}
                        </button>
                    </div>
                </div>

                {/* Combine Actions */}
                {props.ffmpegFound && (
                    <div className="px-6 py-2 bg-white/40 border-b border-stone-200 flex gap-2 overflow-x-auto">
                        <button onClick={() => props.onCombine('normal')} disabled={props.isCombining} className="bg-tet-green text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm hover:brightness-110 disabled:opacity-50 transition whitespace-nowrap">Ghép Thường</button>
                        <button onClick={() => props.onCombine('timed')} disabled={props.isCombining} className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm hover:brightness-110 disabled:opacity-50 transition whitespace-nowrap">Ghép Theo Nhạc</button>
                        <button onClick={props.onCombineAll} disabled={props.isCombining} className="bg-tet-gold text-tet-brown px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm hover:brightness-110 disabled:opacity-50 transition whitespace-nowrap">Ghép Tất Cả</button>
                    </div>
                )}

                {/* Job Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-stone-50 z-10">
                            <tr className="border-b-2 border-stone-200">
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest w-16">ID</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest w-28">Trạng thái</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest">Tên Video</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest w-40 text-center">Kết quả</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest w-40 text-center">Ảnh gốc</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest w-36 text-center">Xử lý</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {currentFile.jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-white/60 transition-colors group">
                                    <td className="px-4 py-4 font-black text-xs text-stone-400">{job.id.replace('Job_', '')}</td>
                                    <td className="px-4 py-4"><span className={getStatusBadge(job.status)}>{job.status}</span></td>
                                    <td className="px-4 py-4">
                                        <div className="text-[11px] font-bold text-tet-brown truncate max-w-[250px]" title={job.videoName}>{job.videoName}</div>
                                        <div className="text-[9px] text-stone-400 font-mono mt-1 uppercase">{job.typeVideo}</div>
                                    </td>
                                    <td className="px-4 py-4">{renderResultCell(job)}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-center">
                                            {renderSourceImages(job)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {job.videoPath && (
                                                <button onClick={() => props.onDeleteVideo(job.id, job.videoPath!)} className="px-2 py-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition flex items-center gap-1 font-black text-[8px] uppercase tracking-tighter">
                                                    <TrashIcon className="w-3 h-3"/> XÓA
                                                </button>
                                            )}
                                            <button onClick={() => props.onRetryJob(job.id)} className="px-2 py-1.5 bg-stone-100 text-stone-500 rounded-lg hover:bg-stone-200 transition flex items-center gap-1 font-black text-[8px] uppercase tracking-tighter">
                                                <RetryIcon className="w-3 h-3"/> THỬ LẠI
                                            </button>
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
