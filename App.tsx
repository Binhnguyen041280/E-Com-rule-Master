
import React, { useState, useEffect, useMemo } from 'react';
import { generateEComRules, StorageDB, EComAgent } from './services/geminiService';
import { EComRule, GroundingSource, GlobalSettings, AgentLog, DynamicCollections } from './types';
import RuleCard from './components/RuleCard';

const INITIAL_COLLECTIONS: DynamicCollections = {
  'Shopee': {
    'Biểu phí 2026': ['Phí thanh toán', 'Phí cố định', 'Phí Freeship Xtra'],
    'Vận hành': ['Điểm phạt Sao quả tạ', 'Chuẩn đóng gói'],
    'Marketing': ['Shopee Video 2026', 'Quản lý Live AI']
  },
  'TikTok Shop': {
    'Livestream': ['Chính sách Livestream 2026', 'Luật nội dung AI'],
    'Phí & Thuế': ['Phí dịch vụ 2026', 'Đối soát dòng tiền'],
    'Affiliate': ['Kế hoạch KOC 2026', 'Hoa hồng Affiliate']
  },
  'Thuế & Pháp lý': {
    'Luật thuế': ['Thuế TMĐT cá nhân 2026', 'Quyết toán thuế'],
    'Văn bản': ['Nghị định 2026', 'Bảo mật dữ liệu']
  }
};

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentScanning, setIsAgentScanning] = useState(false);
  const [rules, setRules] = useState<EComRule[]>([]);
  const [favorites, setFavorites] = useState<EComRule[]>([]);
  const [view, setView] = useState<'discovery' | 'personal' | 'agent'>('discovery');
  const [activeTab, setActiveTab] = useState<string>('Shopee');
  const [collections, setCollections] = useState<DynamicCollections>(INITIAL_COLLECTIONS);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({ 
    useGlobalBackground: false, 
    themeColor: '#4f46e5',
    lastAgentScan: 0 
  });

  // Filter & Sort state
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority'>('newest');

  useEffect(() => {
    const db = StorageDB.getData();
    if (db.favorites) setFavorites(db.favorites);
    if (db.settings) setSettings(db.settings);
    if (db.collections) setCollections(db.collections);
    setLogs(StorageDB.getLogs());

    // Agent Proactive Trigger
    const checkAgent = async () => {
      const now = Date.now();
      const lastScan = db.settings?.lastAgentScan || 0;
      if (now - lastScan > 24 * 60 * 60 * 1000) {
        runAgentScan();
      }
    };
    checkAgent();
  }, []);

  const runAgentScan = async () => {
    if (isAgentScanning) return;
    setIsAgentScanning(true);
    try {
      const res = await EComAgent.runDeepScan(activeTab);
      
      // Update collections if suggested
      if (res.suggestedCategories && res.suggestedCategories.length > 0) {
        setCollections(prev => {
          const updated = { ...prev };
          res.suggestedCategories?.forEach(cat => {
            if (!updated[activeTab][cat]) updated[activeTab][cat] = [];
          });
          return updated;
        });
      }

      setRules(prev => [...res.rules, ...prev.filter(p => !res.rules.find(r => r.id === p.id))]);
      const newSettings = { ...settings, lastAgentScan: Date.now() };
      setSettings(newSettings);
      
      const db = StorageDB.getData();
      StorageDB.saveData({ ...db, settings: newSettings, collections: collections });
      setLogs(StorageDB.getLogs());
    } catch (e) {
      console.error(e);
    } finally {
      setIsAgentScanning(false);
    }
  };

  const toggleFavorite = (rule: EComRule) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === rule.id);
      const updated = exists ? prev.filter(f => f.id !== rule.id) : [{ ...rule, savedAt: Date.now() }, ...prev];
      const db = StorageDB.getData();
      StorageDB.saveData({ ...db, favorites: updated });
      return updated;
    });
  };

  const handleSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setIsLoading(true);
    setView('discovery');
    try {
      const res = await generateEComRules(q, activeTab);
      setRules(res.rules);
    } catch (e) {
      alert("Lỗi tìm kiếm. Hãy thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const processedRules = useMemo(() => {
    const target = view === 'discovery' ? rules : favorites;
    let result = [...target].filter(r => r.platform === activeTab || view === 'personal');

    if (filterCategory !== 'All') result = result.filter(r => r.category === filterCategory);
    if (filterPriority !== 'All') result = result.filter(r => r.priority === filterPriority.toLowerCase());

    const weight = { 'high': 3, 'medium': 2, 'low': 1 };
    result.sort((a, b) => {
      if (sortOrder === 'newest') return (b.fetchedAt || 0) - (a.fetchedAt || 0);
      if (sortOrder === 'priority') return (weight[b.priority] || 0) - (weight[a.priority] || 0);
      return 0;
    });
    return result;
  }, [rules, favorites, view, filterCategory, filterPriority, sortOrder, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 overflow-x-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('discovery')}>
            <div className={`p-2.5 rounded-2xl shadow-lg text-white transition-all ${isAgentScanning ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600'}`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic">Sentinel 2026</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 ${isAgentScanning ? 'bg-amber-500' : 'bg-green-500'} rounded-full`}></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {isAgentScanning ? 'Agent: Deep Scanning...' : 'Agent: Monitoring'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl w-full relative">
            <input 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              placeholder={`Hỏi Agent về ${activeTab}...`} 
              className="w-full pl-12 pr-4 py-3 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-600 rounded-[20px] text-sm font-bold transition-all" 
            />
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto">
            <button onClick={() => setView('discovery')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${view === 'discovery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Thư viện</button>
            <button onClick={() => setView('personal')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${view === 'personal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Sổ tay</button>
            <button onClick={() => setView('agent')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap ${view === 'agent' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>Agent Logs</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {view === 'agent' ? (
          <section className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-3xl font-black uppercase italic tracking-tighter">Nhật ký Agent</h2>
               <button onClick={runAgentScan} disabled={isAgentScanning} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  Kích hoạt Quét cưỡng bức
               </button>
            </div>
            {logs.map(log => (
              <div key={log.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex gap-6 items-start">
                <div className={`mt-1 p-2 rounded-xl ${log.type === 'update' ? 'bg-green-100 text-green-600' : log.type === 'warning' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                   {log.type === 'update' ? '✓' : log.type === 'warning' ? '!' : 'i'}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{log.platform}</span>
                    <span className="text-[9px] font-bold text-slate-300">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">{log.action}</p>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <>
            <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
              {Object.keys(collections).map(plat => (
                <button 
                  key={plat} 
                  onClick={() => setActiveTab(plat)}
                  className={`px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === plat ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                >
                  {plat}
                </button>
              ))}
            </div>

            <div className="mb-8 flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-slate-50 border-none text-[11px] font-bold rounded-xl px-4 py-2"
                >
                  <option value="All">Tất cả danh mục</option>
                  {Object.keys(collections[activeTab] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={filterPriority} 
                  onChange={e => setFilterPriority(e.target.value)}
                  className="bg-slate-50 border-none text-[11px] font-bold rounded-xl px-4 py-2"
                >
                  <option value="All">Tất cả ưu tiên</option>
                  <option value="High">Cao</option>
                  <option value="Medium">Trung bình</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {processedRules.map(rule => (
                <RuleCard 
                  key={rule.id} 
                  rule={rule} 
                  isFavorite={!!favorites.find(f => f.id === rule.id)} 
                  onToggleFavorite={toggleFavorite} 
                />
              ))}
            </div>
            
            {processedRules.length === 0 && (
              <div className="text-center py-32 opacity-30 italic font-black text-slate-400">
                 KHÔNG CÓ DỮ LIỆU. HÃY THỬ QUÉT HOẶC TÌM KIẾM MỚI.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
