
import React, { useState, useCallback, ChangeEvent } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Scene, VideoType, UploadedImage, FormData } from './types';
import { storySystemPrompt, liveSystemPrompt } from './constants';
import Results from './components/Results';
import { LoaderIcon } from './components/Icons';
import { useGeminiApiKey } from './hooks/useGeminiApiKey';

declare const XLSX: any;

const WorkflowModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}> = ({ isOpen, onClose, scenes, currentIndex, setCurrentIndex }) => {
  if (!isOpen || scenes.length === 0) return null;

  const currentScene = scenes[currentIndex];

  const handleCopyAndNext = () => {
    navigator.clipboard.writeText(currentScene.prompt_text);
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl w-full max-w-2xl border border-white/30">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-indigo-100">Trợ lý Xuất Video Siêu Tốc</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">&times;</button>
        </div>
        <p className="text-indigo-200 mb-4">Sử dụng quy trình sau để có tốc độ nhanh nhất:</p>
        <ol className="list-decimal list-inside mb-6 text-white bg-black/20 p-4 rounded-lg">
            <li>Nhấn nút "Mở Google Flow" để mở công cụ trong tab mới.</li>
            <li>Nhấn vào nút **"Sao chép & Tới Cảnh Tiếp"** ở dưới.</li>
            <li>Chuyển qua tab Google Flow và Dán (Ctrl+V) prompt vào.</li>
            <li>Quay lại đây và lặp lại bước 2 và 3 cho đến hết kịch bản.</li>
        </ol>
        <div className="mb-4">
            <a href="https://labs.google/fx/vi/tools/flow" target="_blank" rel="noopener noreferrer" className="inline-block w-full sm:w-auto text-center bg-teal-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-600 transition shadow-lg">
                Mở Google Flow (trong tab mới)
            </a>
        </div>

        <div className="bg-black/30 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-indigo-100 mb-2">🎬 Cảnh {currentScene.scene_number}: {currentScene.scene_title}</h3>
            <textarea
              readOnly
              value={currentScene.prompt_text}
              className="w-full h-48 bg-white/5 border border-white/20 rounded-lg p-3 text-white font-mono text-sm"
            />
        </div>
        
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button onClick={handlePrevious} disabled={currentIndex === 0} className="bg-white/10 text-white font-bold py-2 px-4 rounded-lg hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  &larr; Cảnh Trước
              </button>
              <span className="font-bold text-indigo-100">{currentIndex + 1} / {scenes.length}</span>
            </div>
            <button 
              onClick={handleCopyAndNext} 
              className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300"
            >
              {currentIndex < scenes.length - 1 ? 'Sao chép & Tới Cảnh Tiếp &rarr;' : 'Sao chép Prompt Cuối Cùng'}
            </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
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
  const [error, setError] = useState<string | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<Scene[]>([]);
  const { apiKey, setApiKey, clearApiKey, isUsingFallbackKey } = useGeminiApiKey();
  const [showApiKey, setShowApiKey] = useState(false);

  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);

  const getSafeProjectSlug = useCallback(() => {
    return (formData.projectName.trim() || 'prompt_script').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  }, [formData.projectName]);

  const handleApiKeyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  }, [setApiKey]);

  const handleClearApiKey = useCallback(() => {
    clearApiKey();
  }, [clearApiKey]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleAspectRatioChange = (value: '16:9' | '9:16') => {
    setFormData(prev => ({...prev, aspectRatio: value}));
  };

  const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFormData(prev => ({ ...prev, liveArtistImage: null }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        setFormData(prev => ({
          ...prev,
          liveArtistImage: {
            base64: base64String,
            mimeType: file.type,
          }
        }));
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const generatePrompts = async () => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setError('Vui lòng nhập Gemini API Key trước khi tạo prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedScenes([]);

    const totalSeconds = (parseInt(formData.songMinutes) || 0) * 60 + (parseInt(formData.songSeconds) || 0);
    if (totalSeconds <= 0) {
      setError('Vui lòng nhập thời lượng bài hát hợp lệ.');
      setIsLoading(false);
      return;
    }
    
    let sceneCount = Math.round(totalSeconds / 7);
    if (sceneCount < 3) sceneCount = 3;

    const systemPrompt = videoType === 'story' ? storySystemPrompt : liveSystemPrompt;
    let userPrompt = `Generate prompts for a music video.`;
    
    if (videoType === 'story') {
        if (!formData.idea.trim()) {
            setError('Vui lòng nhập Ý tưởng cho MV.');
            setIsLoading(false);
            return;
        }
        userPrompt += ` The core idea is: "${formData.idea.trim()}".`;
    } else {
        if (!formData.liveAtmosphere.trim() && !formData.liveArtistName.trim() && !formData.liveArtist.trim() && !formData.liveArtistImage) {
            setError('Vui lòng nhập ít nhất một thông tin cho Video Trình Diễn Live.');
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
            inlineData: {
                mimeType: formData.liveArtistImage.mimeType,
                data: formData.liveArtistImage.base64
            }
        });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: trimmedApiKey });
      const response = await ai.models.generateContent({
        model: formData.model,
        contents: { parts: parts },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
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
                  required: ["scene_number", "scene_title", "prompt_text"],
                },
              },
            },
            required: ["prompts"],
          },
        }
      });
      
      let jsonText: string | undefined | null;
      if (typeof response.text === 'function') {
        jsonText = await response.text();
      } else if (typeof response.response?.text === 'function') {
        jsonText = await response.response.text();
      } else {
        jsonText = response.text ?? response.response?.text();
      }

      if (!jsonText) {
        throw new Error('Gemini không trả về nội dung nào.');
      }
      const parsedData = JSON.parse(jsonText);
      
      if (parsedData.prompts && Array.isArray(parsedData.prompts)) {
          setGeneratedScenes(parsedData.prompts);
      } else {
          throw new Error('AI response did not contain a valid "prompts" array.');
      }

    } catch (err: any) {
      console.error("Error generating prompts:", err);
      let displayMessage = err.message || 'An unknown error occurred.';
      if (err.message?.includes("API key not valid")) {
          displayMessage = "Lỗi xác thực. API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.";
      } else if (err.message?.includes("quota")) {
          displayMessage = "Bạn đã vượt quá hạn ngạch sử dụng cho Khóa API này.";
      } else if (err.message?.includes("Requested entity was not found")) {
          displayMessage = `Model "${formData.model}" không tồn tại hoặc bạn không có quyền truy cập. Vui lòng chọn model khác.`;
      }
      setError(`Đã có lỗi xảy ra: ${displayMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWorkflow = () => {
    setCurrentWorkflowIndex(0);
    setIsWorkflowModalOpen(true);
  };

  const exportToExcel = () => {
    if (generatedScenes.length === 0) {
      setError("Chưa có dữ liệu prompt để xuất!");
      return;
    }

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = formData.projectName.trim().replace(/[^a-z0-9_]/gi, '_').toUpperCase() || 'PROJECT';

    const dataToExport = generatedScenes.map((p, index) => ({
      'JOB_ID': `Job_${index + 1}`,
      'PROMPT': p.prompt_text,
      'IMAGE_PATH': '',
      'STATUS': '',
      'VIDEO_NAME': `${prefix}_${dateStr}_${index + 1}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 150 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prompts");

    const safeFileName = getSafeProjectSlug();
    XLSX.writeFile(workbook, `${safeFileName}.xlsx`);
  };

  const downloadFlowAutomationJson = () => {
    if (generatedScenes.length === 0) {
      setError("Chưa có dữ liệu prompt để tải!");
      return;
    }

    setError(null);

    const payload = {
      projectName: formData.projectName.trim() || 'Prompt Project',
      prompts: generatedScenes.map(scene => ({
        scene_number: scene.scene_number,
        scene_title: scene.scene_title,
        prompt_text: scene.prompt_text
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getSafeProjectSlug()}-google-flow-prompts.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const RadioLabel: React.FC<{ name: string; value: string; checked: boolean; onChange: (value: any) => void; children: React.ReactNode; }> = ({ name, value, checked, onChange, children }) => {
    return (
        <label className="relative flex items-center space-x-2 cursor-pointer p-2 rounded-md flex-1 justify-center text-center transition-colors">
            <input 
                type="radio" 
                name={name} 
                value={value} 
                className="absolute opacity-0 w-full h-full" 
                checked={checked}
                onChange={() => onChange(value)}
            />
            <span className={`relative z-10 ${checked ? 'font-bold text-white' : ''}`}>{children}</span>
            <div className={`absolute top-0 left-0 w-full h-full rounded-md transition-colors ${checked ? 'bg-indigo-500/50' : ''}`}></div>
        </label>
    );
  };
  
  return (
    <>
      <WorkflowModal 
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        scenes={generatedScenes}
        currentIndex={currentWorkflowIndex}
        setCurrentIndex={setCurrentWorkflowIndex}
      />
      <div className="text-white min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-5xl mx-auto">
          <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl">
            <header className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">🎬 Prompt Generator Pro</h1>
              <p className="text-lg text-indigo-200 mt-2">Biến ý tưởng thành kịch bản hình ảnh cho MV & Live Show.</p>
            </header>

            <main>
              <div className="space-y-2 mb-8">
                <label className="block text-sm font-medium text-indigo-100">Gemini API Key</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={handleApiKeyChange}
                      placeholder="Nhập API key từ Google AI Studio..."
                      className="flex-1 bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(prev => !prev)}
                      className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-indigo-100 hover:bg-white/20 transition"
                    >
                      {showApiKey ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="self-start sm:self-auto px-4 py-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg text-sm transition"
                  >
                    Xoá key
                  </button>
                </div>
                <p className="text-xs text-indigo-200/80">
                  Khóa API chỉ dùng trên trình duyệt của bạn và được lưu trong localStorage để tiện sử dụng cho lần sau.
                  {isUsingFallbackKey && ' (Đang dùng khóa API từ cấu hình mặc định. Bạn có thể thay đổi bằng cách nhập khóa mới.)'}
                </p>
              </div>
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

                {/* Story-driven MV Inputs */}
                <div className={`${videoType === 'story' ? 'block' : 'hidden'} space-y-6`}>
                  <div>
                    <label htmlFor="idea" className="block text-sm font-medium text-indigo-100 mb-2">Lời bài hát / Ý tưởng MV (Chủ đề chính)</label>
                    <textarea id="idea" name="idea" value={formData.idea} onChange={handleInputChange} rows={4} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Dán lời bài hát vào đây, hoặc mô tả ý tưởng chính cho MV của bạn..."></textarea>
                  </div>
                </div>

                {/* Live Performance Video Inputs */}
                <div className={`${videoType === 'live' ? 'block' : 'hidden'} space-y-6`}>
                  <div>
                    <label htmlFor="liveAtmosphere" className="block text-sm font-medium text-indigo-100 mb-2">Mô tả Bối cảnh & Không khí (Cho buổi diễn Acoustic)</label>
                    <textarea id="liveAtmosphere" name="liveAtmosphere" value={formData.liveAtmosphere} onChange={handleInputChange} rows={3} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Một góc phòng thu ấm cúng với vài cây nến..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-100 mb-2">Tải ảnh ca sĩ (Để AI nhận diện chính xác nhất)</label>
                    <div className="flex items-center space-x-4">
                      <label htmlFor="liveArtistImage" className="cursor-pointer inline-block px-6 py-3 bg-white/10 border-2 border-dashed border-white/30 rounded-lg text-center transition hover:bg-white/20 hover:border-white/50">
                        <span>Chọn ảnh...</span>
                      </label>
                      <input type="file" id="liveArtistImage" name="liveArtistImage" onChange={handleImageUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />
                      {formData.liveArtistImage && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-white/30">
                              <img src={`data:${formData.liveArtistImage.mimeType};base64,${formData.liveArtistImage.base64}`} alt="Image Preview" className="w-full h-full object-cover" />
                          </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="liveArtistName" className="block text-sm font-medium text-indigo-100 mb-2">Tên Ca Sĩ (Nếu là người nổi tiếng)</label>
                    <input type="text" id="liveArtistName" name="liveArtistName" value={formData.liveArtistName} onChange={handleInputChange} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Taylor Swift, Sơn Tùng M-TP..." />
                  </div>
                  <div>
                    <label htmlFor="liveArtist" className="block text-sm font-medium text-indigo-100 mb-2">Mô tả Nghệ sĩ & Phong cách trình diễn</label>
                    <textarea id="liveArtist" name="liveArtist" value={formData.liveArtist} onChange={handleInputChange} rows={3} className="w-full bg-white/10 border-2 border-white/20 rounded-lg p-3 text-white placeholder-indigo-300 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition" placeholder="Ví dụ: Nữ ca sĩ với giọng hát trong trẻo, mặc váy trắng, chơi đàn piano..."></textarea>
                  </div>
                </div>

                {/* Common Inputs */}
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
                <button onClick={generatePrompts} disabled={isLoading} className="bg-white text-indigo-700 font-bold py-3 px-8 rounded-full hover:bg-indigo-100 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100">
                  {isLoading ? <LoaderIcon /> : <span>Tạo Kịch Bản Prompt</span>}
                </button>
              </div>
              
              {error && <div className="text-center mt-6 text-red-300 font-medium bg-red-900/50 p-3 rounded-lg">{error}</div>}
              
              {generatedScenes.length > 0 && (
                <div className="text-center mt-8 pt-6 border-t border-white/20">
                    <h3 className="text-xl font-bold mb-4">Hoàn thành! Kịch bản của bạn đã sẵn sàng.</h3>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button
                          onClick={handleStartWorkflow}
                          className="bg-purple-600 text-white font-bold py-3 px-8 rounded-full hover:bg-purple-700 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-purple-300 w-full sm:w-auto"
                        >
                            Bắt đầu Quy trình Xuất Video
                        </button>
                        <button
                          onClick={exportToExcel}
                          className="bg-teal-500 text-white font-bold py-3 px-8 rounded-full hover:bg-teal-600 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-teal-300 w-full sm:w-auto"
                        >
                            Xuất ra File Excel
                        </button>
                        <button
                          onClick={downloadFlowAutomationJson}
                          className="bg-amber-500 text-white font-bold py-3 px-8 rounded-full hover:bg-amber-600 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-300 w-full sm:w-auto"
                        >
                            Tải file JSON cho Google Flow
                        </button>
                    </div>
                    <p className="text-sm text-indigo-200 mt-4">
                        Dùng file JSON với lệnh <code className="bg-black/40 px-2 py-1 rounded">npm run flow:run ./path/to/file.json /thu-muc-tai-video</code> để tự động mở Chrome, dán prompt và tải video từ Google Flow.
                        <br />
                        Hoặc sao chép file <code className="bg-black/40 px-2 py-1 rounded">automation/config.sample.json</code>, điền thông tin dự án rồi chạy <code className="bg-black/40 px-2 py-1 rounded">npm run flow:auto</code> để app tự sinh prompt và xuất video.
                    </p>
                </div>
              )}

              <Results 
                scenes={generatedScenes}
              />

            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
