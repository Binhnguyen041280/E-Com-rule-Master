
import React, { useState } from 'react';
import { EComRule } from '../types';

interface RuleCardProps {
  rule: EComRule;
  isFavorite: boolean;
  onToggleFavorite: (rule: EComRule) => void;
  onUpdateRule?: (rule: EComRule) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, isFavorite, onToggleFavorite, onUpdateRule }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const colors = [
    { name: 'Shopee', class: 'from-orange-500 to-red-600' },
    { name: 'Lazada', class: 'from-blue-600 to-purple-600' },
    { name: 'TikTok', class: 'from-black to-gray-800' },
    { name: 'Tiki', class: 'from-sky-400 to-blue-500' },
    { name: 'Emerald', class: 'from-emerald-500 to-teal-700' },
    { name: 'Rose', class: 'from-rose-500 to-pink-600' },
    { name: 'Indigo', class: 'from-indigo-600 to-blue-700' },
  ];

  const getPlatformColor = (platform: string) => {
    if (rule.customColor) return rule.customColor;
    const p = platform.toLowerCase();
    if (p.includes('shopee')) return colors[0].class;
    if (p.includes('lazada')) return colors[1].class;
    if (p.includes('tiktok')) return colors[2].class;
    if (p.includes('tiki')) return colors[3].class;
    return 'from-slate-700 to-slate-900';
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateRule) {
      onUpdateRule({ ...rule, isPinned: !rule.isPinned });
    }
  };

  const handleUpdatePriority = (priority: 'high' | 'medium' | 'low') => {
    if (onUpdateRule) {
      onUpdateRule({ ...rule, priority });
    }
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: `${rule.platform}: ${rule.title}`,
      text: `Quy định TMĐT: ${rule.title}\n\nMẹo: ${rule.tips}`,
      url: rule.sourceUrl || window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
        setShowCopyFeedback(true);
        setTimeout(() => setShowCopyFeedback(false), 2000);
      } catch (err) {}
    }
  };

  return (
    <div 
      className="card-perspective h-[450px] md:h-[430px] w-full group cursor-pointer"
      onClick={() => !isEditing && setIsFlipped(!isFlipped)}
    >
      <div className={`card-inner manual-flip transform-gpu ${isFlipped ? 'is-flipped' : ''}`}>
        {/* Front Side */}
        <div className={`card-front absolute w-full h-full rounded-3xl p-6 md:p-8 flex flex-col justify-between text-white shadow-xl bg-gradient-to-br ${getPlatformColor(rule.platform)}`}>
          <div className="w-full flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                {rule.platform}
              </span>
              {rule.priority === 'high' && (
                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 w-fit shadow-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> KHẨN CẤP
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {isFavorite && (
                <button 
                  onClick={handleTogglePin}
                  className={`p-2.5 rounded-full transition-all backdrop-blur-md ${rule.isPinned ? 'bg-yellow-400 text-slate-900 scale-110' : 'bg-white/10 text-white hover:bg-white/30'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={rule.isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(rule); }} className={`p-2.5 rounded-full backdrop-blur-md transition-all ${isFavorite ? 'bg-white text-red-500' : 'bg-white/10'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center text-center">
            <h3 className="text-xl font-black mb-3 leading-tight">{rule.title}</h3>
            <p className="text-sm opacity-90 italic">"{rule.summary}"</p>
          </div>

          <div className="w-full flex justify-between items-center pt-4 border-t border-white/10">
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setIsFlipped(true); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <div className="flex gap-2">
              <button onClick={handleShareClick} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                {showCopyFeedback && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-[9px] px-2 py-1 rounded">Copied!</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div className="card-back absolute w-full h-full rounded-3xl bg-white p-6 md:p-8 flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-slate-800">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h4 className="font-black text-xs uppercase tracking-widest">{isEditing ? 'TÙY CHỈNH THẺ' : 'CHI TIẾT QUY ĐỊNH'}</h4>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }} className="text-indigo-600 font-bold text-[10px] hover:underline">
              {isEditing ? 'XONG' : 'SỬA'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 mb-2">ƯU TIÊN</p>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high'].map(p => (
                      <button key={p} onClick={(e) => { e.stopPropagation(); handleUpdatePriority(p as any); }} className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${rule.priority === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}>
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 mb-2">MÀU SẮC</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c, i) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); onUpdateRule?.({ ...rule, customColor: c.class }); }} className={`w-6 h-6 rounded-full bg-gradient-to-br ${c.class} ${rule.customColor === c.class ? 'ring-2 ring-indigo-600' : ''}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 mb-2">GHI CHÚ</p>
                  <textarea onClick={e => e.stopPropagation()} value={rule.userNotes || ''} onChange={e => onUpdateRule?.({ ...rule, userNotes: e.target.value })} className="w-full h-20 p-3 bg-slate-50 rounded-xl text-xs border border-slate-200 outline-none focus:border-indigo-600 resize-none" placeholder="Lưu ý riêng của bạn..." />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="space-y-3">
                  {rule.details.map((d, i) => (
                    <li key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                      <span className="text-indigo-500 font-bold">•</span> {d}
                    </li>
                  ))}
                </ul>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">MẸO CHUYÊN GIA</p>
                  <p className="text-xs font-semibold text-slate-700">{rule.tips}</p>
                </div>
                {rule.userNotes && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[9px] font-black text-amber-600 uppercase mb-1">GHI CHÚ CỦA TÔI</p>
                    <p className="text-xs font-medium italic text-amber-900">{rule.userNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleCard;
