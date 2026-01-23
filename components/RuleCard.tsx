
import React, { useState, useRef } from 'react';
import { EComRule, GlobalSettings } from '../types';

interface RuleCardProps {
  rule: EComRule;
  isFavorite: boolean;
  onToggleFavorite: (rule: EComRule) => void;
  onUpdateRule?: (rule: EComRule, applyToAll?: boolean) => void;
  globalSettings?: GlobalSettings;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, isFavorite, onToggleFavorite, onUpdateRule, globalSettings }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getStyle = () => {
    const bg = rule.backgroundImage || (globalSettings?.useGlobalBackground ? globalSettings.globalBackgroundImage : null);
    if (bg) {
      return { 
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        className: 'bg-slate-900' 
      };
    }

    const platformColors: Record<string, string> = {
      'Shopee': 'bg-gradient-to-br from-orange-500 to-red-600',
      'TikTok Shop': 'bg-gradient-to-br from-slate-800 to-black',
      'Thuế & Pháp lý': 'bg-gradient-to-br from-emerald-600 to-teal-800'
    };
    return { className: platformColors[rule.platform] || 'bg-indigo-600' };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 1024 * 1024) {
      alert("Chọn ảnh < 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpdateRule?.({ ...rule, backgroundImage: reader.result as string });
    reader.readAsDataURL(file);
  };

  const style = getStyle();
  const formatTimeShort = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card-perspective h-[520px] w-full cursor-pointer group" onClick={() => !isEditing && setIsFlipped(!isFlipped)}>
      <div className={`card-inner manual-flip transform-gpu h-full duration-700 ${isFlipped ? 'is-flipped' : ''}`}>
        
        {/* MẶT TRƯỚC */}
        <div 
          style={style.backgroundImage ? { backgroundImage: style.backgroundImage, backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition } : {}}
          className={`card-front absolute inset-0 rounded-[40px] p-10 flex flex-col justify-between text-white shadow-2xl transition-all ${style.className} overflow-hidden`}
        >
          <div className="flex justify-between items-start z-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10">
                  {rule.platform}
                </span>
                <div className="flex items-center gap-1 bg-green-500/80 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter backdrop-blur-sm">
                   <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                   Verified
                </div>
              </div>
              {rule.fetchedAt && (
                <span className="text-[8px] font-bold opacity-70 ml-1 uppercase tracking-tighter italic">Dữ liệu Global: {formatTimeShort(rule.fetchedAt)}</span>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(rule); }} 
              className={`p-3 rounded-[18px] transition-all ${isFavorite ? 'bg-white text-red-500 shadow-xl' : 'bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/10'}`}
            >
              <svg className="h-5 w-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center text-center z-10">
            <h3 className="text-2xl font-black mb-6 leading-tight drop-shadow-2xl uppercase tracking-tighter italic">{rule.title}</h3>
            <p className="text-sm font-bold opacity-90 leading-relaxed drop-shadow-lg px-4 italic">"{rule.summary}"</p>
          </div>

          <div className="w-full pt-8 border-t border-white/20 flex justify-between items-center z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{rule.category}</span>
            <div className="flex gap-2">
               <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 group-hover:bg-white/30 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
            </div>
          </div>
        </div>

        {/* MẶT SAU */}
        <div className="card-back absolute inset-0 rounded-[40px] bg-white p-10 flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{isEditing ? 'Tùy chỉnh cá nhân' : 'Phân tích thực thi 2026'}</h4>
              <span className="text-[8px] font-bold text-slate-300 uppercase">Master Data Sync: {formatTimeShort(rule.fetchedAt)}</span>
            </div>
            <div className="flex gap-2">
              {!isEditing && rule.sources && rule.sources.length > 0 && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); setShowSources(!showSources); }} 
                  className={`text-[9px] font-black px-4 py-2 rounded-2xl transition-all ${showSources ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                >
                  {showSources ? 'ĐÓNG NGUỒN' : 'XEM NGUỒN'}
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); setShowSources(false); }} 
                className={`text-[9px] font-black px-4 py-2 rounded-2xl transition-all ${isEditing ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {isEditing ? 'LƯU LẠI' : 'SỬA THẺ'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            {showSources ? (
              <div className="animate-in fade-in zoom-in-95 duration-300 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Các nguồn tin cậy đã đối soát:</p>
                <div className="space-y-3">
                  {rule.sources?.map((s, idx) => (
                    <a 
                      key={idx} 
                      href={s.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="block p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-amber-400 hover:bg-white transition-all group"
                    >
                      <div className="flex justify-between items-start gap-4">
                         <span className="text-[11px] font-bold text-slate-700 leading-tight group-hover:text-amber-600">{s.title}</span>
                         <svg className="w-3 h-3 text-slate-300 shrink-0 group-hover:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </div>
                      <span className="text-[9px] font-medium text-slate-400 mt-2 block truncate">{s.uri}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : isEditing ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                   <p className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Giao diện Shop của bạn</p>
                   <div className="grid grid-cols-2 gap-4">
                      <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="h-32 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50 transition-all group relative overflow-hidden">
                         {rule.backgroundImage ? (
                           <>
                             <img src={rule.backgroundImage} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                             <span className="text-[10px] font-black text-indigo-600 relative z-10">THAY ĐỔI ẢNH</span>
                           </>
                         ) : (
                           <>
                             <svg className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             <span className="text-[10px] font-black text-slate-400">TẢI ẢNH NỀN</span>
                           </>
                         )}
                         <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      </button>
                      <button 
                        disabled={!rule.backgroundImage}
                        onClick={(e) => { e.stopPropagation(); if (rule.backgroundImage && onUpdateRule) onUpdateRule(rule, true); }}
                        className={`h-32 border-2 rounded-[24px] flex flex-col items-center justify-center p-5 text-center transition-all ${rule.backgroundImage ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-md scale-100 hover:scale-[1.02]' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                      >
                        <svg className="w-6 h-6 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        <span className="text-[10px] font-black uppercase tracking-tight leading-tight">Đồng bộ toàn bộ Shop</span>
                      </button>
                   </div>
                </div>
                <div>
                   <p className="text-[11px] font-black text-slate-400 mb-4 uppercase tracking-widest">Ghi chú riêng (Lưu bí kíp)</p>
                   <textarea 
                     onClick={e => e.stopPropagation()}
                     value={rule.userNotes || ''}
                     onChange={e => onUpdateRule?.({ ...rule, userNotes: e.target.value })}
                     className="w-full h-36 p-6 bg-slate-50 rounded-[32px] text-xs font-bold border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all outline-none resize-none shadow-inner"
                     placeholder="Ví dụ: 'Phí Shopee 2026 tăng lên x%, cần cộng thêm vào giá bán...' "
                   />
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-4 px-2">
                  {rule.details.map((d, i) => (
                    <div key={i} className="flex gap-5 items-start group">
                      <div className="mt-2 w-2 h-2 rounded-full bg-indigo-600 group-hover:scale-150 transition-all shadow-md shadow-indigo-200"></div>
                      <p className="text-sm font-black text-slate-700 leading-relaxed tracking-tight">{d}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45l8.15 14.1H3.85L12 5.45z"/></svg>
                  </div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-3 tracking-widest">Lời khuyên cố vấn 2026</p>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{rule.tips}"</p>
                </div>
                {rule.userNotes && (
                   <div className="p-6 bg-indigo-600 text-white rounded-[32px] shadow-xl relative overflow-hidden group">
                    <p className="text-[10px] font-black uppercase mb-3 tracking-widest opacity-70">Sổ tay cá nhân</p>
                    <p className="text-sm font-bold leading-relaxed">{rule.userNotes}</p>
                    <div className="absolute -right-4 -bottom-4 text-white opacity-10 transform rotate-12 group-hover:rotate-0 transition-transform duration-700">
                       <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M11 5h2v14h-2zM4 11h16v2H4z" /></svg>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); setIsFlipped(false); setIsEditing(false); setShowSources(false); }}
            className="mt-6 pt-4 border-t border-slate-100 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all text-center block w-full"
          >
            Lật lại mặt trước
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleCard;
