
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

  // Modern syntax highlighting for prompts
  const formattedText = scene.prompt_text
    .replace(/(\[SCENE_START\])/g, '<span class="text-indigo-600 font-bold text-xs opacity-50 block mb-2 select-none">$1</span>')
    .replace(/(SCENE_HEADING:|CHARACTER:|CINEMATOGRAPHY:|LIGHTING:|ENVIRONMENT:|ACTION_EMOTION:|STYLE:)/g, 
      '\n<span class="text-mac-accent font-semibold text-xs tracking-wide uppercase mt-3 block select-none">$&</span>');

  return (
    <div className="bg-mac-surface rounded-mac-lg p-5 shadow-mac-card border border-mac-border/20 flex flex-col group relative hover:shadow-lg transition-all duration-300">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-mac-surface-sec border border-white text-mac-text-sec font-bold text-xs flex items-center justify-center shadow-sm">
                {scene.scene_number}
            </div>
            <h3 className="font-bold text-sm text-mac-text">{scene.scene_title}</h3>
        </div>
        <button 
          onClick={handleCopy}
          className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
          title="Sao chép"
        >
          {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="relative flex-1">
          <pre 
            className="text-mac-text-sec text-xs bg-mac-surface-sec/50 p-4 rounded-mac font-mono break-words whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar border border-transparent group-hover:border-mac-border/20 transition-colors"
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
      </div>
    </div>
  );
};

interface ResultsProps {
  scenes: Scene[];
}

const Results: React.FC<ResultsProps> = ({ scenes }) => {
  if (!scenes || scenes.length === 0) return null;

  return (
    <div className="mt-8 animate-fade-in pb-10 border-t border-mac-border/30 pt-8">
      <div className="flex items-center justify-between mb-6 px-2">
         <h2 className="text-lg font-bold text-mac-text">Kết Quả <span className="text-gray-400 font-normal text-sm ml-2">{scenes.length} cảnh</span></h2>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {scenes.map(s => (
          <SceneCard key={s.scene_number} scene={s} />
        ))}
      </div>
    </div>
  );
};

export default Results;
