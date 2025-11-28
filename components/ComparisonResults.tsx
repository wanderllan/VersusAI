
import React, { useState, useEffect } from 'react';
import { AnalysisResult, ChatMessage, PersonaDefinition } from '../types';
import ComparisonChart from './ComparisonChart';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  CheckCircleIcon, XCircleIcon, TrophyIcon, ExternalLinkIcon, BookmarkIcon, ShareIcon, 
  MessageSquareIcon, SendIcon, GamepadIcon, GraduationCapIcon, BriefcaseIcon, WalletIcon,
  CameraIcon, HeartIcon, ZapIcon, StarIcon, MusicIcon, HomeIcon, FlameIcon, ThumbsUpIcon, ThumbsDownIcon,
  SpeakerIcon, StopIcon, ShoppingCartIcon, SparklesIcon, EyeIcon, EyeOffIcon
} from './Icons';
import { refineComparison, getPersonaAnalysis } from '../services/gemini';

interface ComparisonResultsProps {
  result: AnalysisResult;
  isSaved: boolean;
  onToggleSave: () => void;
  isDarkMode: boolean;
}

const ComparisonResults: React.FC<ComparisonResultsProps> = ({ result, isSaved, onToggleSave, isDarkMode }) => {
  const { data, sources, rawText, timestamp } = result;
  
  // Chat/Refine State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [shareText, setShareText] = useState("Compartilhar");

  // Persona State
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [personaResult, setPersonaResult] = useState<{winner: string, reason: string} | null>(null);
  const [loadingPersona, setLoadingPersona] = useState(false);

  // Filter State
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  // Rating State
  const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);
  const [rowFeedback, setRowFeedback] = useState<{[key: number]: 'up' | 'down'}>({});

  // Audio/Narrator State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSynth, setSpeechSynth] = useState<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSpeechSynth(window.speechSynthesis);
    }
  }, []);

  // Load persistence (Persona & Row Feedback)
  useEffect(() => {
    try {
      // 1. Load Persona
      const savedPersona = localStorage.getItem('preferredPersonaId');
      let personaIdToSelect: string | null = null;
      let personaLabelToSelect: string | null = null;

      if (savedPersona && data?.personas.some(p => p.id === savedPersona)) {
        personaIdToSelect = savedPersona;
      } else if (data?.suggestedPersona) {
        personaIdToSelect = data.suggestedPersona;
      }

      if (personaIdToSelect && data) {
         const p = data.personas.find(p => p.id === personaIdToSelect);
         if (p) {
             setSelectedPersona(p.id);
             personaLabelToSelect = p.label;
         }
      }

      // Automatically fetch analysis if we have a selection but no result yet
      // This fulfills the "Automatic AI Profile Suggestion" requirement
      if (personaIdToSelect && personaLabelToSelect && !personaResult) {
          handlePersonaSelect(personaLabelToSelect, personaIdToSelect);
      }

      // 2. Load Row Feedback
      if (timestamp) {
          const feedbackKey = `feedback_${timestamp}`;
          const savedFeedback = localStorage.getItem(feedbackKey);
          if (savedFeedback) {
              setRowFeedback(JSON.parse(savedFeedback));
          }
      }

    } catch(e) {
      console.warn("LocalStorage access failed", e);
    }
  }, [data, timestamp]); // Depend on data/timestamp to reload on new search

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (speechSynth) {
        speechSynth.cancel();
      }
    };
  }, [speechSynth]);

  const getPersonaIcon = (iconName: string) => {
    switch (iconName) {
      case 'gamepad': return GamepadIcon;
      case 'student': return GraduationCapIcon;
      case 'briefcase': return BriefcaseIcon;
      case 'wallet': return WalletIcon;
      case 'camera': return CameraIcon;
      case 'heart': return HeartIcon;
      case 'zap': return ZapIcon;
      case 'star': return StarIcon;
      case 'music': return MusicIcon;
      case 'home': return HomeIcon;
      default: return StarIcon;
    }
  };

  const getPersonaColor = (index: number) => {
    const styles = [
      { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
      { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
      { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
      { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    ];
    return styles[index % styles.length];
  };

  const handlePersonaSelect = async (personaLabel: string, personaId: string) => {
    setSelectedPersona(personaId);
    try {
      localStorage.setItem('preferredPersonaId', personaId);
    } catch(e) {
      console.warn("Failed to save preferred persona", e);
    }
    
    // Check if we already have a result for this specific persona to avoid re-fetching?
    // For simplicity, we just refetch to ensure freshness or reset state.
    // In a production app, we might cache this per ID in a state object.
    
    setLoadingPersona(true);
    setPersonaResult(null);

    try {
      if (data) {
        const result = await getPersonaAnalysis(data, personaLabel);
        setPersonaResult(result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPersona(false);
    }
  };

  const handleShare = async () => {
    if (!data) return;
    
    // Create Deep Link
    const url = new URL(window.location.href);
    url.searchParams.set('q', result.query);
    const shareUrl = url.toString();

    const productNames = data.products.map(p => p.name).join(' vs ');
    const text = `Confira essa comparação no VersusAI: ${productNames}\n\nVeredito: ${data.verdict}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `VersusAI: ${productNames}`,
          text: text,
          url: shareUrl,
        });
        setShareText("Compartilhado!");
        setTimeout(() => setShareText("Compartilhar"), 2000);
      } catch (err) {
        console.log("Error sharing", err);
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(shareUrl);
      setShareText("Link Copiado!");
      setShowShareToast(true);
      setTimeout(() => {
        setShareText("Compartilhar");
        setShowShareToast(false);
      }, 3000);
    }
  };

  const handleSpeakToggle = () => {
    if (!speechSynth || !data) return;

    if (isSpeaking) {
      speechSynth.cancel();
      setIsSpeaking(false);
    } else {
      const textToRead = `Comparação entre ${data.products.map(p => p.name).join(' e ')}. Veredito: ${data.verdict}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'pt-BR'; // Portuguese Brazil
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      speechSynth.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleRowFeedback = (idx: number, type: 'up' | 'down') => {
    const newFeedback = { ...rowFeedback, [idx]: type };
    setRowFeedback(newFeedback);
    try {
        if(timestamp) {
            localStorage.setItem(`feedback_${timestamp}`, JSON.stringify(newFeedback));
        }
    } catch(e) { console.warn("Error saving feedback", e) }
  };

  const submitRefine = async (msg: string) => {
    if (!msg.trim() || !data) return;
    const userMsg: ChatMessage = { role: 'user', text: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setIsRefining(true);

    try {
      const responseText = await refineComparison(data, userMsg.text);
      setChatMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Erro ao refinar a resposta." }]);
    } finally {
      setIsRefining(false);
    }
  };

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitRefine(chatInput);
    setChatInput('');
  };

  const quickRefineOptions = [
    "Resuma para uma criança de 5 anos",
    "Qual tem melhor custo-benefício?",
    "Explique os termos técnicos",
    "Quem tem melhor suporte?"
  ];

  if (!data && rawText) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 mt-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Resultado da Análise</h3>
        <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {rawText}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { products, summary, verdict, comparisonTable, scores, personas, suggestedPersona, rivalryScore, rivalryText, searchTrend } = data;

  // Filter Logic
  const displayedTable = showOnlyDifferences 
    ? comparisonTable.filter(row => row.isKeyDifference)
    : comparisonTable;

  const borderColors = [
    "border-blue-500", "border-emerald-500", "border-purple-500", "border-amber-500", "border-pink-500"
  ];
  const tagColors = [
    "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    "bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"
  ];

  const gridCols = products.length === 2 ? 'md:grid-cols-2' : 
                   products.length === 3 ? 'md:grid-cols-3' : 
                   'md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className="space-y-8 animate-fade-in pb-12 relative">
      
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white hidden sm:block">
          Comparação ({products.length} itens)
        </h2>
        <div className="flex space-x-3 w-full sm:w-auto justify-end">
          <button 
            onClick={onToggleSave}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors border ${isSaved ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            <BookmarkIcon filled={isSaved} className="w-4 h-4" />
            <span className="hidden xs:inline">{isSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative"
          >
            <ShareIcon className="w-4 h-4" />
            <span className="hidden xs:inline">{shareText}</span>
            {showShareToast && (
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap animate-fade-in">
                Link copiado!
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Thermometer / Rivalry Section / Trends */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Thermometer */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
            <FlameIcon className={`w-8 h-8 ${rivalryScore > 75 ? 'text-orange-600 animate-pulse' : 'text-orange-500'}`} />
          </div>
          <div className="flex-grow w-full">
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-bold text-slate-800 dark:text-white">Termômetro da Rivalidade</h3>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{rivalryScore}% Aquecido</span>
            </div>
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-1000 ease-out"
                style={{ width: `${rivalryScore}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">{rivalryText}</p>
          </div>
        </div>

        {/* Trend Chart - Small Visualization */}
        {searchTrend && searchTrend.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Interesse (Últimos 6 meses)</h3>
            <div className="flex-grow h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={searchTrend}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                    itemStyle={{ color: '#6366f1' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Product Cards */}
      <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
        {products.map((product, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border-t-4 ${borderColors[idx % borderColors.length]} relative overflow-hidden transition-colors flex flex-col`}>
            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-sm font-medium ${tagColors[idx % tagColors.length]}`}>
              Opção {idx + 1}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{product.name}</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 font-medium mb-4">{product.priceEstimate}</p>
            
            <div className="space-y-2 flex-grow">
              <h4 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pontos Fortes</h4>
              <ul className="space-y-1">
                {product.pros.slice(0, 4).map((pro, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500 mr-2 mt-0.5 flex-shrink-0" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 space-y-2 mb-6">
              <h4 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pontos Fracos</h4>
              <ul className="space-y-1">
                {product.cons.slice(0, 3).map((con, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700 dark:text-slate-300">
                    <XCircleIcon className="w-4 h-4 text-rose-500 mr-2 mt-0.5 flex-shrink-0" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>

            <a 
              href={`https://www.google.com/search?q=${encodeURIComponent(product.name)}&tbm=shop`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto w-full py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium text-sm flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              <ShoppingCartIcon className="w-4 h-4 mr-2" />
              Comprar / Ver Preços
            </a>
          </div>
        ))}
      </div>

      {/* Persona Verdict Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 p-6 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
          <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded mr-2 uppercase tracking-wide">Novo</span>
          Veredito por Perfil (Sugerido pela IA)
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
          Selecione o perfil que mais combina com você para ver quem vence nessa situação.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {personas && personas.map((p, index) => {
            const isSuggested = suggestedPersona === p.id;
            const Icon = getPersonaIcon(p.icon);
            const style = getPersonaColor(index);
            return (
              <button
                key={p.id}
                onClick={() => handlePersonaSelect(p.label, p.id)}
                className={`relative flex flex-col items-center p-4 rounded-xl transition-all duration-200 border-2 ${
                  selectedPersona === p.id 
                    ? 'border-indigo-500 bg-white dark:bg-slate-700 shadow-md scale-105' 
                    : isSuggested 
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10'
                      : 'border-transparent bg-white dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:border-indigo-200 dark:hover:border-slate-600'
                }`}
              >
                {isSuggested && (
                  <span className="absolute -top-3 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full uppercase tracking-wide">
                    Recomendado
                  </span>
                )}
                <div className={`p-3 rounded-full mb-3 ${style.bg}`}>
                  <Icon className={`w-6 h-6 ${style.color}`} />
                </div>
                <div className="text-center">
                  <span className={`block font-medium text-sm ${selectedPersona === p.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                    {p.label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight mt-1 line-clamp-2">
                    {p.description}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Dynamic Result Area */}
        <div className="transition-all duration-300 min-h-[100px]">
          {loadingPersona ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 animate-pulse">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
              <span className="text-sm">Analisando o melhor para esse perfil...</span>
            </div>
          ) : personaResult && selectedPersona ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border-l-4 border-indigo-500 shadow-sm animate-fade-in">
              <div className="flex items-start mb-2">
                <TrophyIcon className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                    Vencedor: <span className="text-indigo-600 dark:text-indigo-400">{personaResult.winner}</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    {personaResult.reason}
                  </p>
                </div>
              </div>
            </div>
          ) : (
             <div className="text-center py-6 text-slate-400 text-sm italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
               Clique em um perfil acima para ver a recomendação personalizada.
             </div>
          )}
        </div>
      </div>

      {/* Summary & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
             <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">Resumo Executivo</h3>
             <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{summary}</p>
          </div>
          
           <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 rounded-xl shadow-lg text-white">
             <div className="flex justify-between items-start">
               <div className="flex items-center mb-3">
                 <TrophyIcon className="w-6 h-6 mr-2 text-yellow-300" />
                 <h3 className="text-lg font-bold">Veredito Geral</h3>
               </div>
               
               {/* Narrator Button */}
               <button 
                onClick={handleSpeakToggle}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white"
                title={isSpeaking ? "Parar leitura" : "Ouvir veredito"}
               >
                 {isSpeaking ? <StopIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
               </button>
             </div>
             
             <p className="text-indigo-50 leading-relaxed font-medium">{verdict}</p>
             
             {/* Rating System */}
             <div className="mt-6 pt-4 border-t border-indigo-500/30 flex items-center justify-between">
                <span className="text-xs text-indigo-200 uppercase tracking-wider">Essa análise foi útil?</span>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => setUserRating('up')}
                    className={`p-2 rounded-full transition-colors ${userRating === 'up' ? 'bg-white text-indigo-600' : 'bg-indigo-800/50 hover:bg-indigo-800 text-white'}`}
                  >
                    <ThumbsUpIcon className="w-4 h-4" filled={userRating === 'up'} />
                  </button>
                  <button 
                    onClick={() => setUserRating('down')}
                    className={`p-2 rounded-full transition-colors ${userRating === 'down' ? 'bg-white text-indigo-600' : 'bg-indigo-800/50 hover:bg-indigo-800 text-white'}`}
                  >
                    <ThumbsDownIcon className="w-4 h-4" filled={userRating === 'down'} />
                  </button>
                </div>
             </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <ComparisonChart 
            data={scores} 
            productNames={products.map(p => p.name)} 
            isDarkMode={isDarkMode} 
          />
        </div>
      </div>

      {/* Feature Table - Dynamic Cols */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Comparativo Detalhado</h3>
          
          <button 
            onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
            className={`flex items-center text-xs px-3 py-1.5 rounded-full transition-colors ${showOnlyDifferences ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
          >
            {showOnlyDifferences ? (
                <>
                    <EyeIcon className="w-3 h-3 mr-1.5" />
                    Mostrar Tudo
                </>
            ) : (
                <>
                    <EyeOffIcon className="w-3 h-3 mr-1.5" />
                    Apenas Diferenças
                </>
            )}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <th className="px-6 py-3 font-medium min-w-[150px]">Característica</th>
                {products.map((p, i) => (
                   <th key={i} className={`px-6 py-3 font-medium min-w-[150px] ${i === 0 ? 'text-blue-600 dark:text-blue-400' : i === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                     {p.name}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {displayedTable.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`group transition-colors ${row.isKeyDifference ? 'bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 relative group">
                    <div className="flex items-center">
                      {row.isKeyDifference && (
                        <SparklesIcon className="w-4 h-4 text-amber-500 mr-2" />
                      )}
                      {row.feature}
                    </div>
                    
                    {/* Row Utility Feedback */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col space-y-1">
                      <button onClick={() => handleRowFeedback(idx, 'up')} className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 ${rowFeedback[idx] === 'up' ? 'text-green-500' : 'text-slate-400'}`}>
                        <ThumbsUpIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  {row.values.map((val, vIdx) => {
                    const isWinner = row.winnerIndex === vIdx;
                    return (
                      <td key={vIdx} className={`px-6 py-4 ${isWinner ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {displayedTable.length === 0 && (
                  <tr>
                      <td colSpan={products.length + 1} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic">
                          Nenhuma diferença chave encontrada para exibir. Clique em "Mostrar Tudo".
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Fontes Consultadas (Google Search Grounding)</h4>
          <div className="flex flex-wrap gap-3">
            {sources.map((source, idx) => (
              <a 
                key={idx} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
              >
                <ExternalLinkIcon className="w-3 h-3 mr-1" />
                <span className="truncate max-w-[200px]">{source.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Refine / Chat Section */}
      <div className="mt-12 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
          <div className="flex items-center">
            <MessageSquareIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-300">Dúvidas sobre a comparação?</h3>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
             {chatMessages.length === 0 && (
               <div className="text-center py-4">
                 <p className="text-slate-400 dark:text-slate-500 text-sm italic mb-4">Use uma das opções rápidas abaixo ou digite sua pergunta:</p>
                 <div className="flex flex-wrap justify-center gap-2">
                    {quickRefineOptions.map((opt, i) => (
                      <button 
                        key={i}
                        onClick={() => submitRefine(opt)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-300 text-xs rounded-full transition-colors border border-slate-200 dark:border-slate-600"
                      >
                        {opt}
                      </button>
                    ))}
                 </div>
               </div>
             )}
             {chatMessages.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                   msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                 }`}>
                   {msg.text}
                 </div>
               </div>
             ))}
             {isRefining && (
               <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-none flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                  </div>
               </div>
             )}
          </div>

          <form onSubmit={handleRefineSubmit} className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Faça uma pergunta específica sobre esses produtos..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
              disabled={isRefining}
            />
            <button 
              type="submit" 
              disabled={!chatInput.trim() || isRefining}
              className="absolute right-2 top-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ComparisonResults;
