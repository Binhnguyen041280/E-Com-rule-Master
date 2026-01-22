
import React, { useState, useEffect, useRef } from 'react';
import { generateEComRules, StorageDB, SecurityGuard } from './services/geminiService';
import { EComRule, GroundingSource } from './types';
import RuleCard from './components/RuleCard';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [rules, setRules] = useState<EComRule[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [favorites, setFavorites] = useState<EComRule[]>([]);
  const [view, setView] = useState<'search' | 'favorites'>('search');
  const [error, setError] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState(StorageDB.getStats());
  const [quota, setQuota] = useState(SecurityGuard.checkQuota());
  const [isTurbo, setIsTurbo] = useState(false);
  
  // Flag để tránh ghi đè dữ liệu cũ khi mới mount
  const isInitialLoadDone = useRef(false);

  // 1. Tải dữ liệu lần đầu
  useEffect(() => {
    const saved = localStorage.getItem('ecom_rules_favorites');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch (e) {
        console.error("Lỗi đọc bộ nhớ cá nhân:", e);
      }
    }
    setIsTurbo(!!localStorage.getItem('ecom_context_cache_id_v2'));
    isInitialLoadDone.current = true;
  }, []);

  // 2. Lưu dữ liệu khi có thay đổi
  useEffect(() => {
    if (isInitialLoadDone.current) {
      localStorage.setItem('ecom_rules_favorites', JSON.stringify(favorites));
      setDbStats(StorageDB.getStats());
      setQuota(SecurityGuard.checkQuota());
    }
  }, [favorites]);

  const toggleFavorite = (rule: EComRule) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === rule.id);
      if (exists) return prev.filter(f => f.id !== rule.id);
      return [{ ...rule, savedAt: Date.now(), priority: rule.priority || 'medium' }, ...prev];
    });
  };

  const updateRule = (updatedRule: EComRule) => {
    setFavorites(prev => prev.map(f => f.id === updatedRule.id ? updatedRule : f));
    // Cập nhật cả kết quả tìm kiếm nếu thẻ đó đang hiển thị
    setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
  };

  const handleSearch = async (q: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim() || isLoading) return;

    setQuery(searchQuery);
    setIsLoading(true);
    setView('search');
    setError(null);
    
    const cached = StorageDB.getGlobal(searchQuery);
    setIsFromCache(!!cached);

    try {
      const response = await generateEComRules(searchQuery);
      if (!response.rules || response.rules.length === 0) {
        setError("Không tìm thấy quy định phù hợp. Hãy thử từ khóa khác.");
        setRules([]);
      } else {
        // Đồng bộ kết quả search với dữ liệu đã lưu trong favorites (ghi chú, ghim, v.v)
        const merged = response.rules.map(r => {
          const savedVersion = favorites.find(f => f.id === r.id || (f.title === r.title && f.platform === r.platform));
          return savedVersion ? { ...r, ...savedVersion } : r;
        });
        setRules(merged);
        setSources(response.sources || []);
      }
    } catch (e: any) {
      if (e.message.includes('QUOTA')) setError("Hết định mức hôm nay. Hãy quay lại vào ngày mai!");
      else if (e.message.includes('REJECTED')) setError("Câu hỏi không thuộc lĩnh vực TMĐT.");
      else setError("AI đang bận. Vui lòng thử lại sau vài giây.");
    } finally {
      setIsLoading(false);
      setQuota(SecurityGuard.checkQuota());
    }
  };

  // Sắp xếp favorites: Pinned lên đầu, sau đó đến thời gian lưu
  const sortedFavorites = [...favorites].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.savedAt || 0) - (a.savedAt || 0);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setView('search')}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg text-white group-hover:scale-110 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                E-Com Master
                {isTurbo && <span className="text-[8px] bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full font-black animate-pulse">TURBO</span>}
              </h1>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${quota.remaining > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  QUOTA: {quota.remaining}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">SAVED: {favorites.length}</span>
              </div>
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); handleSearch(query); }} className="flex-1 max-w-xl w-full relative">
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              type="text" 
              placeholder="Tra cứu phí sàn, vi phạm, hoàn hàng..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl text-slate-800 transition-all font-semibold" 
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </form>

          <button 
            onClick={() => setView('favorites')} 
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'favorites' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={view === 'favorites' ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            Bộ nhớ cá nhân
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {view === 'favorites' ? '📌 Bộ nhớ cá nhân' : '🔍 Kết quả phân tích'}
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {view === 'favorites' 
                ? `Bạn đang lưu trữ ${favorites.length} quy định quan trọng.` 
                : 'Dữ liệu được trích xuất từ các sàn TMĐT và văn bản pháp luật mới nhất.'}
            </p>
        </div>

        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-black mb-2">Đang truy xuất tri thức...</h3>
            <p className="text-slate-500 font-medium">{isFromCache ? '⚡ Đang tải từ cache nội bộ' : '🌐 Đang kết nối Google Search'}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {view === 'favorites' && favorites.length === 0 ? (
              <div className="py-20 flex flex-col items-center text-center px-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800">Bộ nhớ đang trống</h3>
                <p className="text-slate-500 mt-2 max-w-sm">Hãy tìm kiếm quy định và nhấn biểu tượng ❤️ để lưu lại những thông tin quan trọng nhất với shop của bạn.</p>
                <button onClick={() => setView('search')} className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-colors">Bắt đầu tìm kiếm ngay</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {(view === 'search' ? rules : sortedFavorites).map(rule => (
                  <RuleCard 
                    key={rule.id} 
                    rule={rule} 
                    isFavorite={favorites.some(f => f.id === rule.id)} 
                    onToggleFavorite={toggleFavorite}
                    onUpdateRule={updateRule}
                  />
                ))}
              </div>
            )}
            
            {view === 'search' && sources.length > 0 && (
              <div className="p-6 bg-white rounded-[32px] border border-slate-200 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nguồn dữ liệu tham chiếu</h4>
                <div className="flex flex-wrap gap-3">
                  {sources.map((source, i) => (
                    <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all border border-slate-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {source.title.length > 40 ? source.title.substring(0, 40) + '...' : source.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-8 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-center gap-4">
          <span>Engine v2.0</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span>{dbStats.count} cached entries</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span className={isTurbo ? "text-amber-500" : ""}>Turbo Mode: {isTurbo ? "ON" : "OFF"}</span>
        </div>
        <p className="opacity-50 tracking-[0.2em]">Cố vấn TMĐT cá nhân của bạn</p>
      </footer>

      {error && (
        <div className="fixed bottom-8 right-8 z-50 bg-slate-900 text-white p-5 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 max-w-sm border border-white/10">
           <div className="p-3 bg-red-500 rounded-2xl shadow-lg">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div className="flex-1">
             <p className="text-[10px] font-black uppercase text-red-400 mb-0.5 tracking-widest">Hệ thống thông báo</p>
             <p className="text-xs font-bold">{error}</p>
           </div>
           <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
