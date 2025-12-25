
import React, { useState } from 'react';
import { Scene } from '../types';
import { CopyIcon, CheckIcon } from './Icons';

interface SceneCardProps {
  scene: Scene;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(scene.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedText = scene.prompt_text
    .replace(/(\[SCENE_START\])/g, '<span class="text-tet-red font-black text-base">$1</span>')
    .replace(/(SCENE_HEADING:|CHARACTER:|CINEMATOGRAPHY:|LIGHTING:|ENVIRONMENT:|ACTION_EMOTION:|STYLE:)/g, 
      '\n<strong class="text-tet-red-dark bg-tet-gold/10 px-1 border-b-2 border-tet-gold/40">$&</strong>');

  return (
    <div className="scene-card bg-white rounded-3xl p-6 border-2 border-tet-gold/30 transition-all transform hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between shadow-md relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-tet-red/5 -translate-y-12 translate-x-12 rounded-full pointer-events-none group-hover:bg-tet-red/10 transition-colors"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-5 border-b-2 border-stone-50 pb-3">
          <h3 className="font-black text-lg text-tet-brown flex items-center gap-3">
            <span className="bg-tet-red text-white w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 shadow-sm border-2 border-white">{scene.scene_number}</span>
            <span className="truncate max-w-[200px] xl:max-w-none">{scene.scene_title}</span>
          </h3>
          <button 
            onClick={handleCopy}
            className={`p-2.5 rounded-2xl transition-all border-2 shadow-sm ${copied ? 'bg-tet-green text-white border-white scale-110' : 'bg-tet-cream text-tet-brown border-tet-gold/20 hover:border-tet-red hover:bg-white hover:text-tet-red'}`}
            title="Copy Prompt"
          >
            {copied ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="relative">
            <pre 
              className="text-tet-brown mt-2 text-xs md:text-sm bg-stone-50 p-5 rounded-2xl font-mono break-words whitespace-pre-wrap border-2 border-stone-100 leading-relaxed shadow-inner max-h-[500px] overflow-y-auto custom-scrollbar"
              dangerouslySetInnerHTML={{ __html: formattedText }}
            />
            {copied && (
                <div className="absolute top-3 right-3 px-4 py-1.5 bg-tet-green text-white text-[10px] font-extrabold rounded-full animate-fade-in shadow-lg border-2 border-white z-20">
                    ĐÃ SAO CHÉP
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

interface ResultsProps {
  scenes: Scene[];
  onSaveExcel?: () => void;
}

const Results: React.FC<ResultsProps> = ({ scenes }) => {
  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 animate-fade-in pb-10">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 md:p-6 rounded-[40px] border-2 border-tet-gold/40 shadow-lg">
          <div className="flex items-center gap-4 flex-1">
             <div className="h-0.5 bg-gradient-to-r from-transparent to-tet-gold flex-1 rounded-full hidden lg:block"></div>
             <div className="flex items-center gap-3 px-2">
                <span className="text-3xl">🏮</span>
                <h2 className="text-xl md:text-2xl font-black text-tet-red-dark uppercase tracking-widest whitespace-nowrap text-center w-full lg:w-auto">Kịch Bản Prompt Chi Tiết</h2>
             </div>
             <div className="h-0.5 bg-gradient-to-l from-transparent to-tet-gold flex-1 rounded-full hidden lg:block"></div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {scenes.map(s => (
          <SceneCard 
            key={s.scene_number} 
            scene={s}
          />
        ))}
      </div>
    </div>
  );
};

export default Results;
