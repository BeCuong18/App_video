
import React, { useState, ChangeEvent, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { FormData, Scene, MvGenre, Preset, StatsData } from '../types';
import { storySystemPrompt, in2vSystemPrompt } from '../constants';
import Results from './Results';
import { LoaderIcon, TrashIcon, UploadIcon, FolderIcon } from './Icons';

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

interface GeneratorProps {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    presets: Preset[];
    onSavePresets: (newPresets: Preset[]) => void;
    onGenerateSuccess: (scenes: Scene[], formData: FormData, detectedType: 'TEXT' | 'IN2V') => void;
    onFeedback: (feedback: { type: 'error' | 'success' | 'info', message: string } | null) => void;
    apiKey?: string;
    activeApiKeyId?: string;
}

export const Generator: React.FC<GeneratorProps> = ({ formData, setFormData, presets, onSavePresets, onGenerateSuccess, onFeedback, apiKey, activeApiKeyId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
    const [lastDetectedType, setLastDetectedType] = useState<'TEXT' | 'IN2V'>('TEXT');
    const [newPresetName, setNewPresetName] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [modelUsageCount, setModelUsageCount] = useState(0);

    // Việt hóa Options
    const mvGenreOptions: { value: MvGenre, label: string }[] = [
        { value: 'narrative', label: 'Kể Chuyện / Phim Ngắn' },
        { value: 'cinematic-short-film', label: 'Điện Ảnh (Cinematic)' },
        { value: 'performance', label: 'Biểu Diễn / Sân Khấu' },
        { value: 'dance-choreography', label: 'Nhảy / Vũ Đạo' },
        { value: 'lyrical', label: 'Video Lời Bài Hát (Lyric)' },
        { value: 'conceptual', label: 'Nghệ Thuật / Trừu Tượng' },
        { value: 'abstract-visualizer', label: 'Hiệu Ứng Thị Giác (Visualizer)' },
        { value: 'scenic', label: 'Cảnh Đẹp / Chill' },
        { value: 'animation', label: 'Hoạt Hình 2D/3D' },
        { value: 'one-take', label: 'Một Cú Máy (One-shot)' },
        { value: 'surreal', label: 'Mộng Mơ / Kỳ Ảo' },
        { value: 'sci-fi', label: 'Khoa Học Viễn Tưởng' },
        { value: 'horror', label: 'Kinh Dị / Rùng Rợn' },
        { value: 'historical-period', label: 'Cổ Trang / Lịch Sử' },
        { value: 'retro-futurism', label: 'Phong Cách Retro' },
        { value: 'social-commentary', label: 'Phóng Sự / Đời Sống' },
        { value: 'documentary', label: 'Tài Liệu' },
    ];
  
    const filmingStyleOptions = [
        { value: 'auto', label: 'Tự Động (AI Chọn Đẹp Nhất)' },
        { value: 'Vintage', label: 'Cổ Điển (Vintage)' },
        { value: 'Modern & Sharp', label: 'Hiện Đại & Sắc Nét' },
        { value: 'B&W Artistic', label: 'Đen Trắng Nghệ Thuật' },
        { value: 'Cyberpunk', label: 'Neon Cyberpunk' },
        { value: 'Moody', label: 'Tâm Trạng / Tối (Moody)' },
        { value: 'Golden Hour', label: 'Giờ Vàng (Nắng Chiều)' },
        { value: 'Minimalist', label: 'Tối Giản (Minimalist)' },
        { value: 'Dreamy', label: 'Mơ Mộng (Dreamy)' },
        { value: 'Drone FPV', label: 'Flycam / FPV Drone' },
        { value: 'Slow Motion', label: 'Quay Chậm (Slow Motion)' },
        { value: 'Macro Details', label: 'Cận Cảnh Chi Tiết (Macro)' },
        { value: 'POV', label: 'Góc Nhìn Thứ Nhất (POV)' },
        { value: 'Handheld', label: 'Cầm Tay (Rung Nhẹ)' },
        { value: 'Pastel / Symmetric', label: 'Màu Pastel / Đối Xứng' },
        { value: 'VHS', label: 'Băng Từ (VHS)' },
        { value: 'Ghibli Style', label: 'Hoạt Hình Ghibli' },
        { value: 'Pixar Style', label: 'Hoạt Hình Pixar' },
    ];

    const musicGenreOptions = [
        { value: 'V-Pop', label: 'V-Pop' },
        { value: 'K-Pop', label: 'K-Pop' },
        { value: 'US-UK Pop', label: 'US-UK Pop' },
        { value: 'Jazz Bossa Nova', label: 'Jazz Bossa Nova' },
        { value: 'Smooth Jazz', label: 'Smooth Jazz' },
        { value: 'EDM', label: 'EDM (Nhạc Điện Tử)' },
        { value: 'Worship', label: 'Nhạc Thờ Phượng' },
        { value: 'Country', label: 'Nhạc Đồng Quê' },
        { value: 'Custom', label: 'Khác (Nhập Thủ Công)' },
    ];

    const countryOptions = [
        { value: 'Việt Nam', label: 'Việt Nam' },
        { value: 'Mỹ (American)', label: 'Mỹ' },
        { value: 'Anh (British)', label: 'Anh' },
        { value: 'Hàn Quốc (South Korean)', label: 'Hàn Quốc' },
        { value: 'Nhật Bản (Japanese)', label: 'Nhật Bản' },
        { value: 'Trung Quốc (Chinese)', label: 'Trung Quốc' },
        { value: 'Pháp (French)', label: 'Pháp' },
        { value: 'Brazil', label: 'Brazil' },
        { value: 'Tây Ban Nha (Spanish)', label: 'Tây Ban Nha' },
        { value: 'International', label: 'Quốc Tế' },
    ];

    const refreshUsageCount = () => {
        if (ipcRenderer && activeApiKeyId) {
            ipcRenderer.invoke('get-stats').then((stats: StatsData) => {
                const count = stats.modelUsage?.[activeApiKeyId]?.[formData.model] || 0;
                setModelUsageCount(count);
            });
        }
    };

    useEffect(() => { refreshUsageCount(); }, [formData.model, activeApiKeyId]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
          const checked = (e.target as HTMLInputElement).checked;
          setFormData((prev) => ({ ...prev, [name]: checked }));
        } else if (name === 'characterCount') {
          setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) || 1 }));
        } else if (name === 'temperature') {
          setFormData((prev) => ({ ...prev, [name]: parseFloat(value) }));
        } else if (name === 'songMinutes') {
          let val = parseInt(value, 10);
          if (isNaN(val)) val = 0;
          val = Math.max(0, Math.min(15, val));
          setFormData((prev) => ({ ...prev, [name]: val.toString() }));
        } else if (name === 'songSeconds') {
          let val = parseInt(value, 10);
          if (isNaN(val)) val = 0;
          val = Math.max(0, Math.min(59, val));
          setFormData((prev) => ({ ...prev, [name]: val.toString() }));
        } else {
          setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleMultiImageUpload = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] as any; 
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string') {
            const base64Data = reader.result.split(',')[1];
            if (base64Data) {
                setFormData(prev => {
                    const updated = [...prev.uploadedImages];
                    updated[index] = { 
                        base64: base64Data, 
                        mimeType: file.type, 
                        name: file.name,
                        path: file.path || file.name 
                    };
                    return { ...prev, uploadedImages: updated };
                });
            }
          }
        };
        reader.readAsDataURL(file);
    };

    const clearImage = (index: number) => {
        setFormData(prev => {
            const updated = [...prev.uploadedImages];
            updated[index] = null;
            return { ...prev, uploadedImages: updated };
        });
    };

    const handleSavePreset = () => {
        if (!newPresetName.trim()) return;
        const newPreset: Preset = { id: crypto.randomUUID(), name: newPresetName.trim(), settings: formData };
        onSavePresets([...presets, newPreset]);
        setNewPresetName('');
    };

    const handlePresetSelect = (pid: string) => {
        setSelectedPresetId(pid);
        const p = presets.find(pre => pre.id === pid);
        if (p) setFormData(prev => ({ ...prev, ...p.settings }));
    };

    const handleDeletePreset = () => {
        if (!selectedPresetId) return;
        onSavePresets(presets.filter(p => p.id !== selectedPresetId));
        setSelectedPresetId('');
    };

    const handleManualSaveExcel = async () => {
        if (generatedScenes.length === 0) return;
        onGenerateSuccess(generatedScenes, formData, lastDetectedType);
    };

    const handleManualSaveTxt = async () => {
        if (generatedScenes.length === 0) return;
        
        const txtContent = generatedScenes.map(s => 
            `Cảnh ${s.scene_number}: ${s.scene_title}\n\n${s.prompt_text}\n${'-'.repeat(40)}\n`
        ).join('\n');

        const safeName = (formData.projectName || 'MV').replace(/[^a-z0-9_]/gi, '_');
        const fileName = `${safeName}.txt`;

        if (ipcRenderer) {
            const res = await ipcRenderer.invoke('save-file-dialog', { defaultPath: fileName, fileContent: txtContent });
            if (res.success) {
                onFeedback({ type: 'success', message: 'Đã lưu file TXT thành công!' });
            }
        } else {
            const blob = new Blob([txtContent], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            onFeedback({ type: 'success', message: 'Đã tải xuống file TXT!' });
        }
    };

    const generatePrompts = async () => {
        const currentApiKey = process.env.API_KEY || apiKey;
        if (!currentApiKey) {
            onFeedback({ type: 'error', message: 'Thiếu API Key' });
            return;
        }

        setIsLoading(true);
        onFeedback(null);
        setGeneratedScenes([]);

        const hasImages = formData.uploadedImages.some(img => img !== null);
        const effectiveType: 'TEXT' | 'IN2V' = hasImages ? 'IN2V' : 'TEXT';
        setLastDetectedType(effectiveType);

        const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
        if (totalSeconds <= 0) {
            onFeedback({ type: 'error', message: 'Thời lượng phải lớn hơn 0' });
            setIsLoading(false);
            return;
        }

        const sceneCount = Math.max(3, Math.round(totalSeconds / 8));
        const systemPrompt = effectiveType === 'TEXT' ? storySystemPrompt : in2vSystemPrompt;
        const musicGenreDisplay = formData.musicGenre === 'Custom' ? formData.customMusicGenre : formData.musicGenre;
        let userPrompt = `Idea: "${formData.idea.trim()}". Specs: Country: ${formData.country}, Genre: ${formData.mvGenre}, Music: ${musicGenreDisplay}, Style: ${formData.filmingStyle}, Character Consistency: ${formData.characterConsistency}, Count: ${formData.characterCount}. Generate exactly ${sceneCount} professionally formatted scenes for an AI video model.`;

        const parts: any[] = [{ text: userPrompt }];
        if (effectiveType === 'IN2V') {
            formData.uploadedImages.forEach((img) => {
                if (img) parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
            });
        }

        try {
            const ai = new GoogleGenAI({ apiKey: currentApiKey });
            const response = await ai.models.generateContent({
                model: formData.model,
                contents: { parts },
                config: {
                    systemInstruction: systemPrompt,
                    temperature: formData.temperature,
                    thinkingConfig: { thinkingBudget: 0 },
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

            const responseText = response.text || '{}';
            const parsedData = JSON.parse(responseText);
            if (parsedData.prompts) {
                setGeneratedScenes(parsedData.prompts);
                if (ipcRenderer && activeApiKeyId) {
                    const res = await ipcRenderer.invoke('increment-prompt-count', { modelName: formData.model, apiKeyId: activeApiKeyId });
                    if (res.success) setModelUsageCount(res.count);
                    else refreshUsageCount();
                }
            }
        } catch (err: any) {
            onFeedback({ type: 'error', message: `Lỗi: ${err.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="space-y-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-mac-surface p-4 rounded-mac-lg shadow-mac-card border border-mac-border/20">
                <div className="flex flex-1 gap-4 items-center w-full">
                     <div className="relative shrink-0 w-full xl:w-64">
                        <select name="model" value={formData.model} onChange={handleInputChange} className="w-full text-xs font-semibold text-mac-text h-10 px-3">
                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Nhanh)</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-flash-lite-latest">Gemini 2.5 Flash Lite</option>
                        </select>
                        <div className={`absolute right-8 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-[10px] font-bold ${modelUsageCount >= 18 ? 'bg-red-500 text-white' : 'bg-mac-surface-sec text-mac-text-sec'} pointer-events-none`}>
                            {modelUsageCount}/20
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-1">
                        <select value={selectedPresetId} onChange={e => handlePresetSelect(e.target.value)} className="w-full text-xs font-medium text-mac-text h-10 px-3">
                            <option value="">Chọn Cấu Hình Mẫu...</option>
                            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={handleDeletePreset} disabled={!selectedPresetId} className="h-10 w-10 flex items-center justify-center text-mac-text-sec hover:text-red-500 hover:bg-red-50 rounded-mac transition shrink-0" title="Xóa Preset"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                </div>

                <div className="flex gap-2 items-center w-full xl:w-auto">
                    <input 
                        type="text" 
                        value={newPresetName} 
                        onChange={e => setNewPresetName(e.target.value)} 
                        className="flex-1 text-xs h-10 px-3" 
                        placeholder="Tên cấu hình..." 
                    />
                    <button 
                        onClick={handleSavePreset} 
                        disabled={!newPresetName.trim()}
                        className="bg-mac-surface-sec border border-mac-border hover:bg-white text-mac-text font-medium px-4 h-10 rounded-mac text-xs transition disabled:opacity-50"
                    >
                        Lưu Preset
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                 <div className="xl:col-span-8 space-y-6">
                     <div className="bg-mac-surface p-6 rounded-mac-lg shadow-mac-card border border-mac-border/20">
                        <h3 className="text-sm font-semibold text-mac-text mb-4">1. Ý Tưởng Chính / Lời Bài Hát</h3>
                        <textarea name="idea" value={formData.idea} onChange={handleInputChange} rows={6} className="w-full p-4 text-sm text-mac-text leading-relaxed resize-none" placeholder="Mô tả ý tưởng video, lời bài hát hoặc câu chuyện tại đây..." />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-mac-surface p-6 rounded-mac-lg shadow-mac-card border border-mac-border/20">
                            <h3 className="text-sm font-semibold text-mac-text mb-4">2. Định Hướng Nghệ Thuật</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Quốc Gia</label>
                                        <select name="country" value={formData.country} onChange={handleInputChange} className="w-full text-xs font-medium h-9 px-2">
                                            {countryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Thể Loại Nhạc</label>
                                        <select name="musicGenre" value={formData.musicGenre} onChange={handleInputChange} className="w-full text-xs font-medium h-9 px-2">
                                            {musicGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        {formData.musicGenre === 'Custom' && (
                                            <input 
                                                type="text" 
                                                name="customMusicGenre" 
                                                value={formData.customMusicGenre} 
                                                onChange={handleInputChange} 
                                                className="w-full mt-2 text-xs h-9 px-2" 
                                                placeholder="Nhập tên..."
                                            />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Phong Cách Video</label>
                                    <select name="mvGenre" value={formData.mvGenre} onChange={handleInputChange} className="w-full text-xs font-medium h-9 px-2">
                                        {mvGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Góc Quay (Cinematography)</label>
                                    <select name="filmingStyle" value={formData.filmingStyle} onChange={handleInputChange} className="w-full text-xs font-medium h-9 px-2">
                                        {filmingStyleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-mac-surface p-6 rounded-mac-lg shadow-mac-card border border-mac-border/20">
                            <h3 className="text-sm font-semibold text-mac-text mb-4">3. Ảnh Gốc (Tự Động I2V)</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-3">
                                    {[0, 1, 2].map(idx => (
                                        <div key={idx} className="relative aspect-square rounded-mac bg-mac-surface-sec border border-dashed border-mac-border flex items-center justify-center overflow-hidden hover:bg-gray-100 transition cursor-pointer group">
                                            {formData.uploadedImages[idx] ? (
                                                <>
                                                    <img src={`data:${formData.uploadedImages[idx]!.mimeType};base64,${formData.uploadedImages[idx]!.base64}`} className="w-full h-full object-cover" alt="asset" />
                                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearImage(idx); }} className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-xs">&times;</button>
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <UploadIcon className="w-5 h-5 mx-auto text-mac-border mb-1" />
                                                    <span className="block text-[10px] text-mac-text-sec">Ảnh {idx + 1}</span>
                                                </div>
                                            )}
                                            <input type="file" accept="image/*" onChange={handleMultiImageUpload(idx)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                    ))}
                                </div>

                                <div className="p-3 bg-mac-surface-sec rounded-mac border border-mac-border/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" name="characterConsistency" checked={formData.characterConsistency} onChange={handleInputChange} className="w-4 h-4 rounded text-mac-accent focus:ring-mac-accent" />
                                        <label className="text-xs font-medium text-mac-text">Đồng Nhất Khuôn Mặt</label>
                                    </div>
                                    {formData.characterConsistency && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] text-mac-text-sec">Số người</label>
                                            <input type="number" name="characterCount" value={formData.characterCount} onChange={handleInputChange} min={1} max={3} className="w-10 h-8 text-center text-xs font-semibold" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>

                 <div className="xl:col-span-4 space-y-6 sticky top-4">
                    <div className="bg-mac-surface p-6 rounded-mac-lg border border-mac-border/20 shadow-mac-card">
                        <h3 className="text-sm font-semibold text-mac-text mb-6">Thông Tin Dự Án</h3>
                        <div className="space-y-5 mb-8">
                            <div>
                                <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Tên Dự Án</label>
                                <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} className="w-full text-sm font-medium h-10 px-3" placeholder="MV_Tet_2026" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Phút</label>
                                    <input type="number" name="songMinutes" value={formData.songMinutes} min="0" max="15" onChange={handleInputChange} className="w-full text-center font-bold h-10 text-mac-text" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[11px] font-medium text-mac-text-sec mb-1.5">Giây</label>
                                    <input type="number" name="songSeconds" value={formData.songSeconds} min="0" max="59" onChange={handleInputChange} className="w-full text-center font-bold h-10 text-mac-text" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <button 
                                onClick={generatePrompts} 
                                disabled={isLoading} 
                                className="w-full py-3 bg-mac-accent hover:bg-mac-accent-hover text-white font-semibold text-sm rounded-mac shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <><LoaderIcon /><span className="text-xs">Đang Xử Lý...</span></> : 'Tạo Kịch Bản Prompt'}
                            </button>

                            {generatedScenes.length > 0 && (
                                <div className="flex flex-col gap-3 pt-2 border-t border-mac-border/30">
                                    {/* Primary Action: Excel */}
                                    <button 
                                        onClick={handleManualSaveExcel}
                                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-mac shadow-sm transition-all flex items-center justify-center gap-2"
                                    >
                                        <FolderIcon className="w-4 h-4 text-white" /> Xuất File Excel
                                    </button>
                                    
                                    {/* Secondary Action: TXT */}
                                    <button 
                                        onClick={handleManualSaveTxt}
                                        className="w-full py-2 bg-transparent text-mac-text-sec hover:text-mac-text font-medium text-xs rounded-mac transition-all flex items-center justify-center gap-2 hover:bg-mac-surface-sec"
                                    >
                                        <span className="font-bold border border-current rounded px-1 text-[10px]">TXT</span> Lưu bản nháp Text
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
            </div>

            <Results scenes={generatedScenes} />
        </main>
    );
};
