
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
    isElectron: boolean;
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
    const { trackedFiles, activeFileIndex, setActiveFileIndex, stats, isElectron } = props;
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
        const base = "px-2.5 py-1 rounded-full text-[10px] font-bold ";
        switch (status) {
            case 'Pending': return base + "bg-gray-100 text-gray-500";
            case 'Processing': return base + "bg-blue-100 text-blue-600 animate-pulse";
            case 'Generating': return base + "bg-yellow-100 text-yellow-600 animate-pulse";
            case 'Completed': return base + "bg-green-100 text-green-600";
            case 'Failed': return base + "bg-red-100 text-red-600";
            default: return base;
        }
    };

    const resolveImagePath = (imgName: string) => {
        if (!imgName || !currentFile?.path || !isElectron) return null;
        const separator = currentFile.path.includes('\\') ? '\\' : '/';
        const dir = currentFile.path.substring(0, currentFile.path.lastIndexOf(separator));
        return `file://${dir}${separator}${imgName}`;
    };

    const renderSourceImages = (job: VideoJob) => {
        const images = [job.imagePath, job.imagePath2, job.imagePath3].filter(Boolean);
        if (images.length === 0) return <span className="text-[10px] text-gray-300 italic">--</span>;

        return (
            <div className="flex -space-x-2 hover:space-x-1 transition-all">
                {images.map((img, i) => {
                    const src = isElectron ? resolveImagePath(img) : null;
                    return (
                        <div key={i} className="w-8 h-8 rounded-lg bg-mac-surface-sec border border-white shadow-sm overflow-hidden relative group/img cursor-help">
                            {src ? (
                                <img 
                                    src={src} 
                                    alt="source" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=NA'; }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[6px] text-gray-500 p-0.5 text-center">
                                    {img.slice(0, 4)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderResultCell = (job: VideoJob) => {
        if (job.status === 'Completed') {
            if (job.videoPath) {
                if (!isElectron) {
                    return <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Desktop Only</span>
                }
                return (
                    <div className="w-32 aspect-video bg-black rounded-lg overflow-hidden relative group mx-auto shadow-sm hover:shadow-mac-card transition-all">
                        <video 
                            src={job.videoPath} 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                            muted playsInline
                            onMouseEnter={e => { e.currentTarget.play().catch(() => {}); }} 
                            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        ></video>
                        <button 
                            onClick={() => props.onPlayVideo(job.videoPath!)} 
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition border border-white/50">
                                <PlayIcon className="w-4 h-4 text-white ml-0.5"/>
                            </div>
                        </button>
                    </div>
                );
            }
            return (
                <button onClick={() => props.onLinkVideo(job.id, activeFileIndex)} className="text-[10px] font-semibold text-mac-accent border border-dashed border-mac-accent/30 px-3 py-1.5 rounded hover:bg-blue-50 transition-all flex items-center gap-1 mx-auto">
                    <LinkIcon className="w-3 h-3"/> Gán Link
                </button>
            );
        }
        if (job.status === 'Processing' || job.status === 'Generating') return <div className="flex justify-center"><LoaderIcon /></div>;
        return <span className="text-gray-300 text-[10px]">...</span>;
    };

    if (trackedFiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center bg-mac-surface rounded-mac-lg shadow-mac-card border border-mac-border/20 backdrop-blur-sm">
                <div className="w-16 h-16 bg-mac-surface-sec rounded-2xl flex items-center justify-center mb-4 border border-mac-border/30">
                     <span className="text-3xl opacity-50">📂</span>
                </div>
                <h3 className="text-lg font-bold text-mac-text mb-1">Chưa Có Dự Án</h3>
                <p className="text-sm text-mac-text-sec mb-6">Mở file Excel kịch bản để bắt đầu theo dõi tiến độ.</p>
                <button onClick={props.onOpenFile} className="bg-mac-accent text-white font-medium py-2 px-6 rounded-lg hover:bg-mac-accent-hover transition shadow-sm text-sm">
                    Mở Dự Án Mới
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-[82vh] bg-mac-surface/90 backdrop-blur-xl rounded-mac-lg shadow-mac-card overflow-hidden border border-mac-border/30">
            {/* Sidebar (Finder style) */}
            <div className="w-64 bg-mac-surface-sec/50 border-r border-mac-border/50 flex flex-col shrink-0 backdrop-blur-md">
                <div className="p-4 border-b border-mac-border/30">
                    <button onClick={props.onOpenFile} className="w-full bg-white border border-mac-border hover:border-mac-accent text-mac-text font-medium py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-2 text-xs">
                        <UploadIcon className="w-3 h-3 text-mac-text-sec" /> Mở File Excel
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {trackedFiles.map((file, idx) => (
                        <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between ${idx === activeFileIndex ? 'bg-mac-gray-light' : 'hover:bg-mac-gray-light/50'}`}>
                            <div className="min-w-0 w-full">
                                <div className={`text-xs font-semibold truncate ${idx === activeFileIndex ? 'text-mac-text' : 'text-mac-text-sec'}`}>{file.name}</div>
                                <div className="mt-1.5 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${idx === activeFileIndex ? 'bg-mac-accent' : 'bg-gray-400'}`} style={{ width: `${(file.jobs.filter(j=>j.status==='Completed').length / (file.jobs.length || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                            <button onClick={(e) => {e.stopPropagation(); props.onCloseFile(idx);}} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 ml-2 px-1 text-lg leading-none">&times;</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-mac-border/30 flex items-center justify-between flex-wrap gap-4 shrink-0 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-mac-text">{stats?.completed || 0}</span>
                            <span className="text-sm text-mac-text-sec font-medium">/ {stats?.total || 0} hoàn thành</span>
                        </div>
                        {isElectron && (
                            <div className="h-6 w-px bg-mac-border mx-2"></div>
                        )}
                        {isElectron && (
                            <div className="flex gap-2">
                                <button onClick={props.onReloadVideos} title="Tải lại" className="p-2 text-mac-text-sec hover:bg-gray-100 rounded-lg transition"><RetryIcon className="w-4 h-4"/></button>
                                <button onClick={props.onRetryStuck} title="Reset lỗi" className="p-2 text-mac-text-sec hover:bg-gray-100 rounded-lg transition"><ExternalLinkIcon className="w-4 h-4"/></button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isElectron && (
                            <>
                                <div className="flex items-center bg-gray-50 rounded-lg border border-mac-border p-0.5">
                                    <button onClick={props.onOpenToolFlows} className="px-3 py-1.5 text-xs font-medium text-mac-text hover:bg-white hover:shadow-sm rounded-md transition flex items-center gap-2">
                                        Mở Tool
                                    </button>
                                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                                    <button onClick={props.onSetToolFlowPath} className="p-1.5 text-mac-text-sec hover:text-mac-text rounded hover:bg-white transition" title="Cài đặt đường dẫn Tool">
                                        <CogIcon className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                                <button onClick={() => props.onShowFolder(currentFile.path!)} className="p-2 text-mac-text-sec hover:bg-gray-100 rounded-lg transition" title="Mở thư mục">
                                    <FolderIcon className="w-4 h-4"/>
                                </button>
                                <button onClick={handleCopyPath} className="text-xs font-medium text-mac-accent px-3 py-1.5 hover:bg-blue-50 rounded-lg transition">
                                    {copyFeedback ? 'Đã Sao Chép' : 'Copy Path'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Combine Bar */}
                {props.ffmpegFound && isElectron && (
                    <div className="px-6 py-3 bg-mac-surface-sec border-b border-mac-border/30 flex gap-3 overflow-x-auto items-center">
                        <button onClick={() => props.onCombine('normal')} disabled={props.isCombining} className="bg-white border border-mac-border text-mac-text px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:border-gray-400 disabled:opacity-50 transition">Ghép Thường</button>
                        <button onClick={() => props.onCombine('timed')} disabled={props.isCombining} className="bg-white border border-mac-border text-mac-text px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:border-gray-400 disabled:opacity-50 transition">Ghép Theo Nhạc</button>
                        <button onClick={props.onCombineAll} disabled={props.isCombining} className="bg-mac-text text-white px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:bg-black/90 disabled:opacity-50 transition">Ghép Tất Cả</button>
                    </div>
                )}

                {/* Table - macOS List View Style */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-gray-50/95 backdrop-blur z-10 border-b border-mac-border/50">
                            <tr>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec w-16">#</th>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec w-28">Trạng thái</th>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec">Tên Cảnh / Video</th>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec w-40 text-center">Xem thử</th>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec w-32 text-center">Ảnh Gốc</th>
                                <th className="px-6 py-3 text-[11px] font-semibold text-mac-text-sec w-24 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentFile.jobs.map((job) => (
                                <tr key={job.id} className="hover:bg-blue-50/50 transition-colors group text-sm">
                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{job.id.replace('Job_', '')}</td>
                                    <td className="px-6 py-4"><span className={getStatusBadge(job.status)}>{job.status}</span></td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-semibold text-mac-text truncate max-w-[250px]" title={job.videoName}>{job.videoName}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{job.typeVideo}</div>
                                    </td>
                                    <td className="px-6 py-4">{renderResultCell(job)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">{renderSourceImages(job)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {isElectron && job.videoPath && (
                                                <button onClick={() => props.onDeleteVideo(job.id, job.videoPath!)} className="p-1.5 text-gray-400 hover:text-red-500 transition rounded" title="Xóa video này">
                                                    <TrashIcon className="w-3.5 h-3.5"/>
                                                </button>
                                            )}
                                            {isElectron && (
                                                <button onClick={() => props.onRetryJob(job.id)} className="p-1.5 text-gray-400 hover:text-mac-accent transition rounded" title="Thử lại (Reset Status)">
                                                    <RetryIcon className="w-3.5 h-3.5"/>
                                                </button>
                                            )}
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
