
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
  
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ecom_rules_favorites');
    if (saved) {
      try { setFavorites(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ecom_rules_favorites', JSON.stringify(favorites));
    setDbStats(StorageDB.getStats());
    setQuota(SecurityGuard.checkQuota());
  }, [favorites, rules]);

  const toggleFavorite = (rule: EComRule) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === rule.id);
      if (exists) return prev.filter(f => f.id !== rule.id);
      return [{ ...rule, savedAt: Date.now(), priority: 'medium' }, ...prev];
    });
  };

  const updateRule = (updatedRule: EComRule) => {
    setFavorites(prev => prev.map(f => f.id === updatedRule.id ? updatedRule : f));
    setRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
  };

  const sortRules = (items: EComRule[]) => {
    return [...items].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aP = a.priority || 'medium';
      const bP = b.priority || 'medium';
      if (priorityOrder[aP] !== priorityOrder[bP]) return priorityOrder[aP] - priorityOrder[bP];
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
  };

  const handleSearch = async (q: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;

    // Chống spam: Giới hạn 5 giây/lượt
    if (isLoading) return;

    setQuery(searchQuery);
    setIsLoading(true);
    setView('search');
    setError(null);
    
    // Check cache local trước (không tốn quota)
    const cached = StorageDB.getGlobal(searchQuery);
    setIsFromCache(!!cached);

    try {
      const response = await generateEComRules(searchQuery);
      if (response.rules.length === 0) {
        setError("Không tìm thấy quy định TMĐT phù hợp. Hãy thử từ khóa liên quan sàn TMĐT.");
        setRules([]);
      } else {
        const merged = response.rules.map(r => {
          const personal = favorites.find(f => f.id === r.id);
          return personal ? personal : r;
        });
        setRules(merged);
        setSources(response.sources);
      }
    } catch (e: any) {
      if (e.message.includes('QUOTA')) {
        setError("Định mức hôm nay đã hết (20/20). Hãy quay lại vào ngày mai!");
      } else if (e.message.includes('REJECTED')) {
        setError("Nội dung tra cứu không thuộc phạm vi Thương mại điện tử.");
      } else {
        setError("Hệ thống AI đang bận. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
      setQuota(SecurityGuard.checkQuota());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm p-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('search')}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg text-white">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">E-Com Master</h1>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${quota.remaining > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  QUOTA: {quota.remaining} LƯỢT
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">MEMORIES: {favorites.length}</span>
              </div>
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); handleSearch(query); }} className="flex-1 max-w-xl w-full relative">
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              type="text" 
              placeholder="Nhập link hoặc câu hỏi (Ví dụ: Shopee phí sàn...)" 
              className="w-full pl-12 pr-4 py-3 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl text-slate-800 transition-all font-semibold" 
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </form>

          <div className="flex gap-2">
            <button onClick={() => setView('favorites')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${view === 'favorites' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              Ghi nhớ ({favorites.length})
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {view === 'favorites' ? '📌 Kho quy định ưu tiên' : '🔍 Kết quả phân tích'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">Bảo vệ bởi hệ thống Gatekeeper thông minh.</p>
           </div>
           {quota.remaining === 0 && (
             <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3">
               <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-lg shadow-sm">!</div>
               <div>
                 <p className="uppercase">Cảnh báo định mức</p>
                 <p className="font-medium opacity-80">Bạn đã sử dụng hết lượt tra cứu AI trong hôm nay.</p>
               </div>
             </div>
           )}
        </div>

        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-bold text-slate-900">
              {isFromCache ? '⚡ Đang lấy từ Cache...' : '🛡️ Đang kiểm tra an ninh & Phân tích...'}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortRules(view === 'search' ? rules : favorites).map(rule => (
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

        {view === 'search' && !isLoading && rules.length === 0 && !error && (
           <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
             <div className="text-4xl mb-4">🛡️</div>
             <p className="text-slate-500 font-bold">Hệ thống Gatekeeper đang hoạt động.</p>
             <p className="text-slate-400 text-xs mt-2">Vui lòng nhập câu hỏi liên quan đến Thương mại điện tử.</p>
           </div>
        )}
      </main>

      <footer className="p-8 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-100 bg-white">
        Phụ tá TMĐT chuyên nghiệp • {dbStats.sizeKb}KB used • Security Guard Active
      </footer>

      {error && (
        <div className="fixed bottom-8 right-8 z-50 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right-4 max-w-sm">
           <div className="p-2.5 bg-red-500 rounded-xl">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div>
             <p className="text-[10px] font-black uppercase text-red-400 mb-0.5">Thông báo hệ thống</p>
             <p className="text-xs font-bold leading-snug">{error}</p>
           </div>
           <button onClick={() => setError(null)} className="ml-auto text-slate-500 hover:text-white font-black text-xl">×</button>
        </div>
      )}
    </div>
  );
};

export default App;
