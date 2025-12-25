
import React, { useState, ChangeEvent } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { FormData, Scene, MvGenre, Preset } from '../types';
import { storySystemPrompt, in2vSystemPrompt } from '../constants';
import Results from './Results';
import { LoaderIcon, TrashIcon } from './Icons';

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

interface GeneratorProps {
    presets: Preset[];
    onSavePresets: (newPresets: Preset[]) => void;
    onGenerateSuccess: (scenes: Scene[], formData: FormData) => void;
    onFeedback: (feedback: { type: 'error' | 'success' | 'info', message: string } | null) => void;
}

export const Generator: React.FC<GeneratorProps> = ({ presets, onSavePresets, onGenerateSuccess, onFeedback }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
    const [newPresetName, setNewPresetName] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState('');

    const [formData, setFormData] = useState<FormData>({
        idea: '', in2vAtmosphere: '', uploadedImages: [null, null, null], liveArtistName: '', liveArtist: '',
        songMinutes: '3', songSeconds: '30', projectName: '',
        model: 'gemini-3-flash-preview', mvGenre: 'narrative', filmingStyle: 'auto',
        country: 'Vietnamese', musicGenre: 'v-pop', customMusicGenre: '',
        characterConsistency: true, characterCount: 1, temperature: 0.3,
        videoType: 'story',
    });

    const mvGenreOptions: { value: MvGenre, label: string }[] = [
        { value: 'narrative', label: 'Kể chuyện / Phim ngắn' },
        { value: 'cinematic-short-film', label: 'Điện ảnh (Cinematic)' },
        { value: 'performance', label: 'Trình diễn / Biểu diễn' },
        { value: 'dance-choreography', label: 'Nhảy / Vũ đạo' },
        { value: 'lyrical', label: 'Video lời bài hát (Lyric)' },
        { value: 'conceptual', label: 'Nghệ thuật / Trừu tượng' },
        { value: 'abstract-visualizer', label: 'Hiệu ứng hình ảnh' },
        { value: 'scenic', label: 'Cảnh đẹp / Chill (Không người)' },
        { value: 'animation', label: 'Hoạt hình (2D/3D)' },
        { value: 'one-take', label: 'Một cú máy (One-shot)' },
        { value: 'surreal', label: 'Mộng mơ / Kỳ ảo' },
        { value: 'sci-fi', label: 'Khoa học viễn tưởng' },
        { value: 'horror', label: 'Kinh dị / Rùng rợn' },
        { value: 'historical-period', label: 'Cổ trang / Lịch sử' },
        { value: 'retro-futurism', label: 'Phong cách Retro' },
        { value: 'social-commentary', label: 'Phóng sự / Đời sống' },
        { value: 'documentary', label: 'Tài liệu' },
    ];
  
    const filmingStyleOptions = [
        { value: 'auto', label: 'AI tự chọn (Đẹp nhất)' },
        { value: 'Vintage 35mm Film', label: 'Màu phim cũ (Vintage)' },
        { value: 'Sharp & Modern Digital', label: 'Hiện đại & Sắc nét' },
        { value: 'Artistic Black & White', label: 'Đen trắng nghệ thuật' },
        { value: 'Cinematic Neon Noir', label: 'Neon (Cyberpunk)' },
        { value: 'Dark & Moody Low-Key', label: 'Tông tối / Tâm trạng' },
        { value: 'Golden Hour Glow', label: 'Nắng vàng (Golden Hour)' },
        { value: 'Clean & Minimalist', label: 'Tối giản (Minimalist)' },
        { value: 'Surreal & Dreamlike', label: 'Mộng mơ (Dreamy)' },
        { value: 'Epic Drone Cinematography', label: 'Quay Flycam' },
        { value: 'High-Speed Slow Motion', label: 'Quay chậm (Slow Motion)' },
        { value: 'Macro & Extreme Close-up', label: 'Cận cảnh chi tiết' },
        { value: 'GoPro / POV', label: 'Góc nhìn thứ nhất' },
        { value: 'Found Footage / Handheld', label: 'Cầm tay (Rung nhẹ)' },
        { value: 'Wes Anderson Style', label: 'Màu Pastel / Đối xứng' },
        { value: '80s VHS Look', label: 'Băng từ (VHS)' },
        { value: '2D Animation (Ghibli Style)', label: 'Hoạt hình Ghibli' },
        { value: '3D Animation (Pixar Style)', label: 'Hoạt hình Pixar' },
    ];
    
    const countryOptions = [
      { value: 'Vietnamese', label: 'Việt Nam' }, { value: 'American', label: 'Mỹ (American)' },
      { value: 'British', label: 'Anh (British)' }, { value: 'South Korean', label: 'Hàn Quốc' },
      { value: 'Japanese', label: 'Nhật Bản' }, { value: 'Chinese', label: 'Trung Quốc' },
      { value: 'French', label: 'Pháp' }, { value: 'Brazilian', label: 'Brazil' },
      { value: 'Spanish', label: 'Tây Ban Nha' }, { value: 'Generic/International', label: 'Quốc tế' },
    ];
  
    const musicGenreOptions = [
      { value: 'v-pop', label: 'V-Pop' }, { value: 'k-pop', label: 'K-Pop' },
      { value: 'us-uk-pop', label: 'US-UK Pop' }, { value: 'jazz-bossa-nova', label: 'Jazz Bossa Nova' },
      { value: 'smooth-jazz', label: 'Smooth Jazz' }, { value: 'edm', label: 'EDM' },
      { value: 'worship', label: 'Nhạc Thờ Phụng' }, { value: 'country', label: 'Nhạc Country' },
      { value: 'other', label: 'Khác (Nhập thủ công)' }
    ];

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
          const checked = (e.target as HTMLInputElement).checked;
          setFormData((prev) => ({ ...prev, [name]: checked }));
        } else if (name === 'characterCount') {
          setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
        } else if (name === 'temperature') {
          setFormData((prev) => ({ ...prev, [name]: parseFloat(value) }));
        } else if (name === 'songMinutes') {
            if (value === '') { setFormData(prev => ({ ...prev, songMinutes: '' })); return; }
            let val = parseInt(value);
            if (isNaN(val)) val = 0; if (val < 0) val = 0; if (val > 15) val = 15;
            setFormData(prev => ({ ...prev, songMinutes: val.toString(), songSeconds: (val === 15) ? '0' : prev.songSeconds }));
        } else if (name === 'songSeconds') {
            let val = parseInt(value);
            if (isNaN(val) || val < 0) val = 0;
            setFormData(prev => {
                if (parseInt(prev.songMinutes) >= 15) return { ...prev, songSeconds: '0' }; 
                if (val > 59) val = 59;
                return { ...prev, songSeconds: val.toString() };
            });
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
        onSavePresets(presets.filter(p => p.id !== selectedPresetId));
        setSelectedPresetId('');
    };

    const generatePrompts = async () => {
        setIsLoading(true);
        onFeedback(null);
        setGeneratedScenes([]);

        const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
        const sceneCount = Math.max(3, Math.round(totalSeconds / 8));
        const systemPrompt = formData.videoType === 'story' ? storySystemPrompt : in2vSystemPrompt;
        
        let userPrompt = `Mode: ${formData.videoType}. Input Idea/Lyrics: "${formData.idea.trim()}". Specs: Nationality: ${formData.country}, Genre: ${formData.mvGenre}, Style: ${formData.filmingStyle}, Music Genre: ${formData.musicGenre === 'other' ? formData.customMusicGenre : formData.musicGenre}. Generate exactly ${sceneCount} scenes. Character Consistency Enforced: ${formData.characterConsistency}, Number of Characters: ${formData.characterCount}.`;

        const parts: any[] = [{ text: userPrompt }];
        // Only provide images to Gemini in IN2V mode
        if (formData.videoType === 'in2v') {
            formData.uploadedImages.forEach((img, i) => {
                if (img) {
                    parts.push({ text: `Analyze this reference image ${i+1} for visual consistency:` });
                    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
                }
            });
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

            const parsedData = JSON.parse(response.text || '{}');
            if (parsedData.prompts) {
                setGeneratedScenes(parsedData.prompts);
                if (ipcRenderer) ipcRenderer.invoke('increment-prompt-count');
            }
        } catch (err: any) {
            onFeedback({ type: 'error', message: `Lỗi: ${err.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="space-y-6">
            <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                <div className="flex flex-1 w-full xl:w-auto gap-3 p-2 bg-white rounded-3xl border-2 border-tet-gold shadow-sm">
                     <select value={selectedPresetId} onChange={e => handlePresetSelect(e.target.value)} className="flex-1 rounded-2xl p-2 text-sm border-2 border-stone-200 focus:border-tet-red bg-tet-cream font-bold">
                        <option value="">-- Tải Cài Đặt Sẵn --</option>
                        {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={handleDeletePreset} disabled={!selectedPresetId} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200"><TrashIcon className="w-4 h-4"/></button>
                    <input type="text" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} className="flex-1 rounded-2xl p-2 text-sm placeholder-gray-400 border-2 border-stone-200 focus:border-tet-red bg-tet-cream font-bold" placeholder="Tên cài đặt mới..." />
                    <button onClick={handleSavePreset} className="bg-tet-gold hover:bg-tet-gold-dark text-tet-brown font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow transition transform hover:scale-105 border-2 border-white">Lưu</button>
                </div>

                <div className="flex p-1.5 bg-white rounded-full border-2 border-tet-gold shadow-sm self-center xl:self-auto">
                    <button onClick={() => setFormData(p => ({ ...p, videoType: 'story' }))} className={`px-6 py-2.5 rounded-full font-bold transition text-xs uppercase tracking-wide ${formData.videoType === 'story' ? 'bg-tet-red text-white shadow-lg' : 'text-stone-400 hover:text-tet-red'}`}>MV Kể Chuyện</button>
                    <button onClick={() => setFormData(p => ({ ...p, videoType: 'in2v' }))} className={`px-6 py-2.5 rounded-full font-bold transition text-xs uppercase tracking-wide ${formData.videoType === 'in2v' ? 'bg-tet-red text-white shadow-lg' : 'text-stone-400 hover:text-tet-red'}`}>MV Image to Video</button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                 <div className="xl:col-span-8 space-y-6">
                     <div className="bg-white/90 p-8 rounded-[32px] shadow-lg border-2 border-tet-red relative overflow-hidden group">
                        <h3 className="text-tet-red-dark font-black uppercase text-xs mb-6 tracking-widest flex items-center gap-2 border-b-2 border-dashed border-tet-red/30 pb-2">1. Nội Dung Cốt Lõi</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Ý Tưởng / Lời Bài Hát</label>
                                <textarea name="idea" value={formData.idea} onChange={handleInputChange} rows={6} className="w-full p-4 transition resize-none shadow-inner text-sm leading-relaxed border-2 border-tet-gold/50 focus:border-tet-red bg-tet-cream" placeholder="Nhập lời bài hát hoặc mô tả chi tiết ý tưởng..." />
                            </div>
                            {formData.videoType === 'in2v' && (
                                <div className="animate-fade-in">
                                    <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Bối cảnh / Không khí chủ đạo</label>
                                    <textarea name="in2vAtmosphere" value={formData.in2vAtmosphere} onChange={handleInputChange} rows={2} className="w-full p-4 transition text-sm border-2 border-tet-gold/50 focus:border-tet-red bg-tet-cream" placeholder="VD: Rừng thông mờ ảo..." />
                                </div>
                            )}
                        </div>
                     </div>

                     <div className="bg-white/90 p-8 rounded-[32px] shadow-lg border-2 border-tet-gold relative overflow-hidden group">
                        <h3 className="text-tet-brown font-black uppercase text-xs mb-6 tracking-widest flex items-center gap-2 border-b-2 border-dashed border-tet-gold/40 pb-2">2. Định Hướng Nghệ Thuật</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Quốc Gia</label>
                                <select name="country" value={formData.country} onChange={handleInputChange} className="w-full p-3 text-sm focus:border-tet-red border-2 border-tet-gold/50 bg-tet-cream">
                                    {countryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Nhạc nền</label>
                                <select name="musicGenre" value={formData.musicGenre} onChange={handleInputChange} className="w-full p-3 text-sm focus:border-tet-red border-2 border-tet-gold/50 bg-tet-cream">
                                    {musicGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Thể Loại MV</label>
                                <select name="mvGenre" value={formData.mvGenre} onChange={handleInputChange} className="w-full p-3 text-sm focus:border-tet-red border-2 border-tet-gold/50 bg-tet-cream">
                                    {mvGenreOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Phong Cách Quay</label>
                                <select name="filmingStyle" value={formData.filmingStyle} onChange={handleInputChange} className="w-full p-3 text-sm focus:border-tet-red border-2 border-tet-gold/50 bg-tet-cream">
                                    {filmingStyleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                     </div>

                     <div className="bg-white/90 p-8 rounded-[32px] shadow-lg border-2 border-tet-green relative overflow-hidden group">
                        <h3 className="text-tet-green font-black uppercase text-xs tracking-widest mb-6 border-b-2 border-dashed border-tet-green/20 pb-2">
                            3. {formData.videoType === 'story' ? 'Nhân Vật & Diễn Viên' : 'Dữ Liệu Hình Ảnh (Tối đa 3)'}
                        </h3>
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" name="characterConsistency" checked={formData.characterConsistency} onChange={handleInputChange} className="w-6 h-6 rounded-lg text-tet-red focus:ring-tet-red border-tet-gold cursor-pointer" />
                                    <label className="text-sm font-bold text-stone-700">Đồng nhất nhân vật (AI tự động tạo Blueprint)</label>
                                </div>
                                {formData.characterConsistency && (
                                    <div className="flex items-center gap-3 bg-tet-cream px-4 py-2 rounded-2xl border-2 border-tet-gold/20">
                                        <label className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">Số lượng nhân vật:</label>
                                        <input 
                                            type="number" 
                                            name="characterCount" 
                                            value={formData.characterCount} 
                                            onChange={handleInputChange} 
                                            min={1} 
                                            max={3} 
                                            className="w-14 bg-white border-2 border-white rounded-xl p-1 text-center text-tet-red font-black text-xl focus:border-tet-gold" 
                                        />
                                    </div>
                                )}
                            </div>

                            {formData.videoType === 'in2v' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                    {[0, 1, 2].map((idx) => {
                                        const img = formData.uploadedImages[idx];
                                        return (
                                            <div key={idx} className="relative group">
                                                <div className="relative border-2 border-dashed border-tet-gold/50 rounded-2xl p-2 bg-tet-cream hover:border-tet-red transition-colors aspect-square flex flex-col items-center justify-center overflow-hidden">
                                                    {img ? (
                                                        <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-center">
                                                            <span className="text-2xl">📸</span>
                                                            <span className="block text-[9px] font-bold uppercase mt-1">Tải ảnh {idx+1}</span>
                                                        </div>
                                                    )}
                                                    <input type="file" accept="image/*" onChange={handleMultiImageUpload(idx)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                     </div>
                 </div>

                 <div className="xl:col-span-4 space-y-6 sticky top-4">
                    <div className="bg-white/95 p-8 rounded-[32px] border-4 border-tet-gold/40 shadow-xl relative overflow-hidden">
                        <h3 className="text-tet-brown font-black uppercase text-xs mb-6 border-b-2 border-stone-100 pb-2 tracking-widest">Cấu hình Dự Án</h3>
                        <div className="mb-5">
                            <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Tên Dự Án</label>
                            <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} className="w-full bg-tet-cream border-2 border-tet-gold/50 rounded-2xl p-3 text-sm focus:border-tet-red font-bold" placeholder="VD: MV_Tet_2026" />
                        </div>
                        <div className="mb-5">
                            <label className="block text-[10px] font-bold text-tet-brown uppercase tracking-widest mb-2">Thời lượng (Phút/Giây)</label>
                            <div className="flex gap-2">
                                <input type="number" name="songMinutes" value={formData.songMinutes} onChange={handleInputChange} className="w-1/2 bg-tet-cream border-2 border-tet-gold/50 rounded-2xl p-3 text-center text-xl font-black" placeholder="Min" />
                                <input type="number" name="songSeconds" value={formData.songSeconds} onChange={handleInputChange} className="w-1/2 bg-tet-cream border-2 border-tet-gold/50 rounded-2xl p-3 text-center text-xl font-black" placeholder="Sec" />
                            </div>
                        </div>
                        <button onClick={generatePrompts} disabled={isLoading} className="w-full py-4 bg-gradient-to-b from-tet-red to-tet-red-dark text-tet-gold font-black text-lg uppercase tracking-widest rounded-2xl shadow-xl border-4 border-tet-gold">
                            {isLoading ? <LoaderIcon /> : '🧧 TẠO KỊCH BẢN'}
                        </button>
                    </div>
                    {generatedScenes.length > 0 && (
                        <button onClick={() => onGenerateSuccess(generatedScenes, formData)} className="w-full py-4 bg-emerald-400 text-white font-bold rounded-2xl shadow-md uppercase tracking-wide border-2 border-white">💾 Lưu & Theo dõi</button>
                    )}
                 </div>
            </div>
            <Results scenes={generatedScenes} />
        </main>
    );
};
