
import React, { useState, ChangeEvent, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { FormData, Scene, MvGenre, Preset, StatsData } from '../types';
import { storySystemPrompt, in2vSystemPrompt } from '../constants';
import Results from './Results';
import { LoaderIcon, TrashIcon, UploadIcon } from './Icons';

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

interface GeneratorProps {
    presets: Preset[];
    onSavePresets: (newPresets: Preset[]) => void;
    onGenerateSuccess: (scenes: Scene[], formData: FormData, detectedType: 'TEXT' | 'IN2V') => void;
    onFeedback: (feedback: { type: 'error' | 'success' | 'info', message: string } | null) => void;
    apiKey?: string;
    activeApiKeyId?: string;
}

export const Generator: React.FC<GeneratorProps> = ({ presets, onSavePresets, onGenerateSuccess, onFeedback, apiKey, activeApiKeyId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
    const [newPresetName, setNewPresetName] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [modelUsageCount, setModelUsageCount] = useState(0);

    const [formData, setFormData] = useState<FormData>({
        idea: '', in2vAtmosphere: '', uploadedImages: [null, null, null], liveArtistName: '', liveArtist: '',
        songMinutes: '3', songSeconds: '30', projectName: '',
        model: 'gemini-3-flash-preview', mvGenre: 'narrative', filmingStyle: 'auto',
        country: 'Việt Nam', musicGenre: 'V-Pop', customMusicGenre: '',
        characterConsistency: true, characterCount: 1, temperature: 0.3
    });

    const mvGenreOptions: { value: MvGenre, label: string }[] = [
        { value: 'narrative', label: 'Kể chuyện / Phim ngắn' },
        { value: 'cinematic-short-film', label: 'Điện ảnh (Cinematic)' },
        { value: 'performance', label: 'Trình diễn / Biểu diễn' },
        { value: 'dance-choreography', label: 'Nhảy / Vũ đạo' },
        { value: 'lyrical', label: 'Video lời bài hát (Lyric)' },
        { value: 'conceptual', label: 'Nghệ thuật / Trừu tượng' },
        { value: 'abstract-visualizer', label: 'Hiệu ứng hình ảnh (Visualizer)' },
        { value: 'scenic', label: 'Cảnh đẹp / Chill (Không người)' },
        { value: 'animation', label: 'Hoạt hình (2D/3D)' },
        { value: 'one-take', label: 'Một cú máy (One-shot)' },
        { value: 'surreal', label: 'Mộng mơ / Kỳ ảo' },
        { value: 'sci-fi', label: 'Khoa học viễn tưởng' },
        { value: 'horror', label: 'Kinh dị / Rùng rợn' },
        { value: 'historical-period', label: 'Cổ trang / Lịch sử' },
        { value: 'retro-futurism', label: 'Phong cách Retro / Cổ điển' },
        { value: 'social-commentary', label: 'Phóng sự / Đời sống' },
        { value: 'documentary', label: 'Tài liệu' },
    ];
  
    const filmingStyleOptions = [
        { value: 'auto', label: 'AI tự chọn (Đẹp nhất)' },
        { value: 'Vintage', label: 'Màu phim cũ (Vintage)' },
        { value: 'Modern & Sharp', label: 'Hiện đại & Sắc nét' },
        { value: 'B&W Artistic', label: 'Đen trắng nghệ thuật' },
        { value: 'Cyberpunk', label: 'Neon (Cyberpunk)' },
        { value: 'Moody', label: 'Tông tối / Tâm trạng' },
        { value: 'Golden Hour', label: 'Nắng vàng (Golden Hour)' },
        { value: 'Minimalist', label: 'Tối giản (Minimalist)' },
        { value: 'Dreamy', label: 'Mộng mơ (Dreamy)' },
        { value: 'Drone FPV', label: 'Quay Flycam' },
        { value: 'Slow Motion', label: 'Quay chậm (Slow Motion)' },
        { value: 'Macro Details', label: 'Cận cảnh chi tiết' },
        { value: 'POV', label: 'Góc nhìn thứ nhất (POV)' },
        { value: 'Handheld', label: 'Cầm tay (Rung nhẹ)' },
        { value: 'Pastel / Symmetric', label: 'Màu Pastel / Đối xứng' },
        { value: 'VHS', label: 'Băng từ (VHS)' },
        { value: 'Ghibli Style', label: 'Hoạt hình Ghibli' },
        { value: 'Pixar Style', label: 'Hoạt hình Pixar' },
    ];

    const musicGenreOptions = [
        { value: 'V-Pop', label: 'V-Pop' },
        { value: 'K-Pop', label: 'K-Pop' },
        { value: 'US-UK Pop', label: 'US-UK Pop' },
        { value: 'Jazz Bossa Nova', label: 'Jazz Bossa Nova' },
        { value: 'Smooth Jazz', label: 'Smooth Jazz' },
        { value: 'EDM', label: 'EDM (Electronic Dance Music)' },
        { value: 'Worship', label: 'Nhạc Thờ Phụng (Worship)' },
        { value: 'Country', label: 'Nhạc Country' },
        { value: 'Custom', label: 'Khác (Nhập thủ công)' },
    ];

    const countryOptions = [
        { value: 'Việt Nam', label: 'Việt Nam' },
        { value: 'Mỹ (American)', label: 'Mỹ (American)' },
        { value: 'Anh (British)', label: 'Anh (British)' },
        { value: 'Hàn Quốc (South Korean)', label: 'Hàn Quốc (South Korean)' },
        { value: 'Nhật Bản (Japanese)', label: 'Nhật Bản (Japanese)' },
        { value: 'Trung Quốc (Chinese)', label: 'Trung Quốc (Chinese)' },
        { value: 'Pháp (French)', label: 'Pháp (French)' },
        { value: 'Brazil', label: 'Brazil' },
        { value: 'Tây Ban Nha (Spanish)', label: 'Tây Ban Nha (Spanish)' },
        { value: 'International', label: 'Quốc tế / Không xác định' },
    ];

    useEffect(() => {
        if (ipcRenderer && activeApiKeyId) {
            ipcRenderer.invoke('get-stats').then((stats: StatsData) => {
                const count = stats.modelUsage?.[activeApiKeyId]?.[formData.model] || 0;
                setModelUsageCount(count);
            });
        }
    }, [formData.model, activeApiKeyId]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
          const checked = (e.target as HTMLInputElement).checked;
          setFormData((prev) => ({ ...prev, [name]: checked }));
        } else if (name === 'characterCount') {
          setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) || 1 }));
        } else if (name === 'temperature') {
          setFormData((prev) => ({ ...prev, [name]: parseFloat(value) }));
        } else {
          setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleMultiImageUpload = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string') {
            const base64Data = reader.result.split(',')[1];
            if (base64Data) {
                setFormData(prev => {
                    const updated = [...prev.uploadedImages];
                    updated[index] = { base64: base64Data, mimeType: file.type, name: file.name };
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
        // Saves entire formData state (Artistic Direction, Time, Count, Consistency, etc.)
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

    const generatePrompts = async () => {
        const currentApiKey = process.env.API_KEY || apiKey;
        if (!currentApiKey) {
            onFeedback({ type: 'error', message: 'Vui lòng cấu hình API Key trong mục Quản lý API.' });
            return;
        }
        if (modelUsageCount >= 20) {
            onFeedback({ type: 'error', message: 'Bạn đã đạt giới hạn 20 lượt tạo Prompt cho Model này.' });
            return;
        }

        setIsLoading(true);
        onFeedback(null);
        setGeneratedScenes([]);

        // Detect mode automatically
        const hasImages = formData.uploadedImages.some(img => img !== null);
        const effectiveType: 'TEXT' | 'IN2V' = hasImages ? 'IN2V' : 'TEXT';

        const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
        const sceneCount = Math.max(3, Math.round(totalSeconds / 8));
        const systemPrompt = effectiveType === 'TEXT' ? storySystemPrompt : in2vSystemPrompt;
        
        let userPrompt = `Idea: "${formData.idea.trim()}". Specs: Country: ${formData.country}, Genre: ${formData.mvGenre}, Music: ${formData.musicGenre}, Style: ${formData.filmingStyle}, Character Consistency: ${formData.characterConsistency}, Count: ${formData.characterCount}. Generate ${sceneCount} scenes.`;

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
                }
                onGenerateSuccess(parsedData.prompts, formData, effectiveType);
            }
        } catch (err: any) {
            onFeedback({ type: 'error', message: `Lỗi: ${err.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="space-y-6">
            {/* Top Bar: Model & Presets & Save Quick Preset */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center bg-white p-3 rounded-[32px] border-2 border-tet-gold shadow-md">
                {/* Selection Section */}
                <div className="flex flex-1 gap-3 items-center">
                     <div className="relative shrink-0">
                        <select name="model" value={formData.model} onChange={handleInputChange} className="rounded-2xl p-2 pr-20 text-[10px] border-2 border-stone-100 focus:border-tet-red bg-tet-cream font-black uppercase">
                            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-flash-lite-latest">Gemini 2.5 Flash Lite</option>
                        </select>
                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg text-[8px] font-black ${modelUsageCount >= 18 ? 'bg-red-500 text-white' : 'bg-tet-gold text-tet-brown'} border border-white shadow-sm pointer-events-none`}>
                            {modelUsageCount}/20
                        </div>
                    </div>
                    <div className="h-6 w-0.5 bg-stone-100 mx-1 shrink-0"></div>
                    <div className="flex items-center gap-2 flex-1">
                        <select value={selectedPresetId} onChange={e => handlePresetSelect(e.target.value)} className="flex-1 rounded-2xl p-2 text-[10px] border-2 border-stone-100 focus:border-tet-red bg-tet-cream font-bold uppercase min-w-[140px]">
                            <option value="">-- CHỌN CÀI ĐẶT SẴN --</option>
                            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={handleDeletePreset} disabled={!selectedPresetId} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition shrink-0"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                </div>

                {/* Save Section - Moved up here near the selector */}
                <div className="flex gap-2 p-1.5 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 items-center xl:w-[450px]">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={newPresetName} 
                            onChange={e => setNewPresetName(e.target.value)} 
                            className="w-full bg-white border-none rounded-xl p-2 text-[10px] font-bold focus:ring-0" 
                            placeholder="Tên kịch bản để lưu nhanh..." 
                        />
                    </div>
                    <button 
                        onClick={handleSavePreset} 
                        disabled={!newPresetName.trim()}
                        className="bg-tet-gold hover:bg-tet-gold-dark text-tet-brown disabled:opacity-50 font-black px-6 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-colors shadow-sm whitespace-nowrap"
                    >
                        LƯU CÀI ĐẶT NHANH
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                 <div className="xl:col-span-8 space-y-6">
                     {/* 1. Core Idea */}
                     <div className="bg-white/95 p-8 rounded-[32px] shadow-lg border-2 border-tet-red relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <span className="text-8xl">✍️</span>
                        </div>
                        <h3 className="text-tet-red-dark font-black uppercase text-[10px] mb-6 tracking-[0.2em] border-b-2 border-dashed border-tet-red/20 pb-2">1. Ý TƯỞNG CỐT LÕI (LYRICS / STORY)</h3>
                        <textarea name="idea" value={formData.idea} onChange={handleInputChange} rows={6} className="w-full p-5 transition resize-none shadow-inner text-sm leading-relaxed border-2 border-tet-gold/30 focus:border-tet-red bg-tet-cream font-bold" placeholder="Nhập lời bài hát hoặc kịch bản chi tiết. Nếu up ảnh bên dưới, AI sẽ tự động chuyển sang chế độ I2V..." />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 2. Artistic Direction */}
                        <div className="bg-white/95 p-8 rounded-[32px] shadow-lg border-2 border-tet-gold relative">
                            <h3 className="text-tet-brown font-black uppercase text-[10px] mb-6 tracking-[0.2em] border-b-2 border-dashed border-tet-gold/20 pb-2">2. ĐỊNH HƯỚNG NGHỆ THUẬT</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">QUỐC GIA</label>
                                        <select name="country" value={formData.country} onChange={handleInputChange} className="w-full p-3 text-xs focus:border-tet-red border-2 border-stone-100 bg-tet-cream">
                                            {countryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">THỂ LOẠI NHẠC</label>
                                        <select name="musicGenre" value={formData.musicGenre} onChange={handleInputChange} className="w-full p-3 text-xs focus:border-tet-red border-2 border-stone-100 bg-tet-cream">
                                            {musicGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">THỂ LOẠI MV</label>
                                    <select name="mvGenre" value={formData.mvGenre} onChange={handleInputChange} className="w-full p-3 text-xs focus:border-tet-red border-2 border-stone-100 bg-tet-cream">
                                        {mvGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">PHONG CÁCH QUAY (CINEMATOGRAPHY)</label>
                                    <select name="filmingStyle" value={formData.filmingStyle} onChange={handleInputChange} className="w-full p-3 text-xs focus:border-tet-red border-2 border-stone-100 bg-tet-cream">
                                        {filmingStyleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 3. Assets & Identity */}
                        <div className="bg-white/95 p-8 rounded-[32px] shadow-lg border-2 border-tet-green relative">
                            <h3 className="text-tet-green font-black uppercase text-[10px] mb-6 tracking-[0.2em] border-b-2 border-dashed border-tet-green/20 pb-2">3. HÌNH ẢNH GỐC (TỰ ĐỘNG I2V)</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-2">
                                    {[0, 1, 2].map(idx => (
                                        <div key={idx} className="relative aspect-square border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50 flex items-center justify-center overflow-hidden hover:border-tet-red transition-colors cursor-pointer group">
                                            {formData.uploadedImages[idx] ? (
                                                <>
                                                    <img src={`data:${formData.uploadedImages[idx]!.mimeType};base64,${formData.uploadedImages[idx]!.base64}`} className="w-full h-full object-cover" alt="asset" />
                                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearImage(idx); }} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">&times;</button>
                                                </>
                                            ) : (
                                                <div className="text-center">
                                                    <UploadIcon className="w-6 h-6 mx-auto opacity-20 mb-1" />
                                                    <span className="block text-[7px] font-black text-stone-300 uppercase">Up ảnh {idx + 1}</span>
                                                </div>
                                            )}
                                            <input type="file" accept="image/*" onChange={handleMultiImageUpload(idx)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" name="characterConsistency" checked={formData.characterConsistency} onChange={handleInputChange} className="w-5 h-5 accent-tet-green" />
                                        <label className="text-[10px] font-black text-tet-green uppercase tracking-widest">Đồng nhất khuôn mặt</label>
                                    </div>
                                    {formData.characterConsistency && (
                                        <input type="number" name="characterCount" value={formData.characterCount} onChange={handleInputChange} min={1} max={3} className="w-12 p-1 text-center bg-white border-2 border-emerald-200 rounded-lg font-black text-tet-green" />
                                    )}
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>

                 {/* Action Sidebar */}
                 <div className="xl:col-span-4 space-y-6 sticky top-4">
                    <div className="bg-white/95 p-8 rounded-[32px] border-4 border-tet-gold/40 shadow-xl relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <span className="text-6xl">📊</span>
                        </div>
                        <h3 className="text-tet-brown font-black uppercase text-[10px] mb-6 border-b-2 border-stone-100 pb-2 tracking-[0.2em]">THÔNG TIN DỰ ÁN</h3>
                        <div className="space-y-5 mb-8">
                            <div>
                                <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">Tên Dự Án (Export File)</label>
                                <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} className="w-full bg-tet-cream border-2 border-stone-100 rounded-2xl p-4 text-xs focus:border-tet-red font-black" placeholder="MV_XUAN_BINH_NGO" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">Phút</label>
                                    <input type="number" name="songMinutes" value={formData.songMinutes} onChange={handleInputChange} className="w-full bg-tet-cream border-2 border-stone-100 rounded-2xl p-4 text-center text-xl font-black" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[8px] font-black text-stone-400 uppercase tracking-widest mb-2">Giây</label>
                                    <input type="number" name="songSeconds" value={formData.songSeconds} onChange={handleInputChange} className="w-full bg-tet-cream border-2 border-stone-100 rounded-2xl p-4 text-center text-xl font-black" />
                                </div>
                            </div>
                        </div>
                        <button onClick={generatePrompts} disabled={isLoading || modelUsageCount >= 20} className="w-full py-5 bg-gradient-to-b from-tet-red to-tet-red-dark text-tet-gold font-black text-lg uppercase tracking-widest rounded-2xl shadow-xl border-4 border-tet-gold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all">
                            {isLoading ? <LoaderIcon /> : '🧧 TẠO KỊCH BẢN'}
                        </button>
                    </div>
                 </div>
            </div>

            <Results scenes={generatedScenes} />
        </main>
    );
};
