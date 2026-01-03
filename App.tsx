
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Camera, 
  Download, 
  RefreshCw, 
  ChevronRight,
  Layers,
  Maximize2,
  HelpCircle,
  Loader2,
  Package,
  X,
  Coins,
  AlertCircle,
  LogOut,
  LogIn,
  Zap,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { Message, FashionPrompt, ProductDetails, DynamicGuide, User } from './types';
import { parseProductAndGeneratePrompts, generateStudioImage, ImageInput } from './services/geminiService';
import { fetchWalletBalance, updateWalletBalance } from './services/leadService';
import LeadForm from './LeadForm';

const COIN_COST = 3;
const WALLET_KEY = 'stitch_wallet_id';
const USER_NAME_KEY = 'stitch_user_name';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageInput | null>(null);
  const [activePrompts, setActivePrompts] = useState<FashionPrompt[]>([]);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<Message | null>(null);
  const [currentDetails, setCurrentDetails] = useState<ProductDetails | null>(null);
  const [currentGuide, setCurrentGuide] = useState<DynamicGuide | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'controls' | 'guide'>('controls');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isGeneratingThumbs = useRef(false);
  const quotaCooldown = useRef<number>(0);

  useEffect(() => {
    const initApp = async () => {
      const savedWalletId = localStorage.getItem(WALLET_KEY);
      const savedName = localStorage.getItem(USER_NAME_KEY) || 'Studio Member';
      
      if (savedWalletId) {
        // Initial setup with cached name
        setUser({ id: savedWalletId, name: savedName, email: '', walletId: savedWalletId, coins: 0 });
        
        try {
          const walletData = await fetchWalletBalance(savedWalletId);
          if (walletData !== null) {
            // Found user! Immediately update local storage and state with the REAL name from Sheet
            localStorage.setItem(USER_NAME_KEY, walletData.name);
            setUser({
              id: savedWalletId,
              name: walletData.name,
              email: '',
              walletId: savedWalletId,
              coins: walletData.coins
            });
          } else {
            // If the ID is not found, log them out to clear invalid cache
            localStorage.removeItem(WALLET_KEY);
            localStorage.removeItem(USER_NAME_KEY);
            setUser(null);
          }
        } catch (err) {
          console.error("Initialization sync failed", err);
        }
      }
      setIsAppReady(true);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (!user?.walletId) return;
    const interval = setInterval(() => syncWallet(), 60000); 
    return () => clearInterval(interval);
  }, [user?.walletId]);

  const syncWallet = async () => {
    if (!user?.walletId || isSyncing) return;
    setIsSyncing(true);
    try {
      const walletData = await fetchWalletBalance(user.walletId);
      if (walletData !== null) {
        setUser(prev => prev ? { ...prev, coins: walletData.coins, name: walletData.name } : null);
        localStorage.setItem(USER_NAME_KEY, walletData.name);
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 1500);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const generateThumbnailsSequentially = async () => {
      if (activePrompts.length === 0 || !lastAssistantMessage || isGeneratingThumbs.current || Date.now() < quotaCooldown.current) return;
      
      isGeneratingThumbs.current = true;
      const promptsToProcess = activePrompts.filter(p => !p.thumbnail);
      
      for (const promptToUpdate of promptsToProcess) {
        if (Date.now() < quotaCooldown.current) break;

        try {
          let refImage: ImageInput | undefined = undefined;
          if (lastAssistantMessage.image) {
            const [meta, data] = lastAssistantMessage.image.split(';base64,');
            refImage = { data, mimeType: meta.split(':')[1] };
          }
          
          const thumbUrl = await generateStudioImage(`Simple preview: ${promptToUpdate.label}`, refImage, true);
          setActivePrompts(prev => prev.map(p => p.id === promptToUpdate.id ? { ...p, thumbnail: thumbUrl } : p));
          
          await new Promise(r => setTimeout(r, 2500));
        } catch (error: any) {
          if (error.message.includes('quota') || error.message.includes('429')) {
            setQuotaError("The AI is a bit busy. Previews will load once it's free.");
            quotaCooldown.current = Date.now() + 15000; 
            break; 
          }
        }
      }
      isGeneratingThumbs.current = false;
    };

    generateThumbnailsSequentially();
  }, [activePrompts, lastAssistantMessage]);

  const deductCoins = async (amount: number) => {
    if (!user) return;
    const newBalance = Math.max(0, user.coins - amount);
    setUser(prev => prev ? { ...prev, coins: newBalance } : null);
    await updateWalletBalance(user.walletId, newBalance);
  };

  const checkBalance = (cost: number) => {
    if (!user) {
      setShowLeadForm(true);
      return false;
    }
    if (user.coins < cost) {
      setShowRechargeModal(true);
      return false;
    }
    return true;
  };

  const handleSend = async (text: string = inputValue) => {
    if (!user) { setShowLeadForm(true); return; }
    if (!checkBalance(COIN_COST)) return;
    if ((!text.trim() && !selectedImage) || isLoading) return;

    setQuotaError(null);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || "Check this product out!",
      timestamp: new Date(),
      image: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const { details, prompts, guide } = await parseProductAndGeneratePrompts(text, selectedImage || undefined);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Got it! I'm ready to shoot your **${details.color} ${details.category}**. Pick a style!`,
        timestamp: new Date(),
        suggestions: prompts,
        guide: guide,
        image: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined
      };
      setMessages(prev => [...prev, assistantMsg]);
      setActivePrompts(prompts);
      setCurrentDetails(details);
      setCurrentGuide(guide);
      setLastAssistantMessage(assistantMsg);
    } catch (error: any) {
      const isQuota = error.message?.toLowerCase().includes('quota') || error.message?.includes('429');
      const errorMsg = isQuota 
        ? "The AI is currently full. Please try again in 30 seconds."
        : "I'm having trouble connecting. Let's try that again.";
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errorMsg, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (prompt: FashionPrompt) => {
    if (!checkBalance(COIN_COST)) return;
    if (!lastAssistantMessage || isLoading) return;
    
    setQuotaError(null);
    const loadingMsg: Message = { id: `gen-${Date.now()}`, role: 'assistant', content: `Making your **${prompt.label}** photo...`, timestamp: new Date(), isGenerating: true };
    setMessages(prev => [...prev, loadingMsg]);
    setIsLoading(true);

    try {
      let refImage: ImageInput | undefined = undefined;
      if (lastAssistantMessage.image) {
        const [meta, data] = lastAssistantMessage.image.split(';base64,');
        refImage = { data, mimeType: meta.split(':')[1] };
      }
      const imageUrl = await generateStudioImage(prompt.prompt, refImage);
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, content: `Your photo is ready! ✨`, image: imageUrl, isGenerating: false } : m));
      await deductCoins(COIN_COST);
    } catch (error: any) {
      const isQuota = error.message?.toLowerCase().includes('quota') || error.message?.includes('429');
      const failMsg = isQuota 
        ? "Too many requests. Please wait 1 minute."
        : "Couldn't create the photo.";
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, content: failMsg, isGenerating: false } : m));
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    setUser(null);
    setMessages([]);
    setActivePrompts([]);
  };

  if (!isAppReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-white flex-col gap-4">
         <Loader2 className="w-10 h-10 animate-spin text-black" />
         <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Entering Studio</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white selection:bg-black selection:text-white">
      {showLeadForm && (
        <LeadForm 
          onSuccess={(walletId, coins, name) => {
            localStorage.setItem(WALLET_KEY, walletId);
            localStorage.setItem(USER_NAME_KEY, name);
            setUser({ id: walletId, name: name, email: '', walletId: walletId, coins: coins });
            setShowLeadForm(false);
          }} 
          onClose={() => setShowLeadForm(false)} 
        />
      )}
      
      {quotaError && (
        <div className="bg-amber-100 text-amber-900 px-6 py-2.5 flex items-center justify-between z-[200]">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold">{quotaError}</p>
          </div>
          <button onClick={() => setQuotaError(null)} className="p-1 hover:bg-amber-200 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showRechargeModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-100 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="w-8 h-8 text-amber-500" /></div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">Need Credits?</h3>
            <p className="text-slate-500 mb-6 text-sm">You've run out of credits. Send us a message to top up your wallet!</p>
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">WhatsApp Support</span>
              <span className="text-xl font-bold text-black">+917435831062</span>
            </div>
            <div className="flex flex-col gap-2">
              <a href="https://wa.me/917435831062" target="_blank" rel="noopener noreferrer" className="py-3.5 bg-black text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">Recharge Now</a>
              <button onClick={() => setShowRechargeModal(false)} className="py-3 text-slate-400 font-bold hover:text-black text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          <button className="absolute top-6 right-6 text-white/70 hover:text-white p-3 bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
        </div>
      )}

      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-black rounded-lg"><Sparkles className="w-4 h-4 text-white" /></div>
          <h1 className="text-lg font-bold text-slate-900">StitchAI</h1>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none">{user.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{user.walletId}</p>
              </div>
              <div 
                onClick={syncWallet}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all active:scale-95 ${isSyncing ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
              >
                {isSyncing ? <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" /> : <Coins className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                <span className="text-base font-black text-slate-900">{user.coins}</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-500 transition-all"><LogOut className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setShowLeadForm(true)} className="px-5 py-2.5 bg-black text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2"><LogIn className="w-4 h-4" /> Studio Access</button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 border-r border-slate-100">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 text-slate-200">
                  <ImageIcon className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Professional Photo Studio</h2>
                <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">
                  Enter a product name or upload a photo to start. I'll help you create professional commercial shots instantly.
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Step 1</p>
                    <p className="text-xs font-bold text-slate-700">Upload Product</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Step 2</p>
                    <p className="text-xs font-bold text-slate-700">Pick Style</p>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                <div className={`max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'bg-black text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md' : 'space-y-4'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0 shadow-sm"><Sparkles className="w-4 h-4 text-white" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-800 bg-white px-5 py-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm whitespace-pre-wrap leading-relaxed text-sm font-medium">{msg.content}</div>
                        
                        {msg.isGenerating && (
                          <div className="mt-3 flex items-center gap-2.5 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" /> 
                            <span className="text-[10px] font-bold uppercase tracking-widest">Processing...</span>
                          </div>
                        )}

                        {msg.image && (
                          <div className="mt-4 relative group overflow-hidden rounded-xl shadow-lg border border-slate-100 cursor-zoom-in" onClick={() => setZoomedImage(msg.image!)}>
                            <img src={msg.image} className="w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = msg.image!; link.download = `photo_${Date.now()}.png`; link.click(); }} 
                                className="p-2 bg-white/90 text-black rounded-lg shadow-md hover:bg-white active:scale-95"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="space-y-3">
                      {msg.image && <img src={msg.image} className="max-w-full rounded-xl border border-white/20" />}
                      <p className="font-semibold text-sm leading-snug">{msg.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="max-w-3xl mx-auto">
              {selectedImage && (
                <div className="relative inline-block mb-3 animate-in zoom-in-95">
                  <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-20 h-20 object-cover rounded-xl border-2 border-white shadow-md" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full border-2 border-white hover:scale-110 transition-all"><X className="w-2.5 h-2.5" /></button>
                </div>
              )}
              <div className="relative flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setSelectedImage({ data: (reader.result as string).split(',')[1], mimeType: file.type });
                    reader.readAsDataURL(file);
                  }
                }} accept="image/*" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`p-3.5 rounded-xl transition-all ${selectedImage ? 'bg-black text-white' : 'bg-slate-50 text-slate-400 hover:text-black hover:bg-slate-100'}`}
                >
                  <Camera className="w-5 h-5" />
                </button>
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={inputValue} 
                    onChange={(e) => setInputValue(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                    placeholder="Describe your product..." 
                    className="w-full pl-5 pr-16 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-black focus:bg-white outline-none transition-all font-bold text-slate-900 shadow-sm text-sm" 
                  />
                  <button 
                    onClick={() => handleSend()} 
                    disabled={isLoading} 
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-20 flex items-center justify-center transition-all active:scale-95"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full md:w-[350px] lg:w-[400px] bg-white h-full flex flex-col border-l border-slate-100 shadow-xl z-40">
          <div className="flex border-b border-slate-50">
            <button 
              onClick={() => setSidebarTab('controls')} 
              className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all relative ${sidebarTab === 'controls' ? 'text-black' : 'text-slate-300'}`}
            >
              Choose Style
              {sidebarTab === 'controls' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
            <button 
              onClick={() => setSidebarTab('guide')} 
              className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all relative ${sidebarTab === 'guide' ? 'text-black' : 'text-slate-300'}`}
            >
              Pro Tips
              {sidebarTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {sidebarTab === 'controls' ? (
              <div className="grid gap-3">
                {activePrompts.map((s) => (
                  <button 
                    key={s.id} 
                    onClick={() => handleGenerate(s)} 
                    disabled={isLoading} 
                    className="group p-3 bg-white border border-slate-100 rounded-xl hover:border-black hover:shadow-md transition-all flex items-center gap-4 text-left active:scale-95"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-50 relative">
                      {s.thumbnail ? (
                        <img src={s.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-10">
                           <ImageIcon className="w-5 h-5" />
                           <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 truncate tracking-tight">{s.label}</span>
                      <span className="text-[8px] font-bold text-slate-300 group-hover:text-black uppercase tracking-widest transition-colors flex items-center gap-1">
                        <Maximize2 className="w-2 h-2" /> High Quality
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <ChevronRight className="w-4 h-4 text-slate-100 group-hover:text-black transition-all" />
                      {user && <span className="text-[9px] font-black text-slate-300 group-hover:text-black">-{COIN_COST}</span>}
                    </div>
                  </button>
                ))}
                {activePrompts.length === 0 && (
                  <div className="py-32 text-center opacity-20">
                    <Layers className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-lg font-bold text-slate-900">Waiting for Product</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Ready to create shots</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {currentGuide ? currentGuide.shots.map((shot, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                    <div className="flex items-center gap-3 mb-3">
                       <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center text-[10px] font-bold shadow-sm">{i+1}</div>
                       <h5 className="font-bold text-sm text-slate-900 tracking-tight">{shot.title}</h5>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-white p-2 rounded-lg border border-white">
                        <p className="text-[8px] font-bold text-slate-300 uppercase mb-0.5">Position</p>
                        <p className="text-xs font-bold text-slate-800">{shot.pose}</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-white">
                        <p className="text-[8px] font-bold text-slate-300 uppercase mb-0.5">Angle</p>
                        <p className="text-xs font-bold text-slate-800">{shot.angle}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 italic leading-relaxed">{shot.why}</p>
                  </div>
                )) : (
                  <div className="py-32 text-center opacity-20">
                    <HelpCircle className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <p className="text-lg font-bold text-slate-900">No Tips Yet</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Tips appear after you enter a product</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center gap-4">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md shrink-0">
               <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[8px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">System Status</p>
              <p className="text-sm font-bold text-slate-900">Professional Rendering Active</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
