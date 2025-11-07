

import React, {
  useState,
  useCallback,
  ChangeEvent,
  useEffect,
  useRef,
} from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
import CryptoJS from 'crypto-js';
// FIX: Add Buffer import to resolve "Cannot find name 'Buffer'" error in `parseExcelData` and `handleFileUpdate`.
import { Buffer } from 'buffer';
import { Scene, VideoType, FormData, ActiveTab, VideoJob, JobStatus, TrackedFile } from './types';
import { storySystemPrompt, liveSystemPrompt } from './constants';
import Results from './components/Results';
import { LoaderIcon, CopyIcon, UploadIcon, VideoIcon, CheckIcon, FolderIcon, ExternalLinkIcon } from './components/Icons';

const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const ipcRenderer = isElectron ? (window as any).require('electron').ipcRenderer : null;


// --- Activation Component ---
interface ActivationProps {
  machineId: string;
  onActivate: (key: string) => Promise<boolean>;
}

const Activation: React.FC<ActivationProps> = ({ machineId, onActivate }) => {
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
      setError('Mã kích hoạt không hợp lệ. Vui lòng thử lại.');
    }
    setIsActivating(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy using navigator.clipboard:', err);
      if (machineIdInputRef.current) {
        machineIdInputRef.current.select();
        machineIdInputRef.current.setSelectionRange(0, 99999);
        alert('Không thể tự động sao chép. Vui lòng nhấn Ctrl+C để sao chép thủ công.');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="text-white min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Kích hoạt ứng dụng
          </h1>
          <p className="text-indigo-200 mb-6">
            Vui lòng cung cấp mã máy tính cho quản trị viên để nhận mã kích hoạt.
          </p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-indigo-100 mb-2">
              Mã máy tính của bạn
            </label>
            <div className="relative">
              <input
                ref={machineIdInputRef}
                type="text"
                readOnly
                value={machineId}
                className="w-full bg-black/30 border-2 border-white/20 rounded-lg p-3 text-white font-mono text-center pr-10"
                aria-label="Mã máy tính"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-indigo-300 hover:text-white transition"
                title="Sao chép mã"
              >
                <CopyIcon className="w-5 h-5" />
              </button>
            </div>
            {copied && <p className="text-emerald-400 text-sm mt-2">Đã sao chép!</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="licenseKey" className="block text-sm font-medium text-indigo-100 mb-2">
                Nhập mã kích hoạt
              </label>
              <textarea
                id="licenseKey"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                rows={3}
                className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                placeholder="Dán mã kích hoạt bạn nhận được vào đây..."
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isActivating}
              className="w-full bg-white text-indigo-700 font-bold py-3 px-8 rounded-full hover:bg-indigo-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isActivating ? <LoaderIcon /> : 'Kích hoạt'}
            </button>
            
            {error && (
              <div className="text-red-300 font-medium bg-red-900/50 p-3 rounded-lg mt-4">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

// REFACTOR: The ApiKeyManagerScreen component and related logic have been removed 
// to align with the @google/genai SDK best practices. The API key should be
// managed via the `process.env.API_KEY` environment variable, not through the UI.

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
  const [videoType, setVideoType] = useState<VideoType>('story');
  const [formData, setFormData] = useState<FormData>({
    idea: '',
    liveAtmosphere: '',
    liveArtistImage: null,
    liveArtistName: '',
    liveArtist: '',
    songMinutes: '3',
    songSeconds: '30',
    projectName: '',
    model: 'gemini-flash-lite-latest',
    aspectRatio: '16:9',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  
  // REFACTOR: Removed state related to UI-based API key management.
  // The API key will be sourced from `process.env.API_KEY`.

  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [activeTrackerFileIndex, setActiveTrackerFileIndex] = useState<number>(0);
  const [videoFilePaths, setVideoFilePaths] = useState<Record<string, string>>({});
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedFolderPath, setCopiedFolderPath] = useState(false);

  const SECRET_KEY = 'your-super-secret-key-for-mv-prompt-generator-pro-2024';

  const getEncryptionKey = useCallback(() => CryptoJS.SHA256(machineId + SECRET_KEY).toString(), [machineId]);

  const decrypt = useCallback((ciphertext: string) => {
    if (!machineId) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return '';
    }
  }, [machineId, getEncryptionKey]);

  useEffect(() => {
    // REFACTOR: Removed API key loading logic.
  }, [machineId, decrypt]);

  const validateLicenseKey = useCallback(async (key: string): Promise<boolean> => {
    if (!machineId) return false;
    try {
      const parts = key.trim().split('.');
      if (parts.length !== 2) return false;
      const [receivedMachineId, receivedSignature] = parts;
      if (receivedMachineId !== machineId) return false;
      const expectedSignature = CryptoJS.HmacSHA256(machineId, SECRET_KEY).toString(CryptoJS.enc.Hex);
      return receivedSignature === expectedSignature;
    } catch (e) {
      return false;
    }
  }, [machineId]);

  const handleActivate = useCallback(async (key: string): Promise<boolean> => {
      const isValid = await validateLicenseKey(key);
      if (isValid) {
          localStorage.setItem('license_key', key);
          setIsActivated(true);
          return true;
      }
      return false;
  }, [validateLicenseKey]);
  
  // REFACTOR: Removed API key management functions (`handleKeyAdd`, `handleKeyDelete`, `handleKeySelect`).

  useEffect(() => {
    setTimeout(() => {
        let storedMachineId = localStorage.getItem('machine_id');
        if (!storedMachineId) {
            storedMachineId = crypto.randomUUID();
            localStorage.setItem('machine_id', storedMachineId);
        }
        setMachineId(storedMachineId);

        let activationStatus = false;
        const storedLicenseKey = localStorage.getItem('license_key');
        if (storedLicenseKey) {
            const parts = storedLicenseKey.split('.');
            if (parts.length === 2 && parts[0] === storedMachineId) {
                const expectedSignature = CryptoJS.HmacSHA256(storedMachineId, SECRET_KEY).toString(CryptoJS.enc.Hex);
                if (parts[1] === expectedSignature) {
                    activationStatus = true;
                }
            }
        }
        setIsActivated(activationStatus);
    }, 100);
  }, []);

  // REFACTOR: Removed useEffect for activating an API key from session storage.

  const parseExcelData = (data: Buffer): VideoJob[] => {
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet);
    
    const validStatuses: JobStatus[] = ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'];

    return json.map((row, index) => {
      let statusStr = (row.STATUS || '').toString().trim();
      let status: JobStatus = 'Pending';
      if (statusStr && validStatuses.includes(statusStr as JobStatus)) {
          status = statusStr as JobStatus;
      } else if (statusStr) {
          status = 'Pending';
      }
      return {
        id: row.JOB_ID || `Job_${index + 1}`,
        prompt: row.PROMPT || '',
        imagePath: row.IMAGE_PATH || '',
        imagePath2: row.IMAGE_PATH_2 || '',
        imagePath3: row.IMAGE_PATH_3 || '',
        status: status,
        videoName: row.VIDEO_NAME || '',
        typeVideo: row.TYPE_VIDEO || '',
      };
    });
  };

  useEffect(() => {
    if (!ipcRenderer) return;

    const watchedPaths = new Set(trackedFiles.map(f => f.path).filter((path): path is string => !!path));
    const previousWatchedPaths = new Set<string>(JSON.parse(sessionStorage.getItem('watchedPaths') || '[]') as string[]);

    watchedPaths.forEach(path => {
        if (!previousWatchedPaths.has(path)) {
            ipcRenderer.send('start-watching-file', path);
        }
    });

    previousWatchedPaths.forEach(path => {
        if (!watchedPaths.has(path)) {
            ipcRenderer.send('stop-watching-file', path);
        }
    });
    
    sessionStorage.setItem('watchedPaths', JSON.stringify(Array.from(watchedPaths)));

    const handleFileUpdate = (_event: any, { path, content }: { path: string, content: Buffer }) => {
        const newJobs = parseExcelData(content);
        setTrackedFiles(prevFiles => 
            prevFiles.map(file => 
                file.path === path ? { ...file, jobs: newJobs } : file
            )
        );
    };

    ipcRenderer.on('file-content-updated', handleFileUpdate);

    return () => {
        ipcRenderer.removeListener('file-content-updated', handleFileUpdate);
    };
  }, [trackedFiles]);
  
  useEffect(() => {
    if (!isElectron || !ipcRenderer || trackedFiles.length === 0 || activeTrackerFileIndex >= trackedFiles.length) {
      setVideoFilePaths({});
      return;
    };

    const currentFile = trackedFiles[activeTrackerFileIndex];
    if (!currentFile || !currentFile.path) {
      setVideoFilePaths({});
      return;
    }

    const checkVideos = async () => {
      const directoryPath = await ipcRenderer.invoke('get-directory-path', currentFile.path);
      const newVideoPaths: Record<string, string> = {};
      if (!directoryPath) {
        setVideoFilePaths({});
        return;
      }

      for (const job of currentFile.jobs) {
        const videoFileName = `Video_${job.id}_${job.videoName}.mp4`;
        const videoPath = await ipcRenderer.invoke('path-join', directoryPath, videoFileName);
        if(videoPath) {
            const exists = await ipcRenderer.invoke('check-file-exists', videoPath);
            if (exists) {
            newVideoPaths[job.id] = videoPath.replace(/\\/g, '/');
            }
        }
      }
      setVideoFilePaths(newVideoPaths);
    };

    checkVideos();
  }, [activeTrackerFileIndex, trackedFiles]);


  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    },[],
  );

  const handleAspectRatioChange = (value: '16:9' | '9:16') => setFormData((prev) => ({ ...prev, aspectRatio: value }));

  const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFormData((prev) => ({ ...prev, liveArtistImage: null }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        if (base64Data) {
          setFormData((prev) => ({
            ...prev,
            liveArtistImage: { base64: base64Data, mimeType: file.type },
          }));
        }
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const generatePrompts = async () => {
    // REFACTOR: Removed check for activeApiKey. The SDK will use the key
    // from the environment variable `process.env.API_KEY`.
    setIsLoading(true);
    setFeedback(null);
    setGeneratedScenes([]);

    const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
    if (totalSeconds <= 0) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập thời lượng bài hát hợp lệ.' });
      setIsLoading(false);
      return;
    }

    let sceneCount = Math.max(3, Math.round(totalSeconds / 7));

    const systemPrompt = videoType === 'story' ? storySystemPrompt : liveSystemPrompt;
    let userPrompt = `Generate prompts for a music video.`;

    if (videoType === 'story') {
      if (!formData.idea.trim()) {
        setFeedback({ type: 'error', message: 'Vui lòng nhập Ý tưởng cho MV.' });
        setIsLoading(false);
        return;
      }
      userPrompt += ` The core idea is: "${formData.idea.trim()}".`;
    } else {
      if (!formData.liveAtmosphere.trim() && !formData.liveArtistName.trim() && !formData.liveArtist.trim() && !formData.liveArtistImage) {
        setFeedback({ type: 'error', message: 'Vui lòng nhập ít nhất một thông tin cho Video Trình Diễn Live.' });
        setIsLoading(false);
        return;
      }
      if (formData.liveAtmosphere.trim()) userPrompt += ` The Stage & Atmosphere is: "${formData.liveAtmosphere.trim()}".`;
      if (formData.liveArtistName.trim()) userPrompt += ` The Artist Name is: "${formData.liveArtistName.trim()}".`;
      if (formData.liveArtist.trim()) userPrompt += ` The Artist & Performance Style is: "${formData.liveArtist.trim()}".`;
    }

    userPrompt += ` The video should have exactly ${sceneCount} scenes, structured with a clear visual arc. The aspect ratio will be ${formData.aspectRatio}.`;

    const parts: any[] = [{ text: userPrompt }];
    if (videoType === 'live' && formData.liveArtistImage) {
      parts.push({
        inlineData: { mimeType: formData.liveArtistImage.mimeType, data: formData.liveArtistImage.base64 },
      });
    }

    try {
      // REFACTOR: Initialize GoogleGenAI with the API key from environment variables
      // as per @google/genai SDK guidelines.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: formData.model,
        contents: { parts: parts },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    scene_number: { type: Type.INTEGER },
                    scene_title: { type: Type.STRING },
                    prompt_text: { type: Type.STRING },
                  },
                  required: ['scene_number', 'scene_title', 'prompt_text'],
                },
              },
            },
            required: ['prompts'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('AI response was empty.');
      }

      const parsedData = JSON.parse(responseText);
      if (parsedData.prompts && Array.isArray(parsedData.prompts)) {
        setGeneratedScenes(parsedData.prompts);
      } else {
        throw new Error('AI response did not contain a valid "prompts" array.');
      }
    } catch (err: any) {
      console.error('Error generating prompts:', err);
      let displayMessage = err.message || 'An unknown error occurred.';
      // REFACTOR: Updated error message for invalid API key to align with environment variable usage.
      if (err.message?.includes('API key not valid')) {
        displayMessage = 'Lỗi xác thực. API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra biến môi trường API_KEY của bạn.';
      } else if (err.message?.includes('quota')) {
        displayMessage = 'Bạn đã vượt quá hạn ngạch sử dụng cho Khóa API này.';
      } else if (err.message?.includes('Requested entity was not found')) {
        displayMessage = `Model "${formData.model}" không tồn tại hoặc bạn không có quyền truy cập. Vui lòng chọn model khác.`;
      }
      setFeedback({ type: 'error', message: `Đã có lỗi xảy ra: ${displayMessage}` });
    } finally {
      setIsLoading(false);
    }
  };
  
  const startProcess = async () => {
    if (generatedScenes.length === 0) {
      setFeedback({ type: 'error', message: 'Chưa có dữ liệu prompt để bắt đầu quá trình!' });
      return;
    }
    setFeedback(null);
  
    try {
      const projectName = formData.projectName.trim() || 'MV';
      const safeFileName = (formData.projectName.trim() || 'Prompt_Script').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      const fullFileName = `${safeFileName}.xlsx`;
  
      const dataForTracker: VideoJob[] = generatedScenes.map((p, index) => ({
          id: `Job_${index + 1}`,
          prompt: p.prompt_text,
          imagePath: '', imagePath2: '', imagePath3: '',
          status: 'Pending',
          videoName: `${projectName}_${index + 1}`,
          typeVideo: '',
      }));
  
      const dataForExcel = dataForTracker.map(job => ({
        'JOB_ID': job.id,
        'PROMPT': job.prompt,
        'IMAGE_PATH': job.imagePath,
        'IMAGE_PATH_2': job.imagePath2,
        'IMAGE_PATH_3': job.imagePath3,
        'STATUS': '',
        'VIDEO_NAME': job.videoName,
        'TYPE_VIDEO': job.typeVideo,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
      
      worksheet['!cols'] = [
        { wch: 15 }, { wch: 150 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Prompts');
  
      let filePath: string | undefined;
      if (isElectron && ipcRenderer) {
        const fileContent = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const result = await ipcRenderer.invoke('save-file-dialog', { defaultPath: fullFileName, fileContent: fileContent });
  
        if (result.success) {
            setFeedback({ type: 'success', message: `Thành công! File đã được lưu tại: ${result.filePath}` });
            filePath = result.filePath;
        } else if (result.error && result.error !== 'Save dialog canceled') {
            throw new Error(result.error);
        }
      } else {
        XLSX.writeFile(workbook, fullFileName);
        setFeedback({ type: 'success', message: 'Thành công! File kịch bản của bạn đang được tải xuống.' });
      }

      const newTrackedFile: TrackedFile = {
        name: fullFileName,
        jobs: dataForTracker,
        path: filePath,
      };
      setTrackedFiles(prevFiles => [...prevFiles, newTrackedFile]);
      setActiveTrackerFileIndex(trackedFiles.length);
      setActiveTab('tracker');

    } catch (err: any) {
        console.error('Error exporting file:', err);
        setFeedback({ type: 'error', message: 'Đã có lỗi xảy ra khi xuất file Excel.' });
    }
  };

  const handleOpenNewFile = async () => {
    if (!ipcRenderer) return;
    setFeedback(null);
    const result = await ipcRenderer.invoke('open-file-dialog');
    if (result.success) {
        try {
            const loadedJobs = parseExcelData(result.content);
            const newTrackedFile: TrackedFile = {
                name: result.name,
                jobs: loadedJobs,
                path: result.path,
            };
            setTrackedFiles(prev => [...prev, newTrackedFile]);
            setActiveTrackerFileIndex(trackedFiles.length);
        } catch (error) {
            console.error("Error parsing Excel file:", error);
            setFeedback({ type: 'error', message: 'Không thể đọc file. File không đúng định dạng hoặc đã bị lỗi.' });
        }
    } else if (result.error) {
        setFeedback({ type: 'error', message: `Lỗi mở file: ${result.error}` });
    }
  };

  const handleCloseTrackerTab = (indexToClose: number) => {
    setTrackedFiles(prev => prev.filter((_, index) => index !== indexToClose));
    if (activeTrackerFileIndex >= indexToClose) {
        setActiveTrackerFileIndex(prevIndex => Math.max(0, prevIndex - 1));
    }
  };

  const handleLaunchVideoTool = () => {
    ipcRenderer?.send('launch-video-tool');
  };

  const handleCopyPath = (path: string) => {
      navigator.clipboard.writeText(path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyFolderPath = (path: string) => {
    if (ipcRenderer && path) {
        ipcRenderer.invoke('get-directory-path', path).then((dirPath: string | null) => {
            if (dirPath) {
                navigator.clipboard.writeText(dirPath);
                setCopiedFolderPath(true);
                setTimeout(() => setCopiedFolderPath(false), 2000);
            }
        });
    }
  };

  const handleOpenFolder = (path: string) => {
      ipcRenderer?.send('open-file-location', path);
  };

  const getStatusBadge = (status: JobStatus) => {
    const baseClasses = "status-badge";
    switch (status) {
      case 'Pending': return `${baseClasses} status-pending`;
      case 'Processing': return `${baseClasses} status-processing`;
      case 'Generating': return `${baseClasses} status-generating`;
      case 'Completed': return `${baseClasses} status-completed`;
      case 'Failed': return `${baseClasses} status-failed`;
      default: return baseClasses;
    }
  };

  const renderResultCell = (job: VideoJob) => {
    const videoSrc = videoFilePaths[job.id];
    const containerClasses = "w-40 h-24 bg-black/30 rounded-md flex items-center justify-center";

    if (videoSrc) {
        return <video src={`file://${videoSrc}`} controls className="w-40 h-24 object-contain bg-black/30 rounded-md" />;
    }
    
    switch(job.status) {
      case 'Completed': return <div className={containerClasses}><CheckIcon className="w-10 h-10 text-emerald-400" /></div>;
      case 'Processing':
      case 'Generating': return <div className={containerClasses}><LoaderIcon /></div>;
      default: return <div className={containerClasses}><VideoIcon className="w-8 h-8 text-gray-400" /></div>;
    }
  }

  const TabButton: React.FC<{ tabName: ActiveTab; children: React.ReactNode; }> = ({ tabName, children }) => (
    <button
        onClick={() => setActiveTab(tabName)}
        className={`px-6 py-3 font-semibold rounded-t-lg transition-colors duration-300 focus:outline-none ${ activeTab === tabName ? 'bg-white/20 text-white' : 'bg-black/20 text-indigo-200 hover:bg-white/10' }`}
    >
        {children}
    </button>
  );

  const RadioLabel: React.FC<{ name: string; value: string; checked: boolean; onChange: (value: any) => void; children: React.ReactNode; }> = ({ name, value, checked, onChange, children }) => (
    <label className="relative flex items-center space-x-2 cursor-pointer p-2 rounded-md flex-1 justify-center text-center transition-colors">
      <input type="radio" name={name} value={value} className="absolute opacity-0 w-full h-full" checked={checked} onChange={() => onChange(value)} />
      <span className={`relative z-10 ${checked ? 'font-bold text-white' : ''}`}>{children}</span>
      <div className={`absolute top-0 left-0 w-full h-full rounded-md transition-colors ${ checked ? 'bg-indigo-500/50' : '' }`}></div>
    </label>
  );

  if (isActivated === null) {
    return <div className="text-white min-h-screen flex items-center justify-center p-4"><LoaderIcon /></div>;
  }
  if (!isActivated && machineId) {
    return <Activation machineId={machineId} onActivate={handleActivate} />;
  }
  // REFACTOR: Removed conditional rendering of ApiKeyManagerScreen.
  // The app will now render directly if activated.
  
  return (
    <>
      <div className="text-white min-h-screen p-4">
        <div className="w-full max-w-7xl mx-auto">
          <header className="text-center mb-6 relative">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">🎬 Prompt Generator Pro</h1>
            <p className="text-lg text-indigo-200 mt-2">Biến ý tưởng thành kịch bản & theo dõi sản xuất video.</p>
            {/* REFACTOR: Removed the API key display from the header. */}
          </header>

          <div className="flex space-x-2">
            <TabButton tabName="generator">Tạo Kịch Bản</TabButton>
            <TabButton tabName="tracker">Theo Dõi Sản Xuất</TabButton>
          </div>

          <div className="glass-card rounded-b-2xl rounded-tr-2xl p-6 sm:p-8 shadow-2xl">
            {activeTab === 'generator' && (
              <main>
                <div className="space-y-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-indigo-100 mb-2">1. Chọn loại Video</label>
                      <div className="flex items-center space-x-2 glass-card p-2 rounded-lg">
                        <RadioLabel name="videoType" value="story" checked={videoType === 'story'} onChange={setVideoType}>MV Kể Chuyện</RadioLabel>
                        <RadioLabel name="videoType" value="live" checked={videoType === 'live'} onChange={setVideoType}>Live Acoustic</RadioLabel>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-indigo-100 mb-2">2. Chọn Khung hình Video</label>
                      <div className="flex items-center space-x-2 glass-card p-2 rounded-lg">
                        <RadioLabel name="aspectRatio" value="16:9" checked={formData.aspectRatio === '16:9'} onChange={handleAspectRatioChange}>16:9 (Landscape)</RadioLabel>
                        <RadioLabel name="aspectRatio" value="9:16" checked={formData.aspectRatio === '9:16'} onChange={handleAspectRatioChange}>9:16 (Portrait)</RadioLabel>
                      </div>
                    </div>
                  </div>

                  <div className={`${videoType === 'story' ? 'block' : 'hidden'} space-y-6`}>
                    <div>
                      <label htmlFor="idea" className="block text-sm font-medium text-indigo-100 mb-2">Lời bài hát / Ý tưởng MV (Chủ đề chính)</label>
                      <textarea id="idea" name="idea" value={formData.idea} onChange={handleInputChange} rows={4} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Dán lời bài hát vào đây, hoặc mô tả ý tưởng chính cho MV của bạn..."></textarea>
                    </div>
                  </div>

                  <div className={`${videoType === 'live' ? 'block' : 'hidden'} space-y-6`}>
                    <div>
                      <label htmlFor="liveAtmosphere" className="block text-sm font-medium text-indigo-100 mb-2">Mô tả Bối cảnh &amp; Không khí (Cho buổi diễn Acoustic)</label>
                      <textarea id="liveAtmosphere" name="liveAtmosphere" value={formData.liveAtmosphere} onChange={handleInputChange} rows={3} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Một góc phòng thu ấm cúng với vài cây nến..."></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-indigo-100 mb-2">Tải ảnh ca sĩ (Để AI nhận diện chính xác nhất)</label>
                      <div className="flex items-center space-x-4">
                        <label htmlFor="liveArtistImage" className="cursor-pointer inline-block px-6 py-3 bg-white/10 border-2 border-dashed border-white/30 rounded-lg text-center transition hover:bg-white/20 hover:border-white/50"><span>Chọn ảnh...</span></label>
                        <input type="file" id="liveArtistImage" name="liveArtistImage" onChange={handleImageUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />
                        {formData.liveArtistImage && ( <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-white/30"><img src={`data:${formData.liveArtistImage.mimeType};base64,${formData.liveArtistImage.base64}`} alt="Image Preview" className="w-full h-full object-cover" /></div> )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="liveArtistName" className="block text-sm font-medium text-indigo-100 mb-2">Tên Ca Sĩ (Nếu là người nổi tiếng)</label>
                      <input type="text" id="liveArtistName" name="liveArtistName" value={formData.liveArtistName} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Taylor Swift, Sơn Tùng M-TP..." />
                    </div>
                    <div>
                      <label htmlFor="liveArtist" className="block text-sm font-medium text-indigo-100 mb-2">Mô tả Nghệ sĩ &amp; Phong cách trình diễn</label>
                      <textarea id="liveArtist" name="liveArtist" value={formData.liveArtist} onChange={handleInputChange} rows={3} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Nữ ca sĩ với giọng hát trong trẻo, mặc váy trắng, chơi đàn piano..."></textarea>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                    <div>
                      <label className="block text-sm font-medium text-indigo-100 mb-2">Thời lượng bài hát (để tính số cảnh)</label>
                      <div className="flex items-center space-x-2">
                        <input type="number" id="songMinutes" name="songMinutes" value={formData.songMinutes} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Phút" min="0" />
                        <span className="text-xl">:</span>
                        <input type="number" id="songSeconds" name="songSeconds" value={formData.songSeconds} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Giây" min="0" max="59" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="projectName" className="block text-sm font-medium text-indigo-100 mb-2">Tên Dự Án (Để đặt tên file)</label>
                      <input type="text" id="projectName" name="projectName" value={formData.projectName} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: MV_Bai_Hat_Moi" />
                    </div>
                    <div>
                      <label htmlFor="model" className="block text-sm font-medium text-indigo-100 mb-2">Chọn Model AI</label>
                      <select id="model" name="model" value={formData.model} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition">
                        <option value="gemini-flash-lite-latest">Gemini Flash Lite</option>
                        <option value="gemini-flash-latest">Gemini Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <button onClick={generatePrompts} disabled={isLoading} className="bg-white text-indigo-700 font-bold py-3 px-8 rounded-full hover:bg-indigo-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100" title="Tạo kịch bản">
                    {isLoading ? <LoaderIcon /> : <span>Tạo Kịch Bản Prompt</span>}
                  </button>
                </div>
                
                {feedback && ( <div className={`text-center mt-6 font-medium p-3 rounded-lg ${ feedback.type === 'error' ? 'text-red-300 bg-red-900/50' : feedback.type === 'success' ? 'text-emerald-300 bg-emerald-900/50' : 'text-blue-300 bg-blue-900/50' }`}>{feedback.message}</div> )}
                {generatedScenes.length > 0 && (
                  <div className="text-center mt-8 pt-6 border-t border-white/20 space-y-4">
                    <h3 className="text-xl font-bold">Hoàn thành! Kịch bản của bạn đã sẵn sàng.</h3>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                      <button onClick={startProcess} className="bg-teal-500 text-white font-bold py-3 px-8 rounded-full hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-teal-300 w-full sm:w-auto">Lưu kịch bản & Theo dõi</button>
                    </div>
                  </div>
                )}
                <Results scenes={generatedScenes} />
              </main>
            )}
            {activeTab === 'tracker' && (
                <main>
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-center mb-2">Bảng Theo Dõi Sản Xuất Video</h2>
                            <p className="text-indigo-200 text-center">Trạng thái được cập nhật tự động khi file Excel thay đổi.</p>
                        </div>

                        {feedback && ( <div className={`text-center font-medium p-3 rounded-lg ${ feedback.type === 'error' ? 'text-red-300 bg-red-900/50' : '' }`}>{feedback.message}</div> )}
                        
                        {trackedFiles.length === 0 ? (
                             <div className="text-center py-10 border-2 border-dashed border-white/20 rounded-lg">
                                 <UploadIcon className="mx-auto h-12 w-12 text-indigo-300" />
                                 <h3 className="mt-2 text-lg font-medium">Chưa có file nào được theo dõi</h3>
                                 <p className="mt-1 text-sm text-indigo-200">Tạo một kịch bản mới hoặc tải lên một file Excel để bắt đầu.</p>
                                 <div className="mt-6">
                                     <button onClick={handleOpenNewFile} className="bg-white text-indigo-700 font-bold py-2 px-6 rounded-full hover:bg-indigo-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300">Tải File Mới</button>
                                 </div>
                             </div>
                        ) : (
                            <div>
                               <div className="flex justify-between items-center mb-4 flex-wrap gap-y-4">
                                  <div className="tracker-tabs flex-grow basis-full sm:basis-auto">
                                      {trackedFiles.map((file, index) => (
                                          <button key={index} className={`tracker-tab ${activeTrackerFileIndex === index ? 'active' : ''}`} onClick={() => setActiveTrackerFileIndex(index)}>
                                              <span>{file.name}</span>
                                              <span className="tab-close-btn" onClick={(e) => { e.stopPropagation(); handleCloseTrackerTab(index); }}>&times;</span>
                                          </button>
                                      ))}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button onClick={handleOpenNewFile} className="bg-white/10 text-white font-bold py-2 px-4 rounded-full hover:bg-white/20 transition whitespace-nowrap text-sm">Tải File Mới</button>
                                    {isElectron && <button onClick={handleLaunchVideoTool} className="bg-purple-500 text-white font-bold py-2 px-4 rounded-full hover:bg-purple-600 transition whitespace-nowrap flex items-center gap-2 text-sm">
                                      <ExternalLinkIcon className="w-4 h-4" />
                                      Bắt đầu với ToolsFlow
                                    </button>}
                                  </div>
                               </div>

                                {isElectron && trackedFiles[activeTrackerFileIndex]?.path && (
                                  <div className="flex items-center gap-4 mb-4 bg-black/20 p-3 rounded-lg flex-wrap">
                                    <p className="font-mono text-sm text-gray-300 truncate flex-1 basis-full md:basis-auto">
                                        <strong className="text-gray-100">File:</strong> {trackedFiles[activeTrackerFileIndex].path}
                                    </p>
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <button onClick={() => handleCopyPath(trackedFiles[activeTrackerFileIndex].path!)} className="flex items-center gap-2 text-indigo-300 hover:text-white transition text-sm font-semibold">
                                        {copiedPath ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                                        {copiedPath ? 'Đã sao chép!' : 'Copy File Path'}
                                      </button>
                                      <button onClick={() => handleCopyFolderPath(trackedFiles[activeTrackerFileIndex].path!)} className="flex items-center gap-2 text-indigo-300 hover:text-white transition text-sm font-semibold">
                                        {copiedFolderPath ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                                        {copiedFolderPath ? 'Đã sao chép!' : 'Copy Folder Path'}
                                      </button>
                                      <button onClick={() => handleOpenFolder(trackedFiles[activeTrackerFileIndex].path!)} className="flex items-center gap-2 text-indigo-300 hover:text-white transition text-sm font-semibold">
                                          <FolderIcon className="w-4 h-4" /> Open Folder
                                      </button>
                                    </div>
                                  </div>
                                )}


                                {trackedFiles[activeTrackerFileIndex] && (
                                  <div className="overflow-x-auto bg-black/20 rounded-lg">
                                      <table className="w-full text-white job-table">
                                          <thead>
                                              <tr>
                                                  <th>Job ID</th>
                                                  <th>Trạng Thái</th>
                                                  <th>Tên Video</th>
                                                  <th>Kết Quả</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {trackedFiles[activeTrackerFileIndex].jobs.map(job => (
                                                  <tr key={job.id}>
                                                      <td className="font-mono text-sm">{job.id}</td>
                                                      <td><span className={getStatusBadge(job.status)}>{job.status}</span></td>
                                                      <td className="font-medium">{job.videoName}</td>
                                                      <td>{renderResultCell(job)}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default App;