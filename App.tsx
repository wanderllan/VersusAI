
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, LoadingState, SavedComparison, HistoryItem } from './types';
import { compareProducts } from './services/gemini';
import ComparisonResults from './components/ComparisonResults';
import Leaderboard from './components/Leaderboard';
import { SearchIcon, ArrowRightIcon, MoonIcon, SunIcon, HistoryIcon, BookmarkIcon, TrashIcon, TrendingUpIcon, BarChartIcon, PlusIcon } from './components/Icons';

// Helper for safe localStorage access
const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`Error accessing localStorage for key ${key}:`, e);
    return null;
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Error setting localStorage for key ${key}:`, e);
  }
};

const safeJSONParse = (value: string | null, fallback: any) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
};

function App() {
  // --- State ---
  const [query, setQuery] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Persistence State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = safeGetItem('theme');
      if (saved === 'dark') return true;
      if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    } catch (e) {
      // Ignore errors
    }
    return false;
  });
  
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const raw = safeJSONParse(safeGetItem('searchHistory'), []);
    // Migration logic: convert simple strings to objects
    if (raw.length > 0 && typeof raw[0] === 'string') {
        return raw.map((q: string) => ({ query: q, timestamp: Date.now() }));
    }
    return raw;
  });

  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>(() => {
    return safeJSONParse(safeGetItem('savedComparisons'), []);
  });

  const [view, setView] = useState<'home' | 'saved'>('home');
  const [statsPeriod, setStatsPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [realStats, setRealStats] = useState<{ searches: number, savedCount: number, trend: string }>({ searches: 0, savedCount: 0, trend: '0%' });

  // --- Effects ---
  
  // Deep Linking: Check URL params on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) {
        setQuery(q);
        // Automatically trigger search if query is present
        handleSearch(undefined, q);
      }
    } catch (e) {
      console.warn("Error parsing URL params:", e);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      safeSetItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeSetItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    safeSetItem('searchHistory', JSON.stringify(history));
    calculateRealStats();
  }, [history, statsPeriod, savedComparisons]);

  useEffect(() => {
    safeSetItem('savedComparisons', JSON.stringify(savedComparisons));
  }, [savedComparisons]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Suggestion Logic ---
  const presetSuggestions = [
    "iPhone 15 vs Galaxy S24",
    "PS5 vs Xbox Series X",
    "MacBook Air M2 vs Dell XPS 13",
    "Kindle vs Kobo",
    "Spotify vs Apple Music vs Youtube Music",
    "React vs Vue vs Angular",
    "Nike Pegasus vs Adidas Ultraboost"
  ];

  const updateSuggestions = (inputValue: string) => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      return;
    }
    
    // Extract strings from history object
    const historyStrings = history.map(h => h.query);
    const combined = Array.from(new Set([...historyStrings, ...presetSuggestions]));
    const filtered = combined.filter(item => 
      item.toLowerCase().includes(inputValue.toLowerCase()) && 
      item.toLowerCase() !== inputValue.toLowerCase()
    ).slice(0, 5);
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    updateSuggestions(val);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(undefined, suggestion);
  };

  const handlePlusClick = (e: React.MouseEvent) => {
      e.preventDefault();
      setQuery(prev => prev.trim() + " vs ");
      inputRef.current?.focus();
  };

  const calculateRealStats = () => {
    const now = Date.now();
    let duration = 0;
    if (statsPeriod === '24h') duration = 24 * 60 * 60 * 1000;
    if (statsPeriod === '7d') duration = 7 * 24 * 60 * 60 * 1000;
    if (statsPeriod === '30d') duration = 30 * 24 * 60 * 60 * 1000;

    const periodCount = history.filter(h => now - h.timestamp < duration).length;
    const previousPeriodCount = history.filter(h => now - h.timestamp >= duration && now - h.timestamp < duration * 2).length;

    let trendVal = 0;
    if (previousPeriodCount === 0) {
        trendVal = periodCount > 0 ? 100 : 0;
    } else {
        trendVal = Math.round(((periodCount - previousPeriodCount) / previousPeriodCount) * 100);
    }
    const trendStr = (trendVal >= 0 ? '+' : '') + trendVal + '%';
    
    // Count saved items in this period
    const savedPeriodCount = savedComparisons.filter(s => now - s.savedAt < duration).length;

    setRealStats({
        searches: periodCount,
        savedCount: savedPeriodCount,
        trend: trendStr
    });
  };

  // --- Handlers ---
  const handleSearch = async (e?: React.FormEvent, searchQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    if (!searchQuery) {
        setQuery(finalQuery);
    } else {
        setQuery(finalQuery);
    }
    
    setShowSuggestions(false);
    setLoadingState(LoadingState.LOADING);
    setError(null);
    setResult(null);
    setView('home');

    // Update URL without reloading to support sharing immediately
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('q', finalQuery);
      window.history.pushState({}, '', url.toString());
    } catch (err) {
      console.warn('Could not update URL history:', err);
    }

    try {
      const data = await compareProducts(finalQuery);
      setResult(data);
      setLoadingState(LoadingState.SUCCESS);
      
      // Update History (no duplicate queries at top, max 20)
      const newItem: HistoryItem = { query: finalQuery, timestamp: Date.now() };
      setHistory(prev => {
        const filtered = prev.filter(item => item.query !== finalQuery);
        return [newItem, ...filtered].slice(0, 20);
      });

    } catch (err: any) {
      console.error(err);
      setError("Ocorreu um erro ao processar sua comparação. Tente novamente mais tarde.");
      setLoadingState(LoadingState.ERROR);
    }
  };

  const toggleSave = () => {
    if (!result || !result.data) return;

    const existingIndex = savedComparisons.findIndex(
      item => item.query === result.query && item.timestamp === result.timestamp
    );

    if (existingIndex >= 0) {
      // Remove
      setSavedComparisons(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add
      const toSave: SavedComparison = {
        ...result,
        id: crypto.randomUUID(),
        savedAt: Date.now()
      };
      setSavedComparisons(prev => [toSave, ...prev]);
    }
  };

  const loadSaved = (saved: SavedComparison) => {
    setResult(saved);
    setQuery(saved.query);
    setLoadingState(LoadingState.SUCCESS);
    setView('home');
  };

  const deleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedComparisons(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const deleteHistoryItem = (e: React.MouseEvent, queryToDelete: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.query !== queryToDelete));
  };

  const isCurrentResultSaved = result 
    ? savedComparisons.some(item => item.query === result.query && item.timestamp === result.timestamp)
    : false;

  const examples = [
    "iPhone 15 Pro vs Galaxy S24 Ultra",
    "Sony WH-1000XM5 vs AirPods Max",
    "Spotify vs Apple Music vs YouTube Music",
    "React vs Vue"
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Navbar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { 
            setView('home'); 
            setResult(null); 
            setQuery(''); 
            setLoadingState(LoadingState.IDLE); 
            // Reset URL
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('q');
              window.history.pushState({}, '', url.toString());
            } catch (err) {
              console.warn('Could not reset URL history:', err);
            }
          }}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              VersusAI
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setView(view === 'home' ? 'saved' : 'home')}
              className={`p-2 rounded-lg transition-colors flex items-center space-x-2 text-sm font-medium ${view === 'saved' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
            >
              <BookmarkIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Salvos ({savedComparisons.length})</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* VIEW: Saved Comparisons */}
          {view === 'saved' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white flex items-center">
                <BookmarkIcon className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" filled />
                Comparações Salvas
              </h2>
              
              {savedComparisons.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 mb-4">Você ainda não salvou nenhuma comparação.</p>
                  <button onClick={() => setView('home')} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                    Voltar para a pesquisa
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {savedComparisons.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => loadSaved(item)}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all shadow-sm hover:shadow-md group flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-white capitalize">{item.query}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {new Date(item.savedAt).toLocaleDateString()} • {item.data?.products.length} itens comparados
                        </p>
                      </div>
                      <button 
                        onClick={(e) => deleteSaved(item.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Remover"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: Home / Search */}
          {view === 'home' && (
            <>
              {/* Hero & Search */}
              <div className={`transition-all duration-500 ease-in-out ${result || loadingState === LoadingState.LOADING ? 'mb-8' : 'min-h-[60vh] flex flex-col justify-center items-center text-center'}`}>
                {(!result && loadingState === LoadingState.IDLE) && (
                  <>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">
                      Decisões Inteligentes,<br />
                      <span className="text-indigo-600 dark:text-indigo-400">Comparações Precisas.</span>
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
                      Transformamos suas dúvidas em análises detalhadas. Compare produtos, serviços e tecnologias em segundos com IA.
                    </p>
                  </>
                )}

                {/* Search Bar Container */}
                <div className={`w-full ${result || loadingState === LoadingState.LOADING ? 'max-w-4xl mx-auto' : 'max-w-2xl mx-auto'}`}>
                  <form onSubmit={(e) => handleSearch(e)} className="relative group z-10">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <SearchIcon className="h-6 w-6 text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      className="block w-full pl-12 pr-32 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 transition-all shadow-sm"
                      placeholder="Ex: PlayStation 5 vs Xbox Series X"
                      value={query}
                      onChange={handleInputChange}
                      onFocus={() => query && updateSuggestions(query)}
                      autoComplete="off"
                      disabled={loadingState === LoadingState.LOADING}
                    />
                    
                    {/* Helper Button: Compare More */}
                    <button
                        type="button"
                        onClick={handlePlusClick}
                        className="absolute right-36 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Adicionar mais um item para comparar"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>

                    <button
                      type="submit"
                      disabled={loadingState === LoadingState.LOADING || !query.trim()}
                      className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-medium px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loadingState === LoadingState.LOADING ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analisando...
                        </span>
                      ) : (
                        <>
                          Comparar <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </button>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div 
                        ref={dropdownRef}
                        className="absolute w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 animate-fade-in"
                      >
                        <ul>
                          {suggestions.map((s, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => handleSuggestionClick(s)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                <SearchIcon className="w-4 h-4 mr-3 text-slate-400" />
                                {s}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </form>

                  {/* Examples & Dashboard (Only on Idle) */}
                  {!result && loadingState === LoadingState.IDLE && (
                    <div className="mt-8 space-y-8 animate-fade-in">
                      
                      {/* Examples */}
                      <div className="flex flex-wrap justify-center gap-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400 py-1">Tente pesquisar:</span>
                        {examples.map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => handleSearch(undefined, ex)}
                            className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>

                      {/* Stats Dashboard Grid - REORGANIZED LAYOUT */}
                      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Market Trends */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                             <TrendingUpIcon className="w-16 h-16 text-indigo-500" />
                           </div>
                           <div className="flex justify-between items-center mb-4 relative z-10">
                             <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                               <TrendingUpIcon className="w-4 h-4 mr-2 text-indigo-500" />
                               Tendências
                             </h3>
                             <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                               {(['24h', '7d', '30d'] as const).map(p => (
                                 <button
                                   key={p}
                                   onClick={() => setStatsPeriod(p)}
                                   className={`text-[10px] px-2 py-1 rounded-md transition-all ${statsPeriod === p ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                 >
                                   {p}
                                 </button>
                               ))}
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-2 text-center relative z-10">
                             <div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Buscas</p>
                               <p className="text-lg font-bold text-slate-800 dark:text-white">{realStats.searches.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Alta</p>
                               <p className={`text-sm font-semibold mt-1 ${realStats.trend.startsWith('-') ? 'text-rose-500' : 'text-emerald-500'}`}>{realStats.trend}</p>
                             </div>
                           </div>
                        </div>

                        {/* User Stats */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                             <BarChartIcon className="w-16 h-16 text-purple-500" />
                           </div>
                           <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center mb-4 relative z-10">
                             <BarChartIcon className="w-4 h-4 mr-2 text-purple-500" />
                             Suas Estatísticas
                           </h3>
                           <div className="flex items-center justify-around relative z-10">
                              <div className="text-center">
                                <span className="block text-2xl font-bold text-slate-800 dark:text-white">{history.length}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                              </div>
                              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                              <div className="text-center">
                                <span className="block text-2xl font-bold text-slate-800 dark:text-white">{realStats.savedCount}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Recentes</span>
                              </div>
                           </div>
                        </div>

                        {/* Leaderboard - FULL WIDTH */}
                        <div className="md:col-span-2">
                           <Leaderboard onSelect={(q) => { setQuery(q); handleSearch(undefined, q); }} />
                        </div>
                      </div>

                      {/* Recent History */}
                      {history.length > 0 && (
                        <div className="max-w-xl mx-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center mb-3 px-2">
                             <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center">
                               <HistoryIcon className="w-3 h-3 mr-1" /> Histórico Recente
                             </h3>
                             <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                               Limpar tudo
                             </button>
                          </div>
                          <ul className="space-y-1">
                            {history.slice(0, 5).map((item, idx) => (
                              <li key={idx}>
                                <div className="w-full flex items-center justify-between group rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors pr-2">
                                  <button
                                    onClick={() => handleSearch(undefined, item.query)}
                                    className="flex-grow text-left px-3 py-2 text-slate-600 dark:text-slate-300 flex items-center"
                                  >
                                    <span className="truncate">{item.query}</span>
                                    <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap hidden sm:inline-block">
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </span>
                                  </button>
                                  <button
                                    onClick={(e) => deleteHistoryItem(e, item.query)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remover do histórico"
                                  >
                                     <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="max-w-4xl mx-auto mt-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-6 py-4 rounded-xl flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Results Section */}
              {loadingState === LoadingState.SUCCESS && result && (
                <div className="max-w-7xl mx-auto mt-12">
                  <ComparisonResults 
                    result={result} 
                    isSaved={isCurrentResultSaved}
                    onToggleSave={toggleSave}
                    isDarkMode={darkMode}
                  />
                </div>
              )}
            </>
          )}
          
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} VersusAI. Desenvolvido com Google Gemini.</p>
          <p className="mt-2">As informações são geradas por IA e podem conter imprecisões. Verifique sempre as fontes oficiais.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
