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
import { Scene, VideoType, FormData, ActiveTab, VideoJob, JobStatus, TrackedFile, ApiKey, MvGenre } from './types';
import { storySystemPrompt, liveSystemPrompt } from './constants';
import Results from './components/Results';
import { LoaderIcon, CopyIcon, UploadIcon, VideoIcon, KeyIcon, TrashIcon, FolderIcon, ExternalLinkIcon, PlayIcon, CogIcon } from './components/Icons';

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

// --- API Key Manager Component ---
interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onKeySelect: (key: ApiKey) => void;
  onKeyAdd: (key: ApiKey) => void;
  onKeyDelete: (keyId: string) => void;
}

const ApiKeyManagerScreen: React.FC<ApiKeyManagerProps> = ({ apiKeys, onKeySelect, onKeyAdd, onKeyDelete }) => {
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newKeyName.trim() || !newKeyValue.trim()) {
            setError('Biệt danh và giá trị khóa không được để trống.');
            return;
        }
        if (apiKeys.some(k => k.name === newKeyName.trim())) {
            setError('Biệt danh này đã tồn tại. Vui lòng chọn một biệt danh khác.');
            return;
        }
        onKeyAdd({
            id: crypto.randomUUID(),
            name: newKeyName.trim(),
            value: newKeyValue.trim(),
        });
        setNewKeyName('');
        setNewKeyValue('');
    };

    const truncateKey = (key: string) => `${key.slice(0, 5)}...${key.slice(-4)}`;

    return (
        <div className="text-white min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-2xl mx-auto">
                <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-center">
                        Quản lý API Keys
                    </h1>
                    <p className="text-indigo-200 mb-6 text-center">
                        Thêm, xóa, hoặc chọn một Google AI API Key để sử dụng.
                    </p>

                    {apiKeys.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-lg font-semibold text-indigo-100 mb-3">Khóa đã lưu</h2>
                            <div className="space-y-3 key-list">
                                {apiKeys.map(key => (
                                    <div key={key.id} className="key-item">
                                        <div className="flex items-center gap-3">
                                            <KeyIcon className="w-5 h-5 text-indigo-300" />
                                            <div>
                                                <p className="font-semibold text-white">{key.name}</p>
                                                <p className="text-sm text-gray-400 font-mono">{truncateKey(key.value)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onKeySelect(key)}
                                                className="bg-teal-500 text-white font-bold py-2 px-4 rounded-full hover:bg-teal-600 transition text-sm"
                                            >
                                                Sử dụng
                                            </button>
                                            <button
                                                onClick={() => onKeyDelete(key.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition"
                                                title="Xóa khóa"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-white/20">
                        <h2 className="text-lg font-semibold text-indigo-100 mb-4">Thêm khóa mới</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="keyName" className="block text-sm font-medium text-indigo-100 mb-2">
                                    Biệt danh (Nickname)
                                </label>
                                <input
                                    id="keyName"
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                                    placeholder="Ví dụ: Key cá nhân, Key công ty"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="keyValue" className="block text-sm font-medium text-indigo-100 mb-2">
                                    Giá trị API Key
                                </label>
                                <input
                                    id="keyValue"
                                    type="password"
                                    value={newKeyValue}
                                    onChange={(e) => setNewKeyValue(e.target.value)}
                                    className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                                    placeholder="Dán API Key của bạn vào đây"
                                    required
                                />
                            </div>
                            {error && <p className="text-red-300 text-sm">{error}</p>}
                            <button
                                type="submit"
                                className="w-full bg-white text-indigo-700 font-bold py-3 px-8 rounded-full hover:bg-indigo-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
                            >
                                Thêm và Lưu khóa
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    mvGenre: 'narrative',
    filmingStyle: 'auto',
    country: 'Vietnamese',
    characterConsistency: true,
    characterCount: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [activeApiKey, setActiveApiKey] = useState<ApiKey | null>(null);
  const [isManagingKeys, setIsManagingKeys] = useState(false);

  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [activeTrackerFileIndex, setActiveTrackerFileIndex] = useState<number>(0);

  const [ffmpegFound, setFfmpegFound] = useState<boolean | null>(null);
  const [isCombiningVideo, setIsCombiningVideo] = useState(false);
  const [isCombiningAll, setIsCombiningAll] = useState(false);
  const [lastCombinedVideoPath, setLastCombinedVideoPath] = useState<string | null>(null);

  const fileDiscoveryRef = useRef<Set<string>>(new Set());
  const SECRET_KEY = 'your-super-secret-key-for-mv-prompt-generator-pro-2024';

  const mvGenreOptions: { value: MvGenre, label: string }[] = [
    { value: 'narrative', label: 'Kể chuyện (Narrative)' },
    { value: 'performance', label: 'Trình diễn (Performance)' },
    { value: 'conceptual', label: 'Trừu tượng (Conceptual)' },
    { value: 'lyrical', label: 'Minh hoạ lời bài hát (Lyrical Montage)' },
    { value: 'scenic', label: 'Cảnh quan & Kiến trúc (Không người)' },
    { value: 'animation', label: 'Hoạt hình (Animation)' },
    { value: 'one-take', label: 'Một cú máy (One-take)' },
  ];

  const filmingStyleOptions: { value: string, label: string }[] = [
    { value: 'auto', label: 'AI Tự động đề xuất' },
    { value: 'Vintage 35mm Film', label: 'Phim 35mm Cổ điển' },
    { value: 'Sharp & Modern Digital', label: 'Kỹ thuật số Sắc nét & Hiện đại' },
    { value: 'Found Footage / Handheld', label: 'Giả tài liệu / Cầm tay' },
    { value: 'Surreal & Dreamlike', label: 'Siêu thực & Mơ màng' },
    { value: 'Artistic Black & White', label: 'Đen trắng Nghệ thuật' },
    { value: '2D Animation (Ghibli Style)', label: 'Hoạt hình 2D (Phong cách Ghibli)' },
    { value: '3D Animation (Pixar Style)', label: 'Hoạt hình 3D (Phong cách Pixar)' },
  ];
  
  const countryOptions: { value: string, label: string }[] = [
    { value: 'Vietnamese', label: 'Việt Nam' },
    { value: 'American', label: 'Mỹ (American)' },
    { value: 'British', label: 'Anh (British)' },
    { value: 'South Korean', label: 'Hàn Quốc (South Korean)' },
    { value: 'Japanese', label: 'Nhật Bản (Japanese)' },
    { value: 'Chinese', label: 'Trung Quốc (Chinese)' },
    { value: 'French', label: 'Pháp (French)' },
    { value: 'Brazilian', label: 'Brazil' },
    { value: 'Spanish', label: 'Tây Ban Nha (Spanish)' },
    { value: 'Generic/International', label: 'Quốc tế / Không xác định' },
  ];

  const getEncryptionKey = useCallback(() => CryptoJS.SHA256(machineId + SECRET_KEY).toString(), [machineId]);

  const encrypt = useCallback((text: string) => {
    if (!machineId) return '';
    return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
  }, [machineId, getEncryptionKey]);

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
    if (machineId) {
      const storedKeysEncrypted = localStorage.getItem('api_keys_storage');
      if (storedKeysEncrypted) {
        const decryptedKeys = decrypt(storedKeysEncrypted);
        if (decryptedKeys) {
          try {
            setApiKeys(JSON.parse(decryptedKeys));
          } catch {
            localStorage.removeItem('api_keys_storage');
          }
        }
      }
    }
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
  
  const handleKeyAdd = (newKey: ApiKey) => {
    const updatedKeys = [...apiKeys, newKey];
    setApiKeys(updatedKeys);
    localStorage.setItem('api_keys_storage', encrypt(JSON.stringify(updatedKeys)));
  };

  const handleKeyDelete = (keyId: string) => {
    const updatedKeys = apiKeys.filter(k => k.id !== keyId);
    setApiKeys(updatedKeys);
    localStorage.setItem('api_keys_storage', encrypt(JSON.stringify(updatedKeys)));
    if(activeApiKey?.id === keyId) {
      setActiveApiKey(null);
      sessionStorage.removeItem('active_api_key_id');
    }
  };

  const handleKeySelect = (key: ApiKey) => {
    setActiveApiKey(key);
    sessionStorage.setItem('active_api_key_id', key.id);
    setIsManagingKeys(false);
  };

  useEffect(() => {
    if (isElectron && ipcRenderer) {
      ipcRenderer.invoke('get-app-version').then(setAppVersion);
    }
    
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

  useEffect(() => {
    if(isActivated && apiKeys.length > 0 && !activeApiKey) {
      const activeKeyId = sessionStorage.getItem('active_api_key_id');
      if (activeKeyId) {
        const keyToActivate = apiKeys.find(k => k.id === activeKeyId);
        if (keyToActivate) setActiveApiKey(keyToActivate);
      }
    }
  }, [isActivated, apiKeys, activeApiKey]);

    const parseExcelData = (data: Uint8Array): VideoJob[] => {
        const workbook = XLSX.read(data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const dataAsArrays: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

        if (dataAsArrays.length < 2) return [];

        const headers: string[] = dataAsArrays[0].map(h => String(h).trim());
        const headerMap: { [key: string]: number } = {};
        headers.forEach((h, i) => { headerMap[h] = i; });
        
        const dataRows = dataAsArrays.slice(1);
        const validStatuses: JobStatus[] = ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'];

        return dataRows.map((rowArray, index) => {
            const get = (headerName: string) => rowArray[headerMap[headerName]] || '';
            let statusStr = String(get('STATUS')).trim();
            let status: JobStatus = 'Pending';
            if (statusStr && validStatuses.includes(statusStr as JobStatus)) {
                status = statusStr as JobStatus;
            }

            return {
                id: get('JOB_ID') || `job_${index + 1}`,
                prompt: get('PROMPT') || '',
                imagePath: get('IMAGE_PATH') || '',
                imagePath2: get('IMAGE_PATH_2') || '',
                imagePath3: get('IMAGE_PATH_3') || '',
                status: status,
                videoName: get('VIDEO_NAME') || '',
                typeVideo: get('TYPE_VIDEO') || '',
                videoPath: get('VIDEO_PATH') || undefined,
            };
        }).filter(job => job.id && String(job.id).trim());
    };

    // Effect for one-time IPC listener setup
    useEffect(() => {
      if (!ipcRenderer) return;
  
      const handleFileUpdate = (_event: any, { path, content }: { path: string, content: Uint8Array }) => {
          const newJobs = parseExcelData(content);
          setTrackedFiles(prevFiles => 
              prevFiles.map(file => 
                  file.path === path ? { ...file, jobs: newJobs } : file
              )
          );
      };
  
      const handleCombineAllProgress = (_event: any, { message }: { message: string }) => {
          setFeedback({ type: 'info', message });
      };
  
      ipcRenderer.on('file-content-updated', handleFileUpdate);
      ipcRenderer.on('combine-all-progress', handleCombineAllProgress);
  
      return () => {
          ipcRenderer.removeListener('file-content-updated', handleFileUpdate);
          ipcRenderer.removeListener('combine-all-progress', handleCombineAllProgress);
      };
    }, []);

    // Effect for managing file watchers based on trackedFiles state
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
    }, [trackedFiles]);
  
  const getFolderPath = (filePath: string | undefined): string => {
    if (!filePath) return '';
    const isWindows = navigator.userAgent.includes("Windows");
    const separator = isWindows ? '\\' : '/';
    return filePath.substring(0, filePath.lastIndexOf(separator));
  };
  
  useEffect(() => {
    // Reset combined video path when switching files
    setLastCombinedVideoPath(null);

    const currentFile = trackedFiles.length > 0 ? trackedFiles[activeTrackerFileIndex] : null;
    if (isElectron && ipcRenderer && currentFile?.path) {
        const hasIncompleteJobs = currentFile.jobs.some(j => j.status === 'Completed' && !j.videoPath);
        const discoveryKey = `${currentFile.path}-${currentFile.jobs.map(j => j.status).join(',')}`;
        
        if (hasIncompleteJobs && !fileDiscoveryRef.current.has(discoveryKey)) {
            const folderPath = getFolderPath(currentFile.path);
            const filePath = currentFile.path; // Capture path for robust update
            
            ipcRenderer.invoke('find-videos-for-jobs', { jobs: currentFile.jobs, basePath: folderPath })
                .then((result: { success: boolean; jobs: VideoJob[]; error?: string; }) => {
                    if (result.success) {
                        setTrackedFiles(prevFiles =>
                            prevFiles.map(file =>
                                file.path === filePath ? { ...file, jobs: result.jobs } : file
                            )
                        );
                        fileDiscoveryRef.current.add(discoveryKey);
                    }
                });
        }
    }
  }, [trackedFiles, activeTrackerFileIndex]);

  useEffect(() => {
    if (activeTab === 'tracker' && ipcRenderer) {
      setFfmpegFound(null); // Checking state
      ipcRenderer.invoke('check-ffmpeg').then((result: { found: boolean }) => {
        setFfmpegFound(result.found);
      });
    }
  }, [activeTab]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData((prev) => ({ ...prev, [name]: checked }));
      } else if (name === 'characterCount') {
        setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
      }
      else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    },[],
  );

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
    if (!activeApiKey) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn một API Key đang hoạt động.' });
      setIsManagingKeys(true);
      return;
    }
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
        setFeedback({ type: 'error', message: 'Vui lòng nhập Lời bài hát hoặc Ý tưởng.' });
        setIsLoading(false);
        return;
      }
      const selectedGenre = mvGenreOptions.find(o => o.value === formData.mvGenre)?.label || formData.mvGenre;
      const selectedFilmingStyle = filmingStyleOptions.find(o => o.value === formData.filmingStyle)?.label || formData.filmingStyle;
      
      userPrompt += ` The creative input (lyrics or a detailed idea) is: "${formData.idea.trim()}".`;
      userPrompt += `\n**User Specifications:**`;
      userPrompt += `\n- **Nationality:** ${formData.country}`;
      userPrompt += `\n- **Enforce Character Consistency:** ${formData.characterConsistency ? 'Yes' : 'No'}`;
      if (formData.characterConsistency) {
        userPrompt += `\n- **Number of Consistent Characters:** ${formData.characterCount}`;
      }
      userPrompt += `\n- **Music Video Genre:** "${selectedGenre}"`;
      userPrompt += `\n- **Filming Style:** "${selectedFilmingStyle}"`;

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

    userPrompt += `\n**Task:** The video should have exactly ${sceneCount} scenes, structured with a clear visual arc and adhering to all specifications.`;


    const parts: any[] = [{ text: userPrompt }];
    if (videoType === 'live' && formData.liveArtistImage) {
      parts.push({
        inlineData: { mimeType: formData.liveArtistImage.mimeType, data: formData.liveArtistImage.base64 },
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey.value });
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
      const errorMessage = String(err?.message || err || 'An unknown error occurred.');
      let displayMessage = errorMessage;

      if (errorMessage.includes('API key not valid')) {
        displayMessage = 'Lỗi xác thực. API key đang sử dụng không hợp lệ hoặc đã hết hạn. Vui lòng chọn hoặc thêm khóa khác.';
        setIsManagingKeys(true);
      } else if (errorMessage.includes('quota')) {
        displayMessage = 'Bạn đã vượt quá hạn ngạch sử dụng cho Khóa API này.';
      } else if (errorMessage.includes('Requested entity was not found')) {
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
  
      const dataForExcel = dataForTracker.map(job => ({ ...job, status: '' }));

      const headers = [['JOB_ID', 'PROMPT', 'IMAGE_PATH', 'IMAGE_PATH_2', 'IMAGE_PATH_3', 'STATUS', 'VIDEO_NAME', 'TYPE_VIDEO']];
      const worksheet = XLSX.utils.aoa_to_sheet(headers);
      
      XLSX.utils.sheet_add_json(worksheet, dataForExcel, {
        header: ['id', 'prompt', 'imagePath', 'imagePath2', 'imagePath3', 'status', 'videoName', 'typeVideo'],
        skipHeader: true,
        origin: 'A2', 
      });

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

      const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
      const newTrackedFile: TrackedFile = {
        name: fullFileName,
        jobs: dataForTracker,
        path: filePath,
        targetDurationSeconds: totalSeconds,
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
    if (result.success && result.files.length > 0) {
        try {
            const newFiles: TrackedFile[] = [];
            for (const file of result.files) {
                const loadedJobs = parseExcelData(file.content);
                newFiles.push({
                    name: file.name,
                    jobs: loadedJobs,
                    path: file.path,
                });
            }
            setTrackedFiles(prev => [...prev, ...newFiles]);
            setActiveTrackerFileIndex(trackedFiles.length + newFiles.length - 1);
        } catch (error) {
            console.error("Error parsing Excel file(s):", error);
            setFeedback({ type: 'error', message: 'Không thể đọc một hoặc nhiều file. File không đúng định dạng hoặc đã bị lỗi.' });
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
  
  const handleLinkVideo = async (jobId: string, fileIndex: number) => {
    if (!ipcRenderer) return;
    const result = await ipcRenderer.invoke('open-video-file-dialog');
    if (result.success && result.path) {
        setTrackedFiles(prevFiles => {
            const newFiles = [...prevFiles];
            const fileToUpdate = { ...newFiles[fileIndex] };
            fileToUpdate.jobs = fileToUpdate.jobs.map(job =>
                job.id === jobId ? { ...job, videoPath: result.path } : job
            );
            newFiles[fileIndex] = fileToUpdate;
            return newFiles;
        });
    }
  };
  
  const executeCombineForFile = async (file: TrackedFile, mode: 'normal' | 'timed') => {
      if (!ipcRenderer || !ffmpegFound) return false;

      const completedJobs = file.jobs.filter(j => j.status === 'Completed' && j.videoPath);
      if (completedJobs.length < 1) {
          setFeedback({ type: 'error', message: `File "${file.name}" không có video hoàn thành nào để ghép.` });
          return false;
      }

      if (mode === 'timed') {
          const targetDuration = file.targetDurationSeconds;
          if (!targetDuration || targetDuration <= 0) {
              setFeedback({ type: 'error', message: `File "${file.name}" không có thời lượng mục tiêu.` });
              return false;
          }
      }

      try {
          const result = await ipcRenderer.invoke('execute-ffmpeg-combine', {
              jobs: completedJobs,
              targetDuration: file.targetDurationSeconds,
              mode: mode,
              excelFileName: file.name,
          });

          if (result.success) {
              setLastCombinedVideoPath(result.filePath);
              return true;
          } else if (result.error && result.error !== 'Save dialog canceled') {
              throw new Error(result.error);
          } else {
              // Canceled by user
              return false;
          }
      } catch (err: any) {
          throw err; // Propagate error up
      }
  };
  
  const handleExecuteCombine = async (mode: 'normal' | 'timed') => {
      const currentFile = trackedFiles[activeTrackerFileIndex];
      if (!currentFile) return;

      setIsCombiningVideo(true);
      setLastCombinedVideoPath(null);
      setFeedback({ type: 'info', message: `Bắt đầu quá trình ghép video cho "${currentFile.name}"...` });
      
      try {
          const success = await executeCombineForFile(currentFile, mode);
          if (success) {
              setFeedback({ type: 'success', message: `Ghép video thành công cho "${currentFile.name}"!` });
          } else {
              setFeedback(null); // Canceled by user
          }
      } catch (err: any) {
          setFeedback({ type: 'error', message: `Lỗi ghép video: ${err.message}` });
      } finally {
          setIsCombiningVideo(false);
      }
  };

  const handleCombineAllFiles = async () => {
    if (trackedFiles.length === 0 || !ipcRenderer || !ffmpegFound) return;

    setIsCombiningAll(true);
    setLastCombinedVideoPath(null);
    setFeedback({ type: 'info', message: 'Chuẩn bị ghép hàng loạt...' });

    const filesToProcess = trackedFiles
      .map(file => ({
        name: file.name,
        jobs: file.jobs.filter(j => j.status === 'Completed' && j.videoPath),
      }))
      .filter(file => file.jobs.length > 0);

    if (filesToProcess.length === 0) {
      setFeedback({ type: 'error', message: 'Không có file nào có video đã hoàn thành để ghép.' });
      setIsCombiningAll(false);
      return;
    }

    try {
      // The main process will now ask for the directory
      const result = await ipcRenderer.invoke('execute-ffmpeg-combine-all', filesToProcess);

      if (result.canceled) {
        setFeedback({ type: 'info', message: 'Đã hủy thao tác ghép hàng loạt.' });
      } else {
        const { successes, failures } = result;
        const finalMessage = `Hoàn tất ghép hàng loạt. Thành công: ${successes.length}. Thất bại: ${failures.length}.`;
        
        let feedbackType: 'success' | 'error' | 'info' = 'success';
        if (failures.length > 0 && successes.length === 0) {
            feedbackType = 'error';
        } else if (failures.length > 0) {
            feedbackType = 'info'; // Partial success
        }
        
        setFeedback({ type: feedbackType, message: finalMessage });
      }
    } catch (err: any) {
      console.error('Fatal error during combine all:', err);
      setFeedback({ type: 'error', message: `Lỗi nghiêm trọng khi ghép hàng loạt: ${err.message}` });
    } finally {
      setIsCombiningAll(false);
    }
  };
  
  const handleCopyPath = async (path: string | undefined) => {
    if (!path) return;
    try {
        await navigator.clipboard.writeText(path);
        setFeedback({ type: 'info', message: 'Đã sao chép đường dẫn!' });
    } catch (err) {
        setFeedback({ type: 'error', message: 'Không thể sao chép đường dẫn.' });
    }
    setTimeout(() => setFeedback(null), 2000);
  };
  
  const handleOpenFolder = (filePath: string | undefined) => {
    if (!ipcRenderer || !filePath) return;
    ipcRenderer.send('open-folder', getFolderPath(filePath));
  };

  const handleOpenToolFlows = async () => {
    if (!ipcRenderer) {
        setFeedback({ type: 'error', message: 'Chức năng này chỉ có trên ứng dụng desktop.' });
        return;
    }
    setFeedback({ type: 'info', message: 'Đang mở ToolFlows...' });
    const result = await ipcRenderer.invoke('open-tool-flow');
    if (!result.success && result.error !== 'User canceled selection.') {
        setFeedback({ type: 'error', message: `Lỗi: ${result.error}` });
    } else {
        setFeedback(null);
    }
  };
  
  const handleSetToolFlowsPath = async () => {
    if (!ipcRenderer) {
        setFeedback({ type: 'error', message: 'Chức năng này chỉ có trên ứng dụng desktop.' });
        return;
    }
    setFeedback({ type: 'info', message: 'Vui lòng chọn file thực thi của ToolFlows...' });
    const result = await ipcRenderer.invoke('set-tool-flow-path');
    if (result.success) {
        setFeedback({ type: 'success', message: `Đã cập nhật đường dẫn ToolFlows: ${result.path}` });
    } else if (result.error && result.error !== 'User canceled selection.') {
        setFeedback({ type: 'error', message: `Lỗi: ${result.error}` });
    } else {
        setFeedback(null);
    }
  };

  const handlePlayVideo = (videoPath: string | undefined) => {
    if (!ipcRenderer || !videoPath) return;
    ipcRenderer.send('open-video-path', videoPath);
  };

  const handleShowInFolder = (videoPath: string | undefined) => {
      if (!ipcRenderer || !videoPath) return;
      ipcRenderer.send('show-video-in-folder', videoPath);
  };

  const handleDeleteVideo = async (jobId: string, videoPath: string | undefined) => {
      if (!ipcRenderer || !videoPath) return;
      const result = await ipcRenderer.invoke('delete-video-file', videoPath);
      if (result.success) {
          setTrackedFiles(prevFiles => {
              const newFiles = [...prevFiles];
              if (newFiles[activeTrackerFileIndex]) {
                  const fileToUpdate = { ...newFiles[activeTrackerFileIndex] };
                  fileToUpdate.jobs = fileToUpdate.jobs.map(job =>
                      job.id === jobId ? { ...job, videoPath: undefined } : job
                  );
                  newFiles[activeTrackerFileIndex] = fileToUpdate;
              }
              return newFiles;
          });
          setFeedback({ type: 'success', message: 'Đã xóa video thành công.' });
      } else if (result.error && result.error !== 'User canceled deletion.') {
          setFeedback({ type: 'error', message: `Lỗi khi xóa video: ${result.error}` });
      }
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

  const renderResultCell = (job: VideoJob, fileIndex: number) => {
    const containerClasses = "w-40 h-24 bg-black/30 rounded-md flex items-center justify-center text-center p-2";
    switch(job.status) {
      case 'Completed':
        if (job.videoPath) {
          return (
            <div className="flex items-center gap-2">
                <div className="w-40 h-24 bg-black rounded-md overflow-hidden relative group">
                    <video src={job.videoPath} className="w-full h-full object-cover" muted loop playsInline onMouseOver={e => e.currentTarget.play().catch(console.error)} onMouseOut={e => e.currentTarget.pause()}></video>
                    <button onClick={() => handlePlayVideo(job.videoPath)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <PlayIcon className="w-8 h-8 text-white"/>
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <button onClick={() => handlePlayVideo(job.videoPath)} title="Mở video" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"><PlayIcon className="w-4 h-4 text-white" /></button>
                    <button onClick={() => handleShowInFolder(job.videoPath)} title="Mở thư mục chứa video" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"><FolderIcon className="w-4 h-4 text-white" /></button>
                    <button onClick={() => handleDeleteVideo(job.id, job.videoPath)} title="Xóa video" className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 transition"><TrashIcon className="w-4 h-4 text-red-300" /></button>
                </div>
            </div>
          );
        }
        return (
          <div className={`${containerClasses} flex-col text-indigo-200`}>
             <VideoIcon className="w-8 h-8 text-gray-400 mb-1" />
             <p className="text-xs font-semibold mb-1">Không tìm thấy video</p>
             <button onClick={() => handleLinkVideo(job.id, fileIndex)} className="text-xs text-indigo-300 hover:underline">Link thủ công</button>
          </div>
        );
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
  if (isActivated && (!activeApiKey || isManagingKeys)) {
    return <ApiKeyManagerScreen apiKeys={apiKeys} onKeyAdd={handleKeyAdd} onKeyDelete={handleKeyDelete} onKeySelect={handleKeySelect} />;
  }
  
  const currentFile = trackedFiles.length > 0 ? trackedFiles[activeTrackerFileIndex] : null;
  const stats = currentFile ? {
    completed: currentFile.jobs.filter(j => j.status === 'Completed').length,
    inProgress: currentFile.jobs.filter(j => j.status === 'Processing' || j.status === 'Generating').length,
    total: currentFile.jobs.length,
  } : null;

  const formatDuration = (totalSeconds?: number) => {
    if (totalSeconds === undefined || totalSeconds === null) return '--:--';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="relative w-full h-full">
      <div className="text-white min-h-screen p-4">
        <div className="w-full max-w-7xl mx-auto">
          <header className="text-center mb-6 relative">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">🎬 Prompt Generator Pro</h1>
            <p className="text-lg text-indigo-200 mt-2">Biến ý tưởng thành kịch bản & theo dõi sản xuất video.</p>
            {activeApiKey && (
              <div className="absolute top-0 right-0">
                  <div className="active-key-display">
                      <KeyIcon className="w-4 h-4 text-emerald-400" />
                      <span className="text-white font-semibold">{activeApiKey.name}</span>
                      <button onClick={() => setIsManagingKeys(true)} className="ml-2 text-indigo-300 hover:text-white font-bold text-sm">(Thay đổi)</button>
                  </div>
              </div>
            )}
          </header>

          <div className="flex space-x-2">
            <TabButton tabName="generator">Tạo Kịch Bản</TabButton>
            <TabButton tabName="tracker">Theo Dõi Sản Xuất</TabButton>
          </div>

          <div className="glass-card rounded-b-2xl rounded-tr-2xl p-6 sm:p-8 shadow-2xl">
            {activeTab === 'generator' && (
              <main>
                <div className="space-y-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-indigo-100 mb-2">1. Chọn loại Video</label>
                    <div className="flex items-center space-x-2 glass-card p-2 rounded-lg">
                      <RadioLabel name="videoType" value="story" checked={videoType === 'story'} onChange={setVideoType}>MV Kể Chuyện</RadioLabel>
                      <RadioLabel name="videoType" value="live" checked={videoType === 'live'} onChange={setVideoType}>Live Acoustic</RadioLabel>
                    </div>
                  </div>

                  <div className={`${videoType === 'story' ? 'block' : 'hidden'} space-y-6`}>
                    <div>
                      <label htmlFor="idea" className="block text-sm font-medium text-indigo-100 mb-2">Nhập Lời bài hát hoặc Ý tưởng Kịch bản</label>
                      <textarea id="idea" name="idea" value={formData.idea} onChange={handleInputChange} rows={4} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Dán toàn bộ lời bài hát hoặc mô tả chi tiết ý tưởng của bạn cho MV..."></textarea>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="mvGenre" className="block text-sm font-medium text-indigo-100 mb-2">Chọn Thể Loại MV</label>
                            <select id="mvGenre" name="mvGenre" value={formData.mvGenre} onChange={handleInputChange} className="w-full bg-indigo-900/60 border-2 border-indigo-400/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition">
                                {mvGenreOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filmingStyle" className="block text-sm font-medium text-indigo-100 mb-2">Phong cách quay</label>
                            <select id="filmingStyle" name="filmingStyle" value={formData.filmingStyle} onChange={handleInputChange} className="w-full bg-indigo-900/60 border-2 border-indigo-400/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition">
                                {filmingStyleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="country" className="block text-sm font-medium text-indigo-100 mb-2">Quốc gia (Nationality)</label>
                            <select id="country" name="country" value={formData.country} onChange={handleInputChange} className="w-full bg-indigo-900/60 border-2 border-indigo-400/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition">
                                {countryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                     </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-indigo-100 mb-2">Đồng nhất nhân vật chính</label>
                            <div className="flex items-center space-x-2 glass-card p-2 rounded-lg">
                               <RadioLabel name="characterConsistency" value="true" checked={formData.characterConsistency} onChange={(val) => setFormData(p => ({ ...p, characterConsistency: val === 'true' }))}>Có</RadioLabel>
                               <RadioLabel name="characterConsistency" value="false" checked={!formData.characterConsistency} onChange={(val) => setFormData(p => ({ ...p, characterConsistency: val === 'true' }))}>Không</RadioLabel>
                            </div>
                        </div>
                        {formData.characterConsistency && (
                           <div>
                                <label htmlFor="characterCount" className="block text-sm font-medium text-indigo-100 mb-2">Số lượng nhân vật đồng nhất</label>
                                <select id="characterCount" name="characterCount" value={formData.characterCount} onChange={handleInputChange} className="w-full bg-indigo-900/60 border-2 border-indigo-400/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition">
                                    <option value={1}>1 nhân vật</option>
                                    <option value={2}>2 nhân vật</option>
                                    <option value={3}>3 nhân vật</option>
                                </select>
                            </div>
                        )}
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
                      <select id="model" name="model" value={formData.model} onChange={handleInputChange} className="w-full bg-indigo-900/60 border-2 border-indigo-400/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition">
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
                
                {feedback && ( <div className={`text-center mt-6 font-medium p-3 rounded-lg flex items-center justify-center gap-4 ${ feedback.type === 'error' ? 'text-red-300 bg-red-900/50' : feedback.type === 'success' ? 'text-emerald-300 bg-emerald-900/50' : 'text-blue-300 bg-blue-900/50' }`}>
                    <span>{feedback.message}</span>
                    {feedback.type === 'success' && lastCombinedVideoPath && (
                        <button onClick={() => handlePlayVideo(lastCombinedVideoPath)} className="bg-white/10 text-white font-bold py-1 px-4 rounded-full hover:bg-white/20 transition text-sm flex items-center gap-2">
                            <PlayIcon className="w-4 h-4" /> Mở Video
                        </button>
                    )}
                </div> )}
                {generatedScenes.length > 0 && !feedback && (
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

                        {feedback && ( <div className={`text-center font-medium p-3 rounded-lg flex items-center justify-center gap-4 ${ feedback.type === 'error' ? 'text-red-300 bg-red-900/50' : feedback.type === 'success' ? 'text-emerald-300 bg-emerald-900/50' : 'text-blue-300 bg-blue-900/50' }`}>
                            <span>{feedback.message}</span>
                            {feedback.type === 'success' && lastCombinedVideoPath && (
                                <button onClick={() => handlePlayVideo(lastCombinedVideoPath)} className="bg-white/10 text-white font-bold py-1 px-4 rounded-full hover:bg-white/20 transition text-sm flex items-center gap-2">
                                    <PlayIcon className="w-4 h-4" /> Mở Video Đã Ghép
                                </button>
                            )}
                        </div> )}
                        
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
                               <div className="flex justify-between items-start mb-4 gap-4">
                                  <div className="tracker-tabs-container flex-grow">
                                      {trackedFiles.map((file, index) => {
                                          const completedCount = file.jobs.filter(j => j.status === 'Completed').length;
                                          const totalJobs = file.jobs.length;
                                          const progress = totalJobs > 0 ? (completedCount / totalJobs) * 100 : 0;

                                          return (
                                            <button key={`${file.path}-${index}`} className={`tracker-tab ${activeTrackerFileIndex === index ? 'active' : ''}`} onClick={() => setActiveTrackerFileIndex(index)}>
                                                <div 
                                                    className="tab-progress-frame"
                                                    style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                                                ></div>
                                                <span>{file.name}</span>
                                                <span className="tab-close-btn" onClick={(e) => { e.stopPropagation(); handleCloseTrackerTab(index); }}>&times;</span>
                                            </button>
                                          )
                                      })}
                                  </div>
                                  <button onClick={handleOpenNewFile} className="bg-white/10 text-white font-bold py-2 px-6 rounded-full hover:bg-white/20 transition whitespace-nowrap">Tải File Mới</button>
                               </div>

                                {currentFile && stats && (
                                  <>
                                  <div className="bg-black/20 p-4 rounded-lg mb-4 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                      <div className="text-center">
                                          <div className="text-2xl font-bold text-emerald-400">{stats.completed}/{stats.total}</div>
                                          <div className="text-xs text-gray-400 uppercase tracking-wider">Hoàn thành</div>
                                      </div>
                                      <div className="text-center">
                                          <div className="text-2xl font-bold text-amber-400">{stats.inProgress}</div>
                                          <div className="text-xs text-gray-400 uppercase tracking-wider">Đang xử lý</div>
                                      </div>
                                       <div className="text-center">
                                          <div className="text-2xl font-bold text-indigo-300">{formatDuration(currentFile.targetDurationSeconds)}</div>
                                          <div className="text-xs text-gray-400 uppercase tracking-wider">Thời lượng</div>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex rounded-full bg-purple-500 hover:bg-purple-600 transition shadow-md">
                                            <button onClick={handleOpenToolFlows} className="flex items-center gap-2 text-white font-bold py-2 pl-4 pr-3 text-sm">
                                                <ExternalLinkIcon className="w-4 h-4"/>
                                                <span>Mở ToolFlows</span>
                                            </button>
                                            <button onClick={handleSetToolFlowsPath} className="text-white font-bold py-2 pr-3 pl-2 text-sm border-l border-purple-400 hover:bg-purple-700 rounded-r-full" title="Thay đổi đường dẫn ToolFlows">
                                                <CogIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                        <button onClick={() => handleOpenFolder(currentFile.path)} className="flex items-center gap-2 bg-indigo-500 text-white font-bold py-2 px-4 rounded-full hover:bg-indigo-600 transition text-sm">
                                            <FolderIcon className="w-4 h-4"/>
                                            <span>Mở Thư mục</span>
                                        </button>
                                        <button onClick={() => handleCopyPath(getFolderPath(currentFile.path))} className="flex items-center gap-2 bg-white/10 text-white py-2 px-4 rounded-full hover:bg-white/20 transition text-sm">
                                            <CopyIcon className="w-4 h-4"/>
                                            <span>Copy Path Thư mục</span>
                                        </button>
                                        
                                        {ffmpegFound === null ? (
                                            <button 
                                                disabled 
                                                className="bg-gray-500 text-white font-bold py-2 px-4 rounded-full cursor-not-allowed"
                                            >
                                                Đang kiểm tra FFmpeg...
                                            </button>
                                        ) : !ffmpegFound ? (
                                            <button 
                                                disabled
                                                className="bg-red-500 text-white font-bold py-2 px-4 rounded-full cursor-not-allowed"
                                                title="FFmpeg không được tìm thấy. Vui lòng cài đặt lại ứng dụng."
                                            >
                                                Thiếu FFmpeg
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={handleCombineAllFiles}
                                                    disabled={trackedFiles.length === 0 || isCombiningAll || isCombiningVideo}
                                                    className="bg-orange-500 text-white font-bold py-2 px-4 rounded-full hover:bg-orange-600 transition whitespace-nowrap disabled:bg-gray-500 disabled:cursor-not-allowed"
                                                    title="Ghép video lần lượt cho tất cả các file đang được theo dõi."
                                                >
                                                    {isCombiningAll ? 'Đang xử lý...' : 'Ghép Thường Tất Cả'}
                                                </button>
                                                <button 
                                                    onClick={() => handleExecuteCombine('normal')}
                                                    disabled={!currentFile.jobs.some(j => j.status === 'Completed' && j.videoPath) || isCombiningVideo || isCombiningAll}
                                                    className="bg-teal-500 text-white font-bold py-2 px-4 rounded-full hover:bg-teal-600 transition whitespace-nowrap disabled:bg-gray-500 disabled:cursor-not-allowed"
                                                    title="Ghép các video đã hoàn thành của file hiện tại theo thứ tự."
                                                >
                                                    {(isCombiningVideo && !isCombiningAll) ? 'Đang xử lý...' : 'Ghép Thường'}
                                                </button>
                                                <button 
                                                    onClick={() => handleExecuteCombine('timed')}
                                                    disabled={!currentFile.jobs.some(j => j.status === 'Completed' && j.videoPath) || !currentFile.targetDurationSeconds || isCombiningVideo || isCombiningAll}
                                                    className="bg-cyan-500 text-white font-bold py-2 px-4 rounded-full hover:bg-cyan-600 transition whitespace-nowrap disabled:bg-gray-500 disabled:cursor-not-allowed"
                                                    title="Ghép các video đã hoàn thành của file hiện tại và đồng bộ với thời lượng bài hát"
                                                >
                                                    {(isCombiningVideo && !isCombiningAll) ? 'Đang xử lý...' : 'Ghép Theo Thời Gian'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                  </div>
                                  
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
                                              {currentFile.jobs.map(job => (
                                                  <tr key={job.id}>
                                                      <td className="font-mono text-sm">{job.id}</td>
                                                      <td><span className={getStatusBadge(job.status)}>{job.status}</span></td>
                                                      <td className="font-medium">{job.videoName}</td>
                                                      <td>{renderResultCell(job, activeTrackerFileIndex)}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                                  </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            )}
          </div>
        </div>
      </div>
      {appVersion && isActivated && (
        <div className="absolute bottom-2 right-4 text-xs text-indigo-300/50 font-mono z-50">
          v{appVersion}
        </div>
      )}
    </div>
  );
};

export default App;