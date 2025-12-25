
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

  // Improved formatting with high contrast labels
  const formattedText = scene.prompt_text
    .replace(/(\[SCENE_START\])/g, '<span class="text-tet-red font-black">$1</span>')
    .replace(/(SCENE_HEADING:|CHARACTER:|CINEMATOGRAPHY:|LIGHTING:|ENVIRONMENT:|ACTION_EMOTION:|STYLE:)/g, '\n<strong class="text-tet-red-dark border-b border-tet-gold/30">$&</strong>');

  return (
    <div className="scene-card bg-white rounded-3xl p-6 border-2 border-tet-gold/30 transition-all transform hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
      {/* Decorative Corner */}
      <div className="absolute top-0 left-0 w-12 h-12 bg-tet-gold/5 -translate-x-6 -translate-y-6 rotate-45 pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-black text-lg text-tet-brown flex items-center gap-2">
            <span className="bg-tet-red text-white w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0">{scene.scene_number}</span>
            <span className="truncate">{scene.scene_title}</span>
          </h3>
          <button 
            onClick={handleCopy}
            className={`p-2 rounded-xl transition-all border-2 ${copied ? 'bg-tet-green text-white border-white' : 'bg-tet-cream text-tet-brown border-tet-gold/20 hover:border-tet-red'}`}
            title="Copy Prompt"
          >
            {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="relative">
            <pre 
              className="text-tet-brown mt-2 text-sm bg-tet-cream/50 p-4 rounded-2xl font-mono break-words whitespace-pre-wrap border-2 border-stone-100 leading-relaxed shadow-inner max-h-96 overflow-y-auto custom-scrollbar"
              dangerouslySetInnerHTML={{ __html: formattedText }}
            />
            {copied && (
                <div className="absolute top-2 right-2 px-3 py-1 bg-tet-green text-white text-[10px] font-bold rounded-full animate-fade-in shadow-sm">
                    Đã copy!
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

interface ResultsProps {
  scenes: Scene[];
}

const Results: React.FC<ResultsProps> = ({ scenes }) => {
  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
          <div className="h-px bg-tet-gold flex-1"></div>
          <h2 className="text-2xl font-black text-center text-tet-red-dark uppercase tracking-widest px-4">Kịch Bản Prompt</h2>
          <div className="h-px bg-tet-gold flex-1"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
