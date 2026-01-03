
import React, { useState } from 'react';
import { 
  X, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Briefcase, 
  ShieldCheck, 
  RefreshCw, 
  Coins,
  ArrowRight,
  Sparkles,
  Key as KeyIcon,
  Search,
  CheckCircle2
} from 'lucide-react';
import { submitLeadToGoogleSheet, fetchWalletBalance } from './services/leadService';

interface LeadFormProps {
  onSuccess: (walletId: string, coins: number, name: string) => void;
  onClose: () => void;
}

const LeadForm: React.FC<LeadFormProps> = ({ onSuccess, onClose }) => {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessCategory: ''
  });
  const [loginKey, setLoginKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedWalletId, setGeneratedWalletId] = useState('');
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateWalletId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'ST-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginKey) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const walletData = await fetchWalletBalance(loginKey.trim().toUpperCase());
      if (walletData !== null) {
        // We found the user! Use their actual name from the sheet.
        onSuccess(loginKey.trim().toUpperCase(), walletData.coins, walletData.name);
      } else {
        setError("Studio Key not found in registry. Please check your ID.");
      }
    } catch (err) {
      setError("Cloud registry is temporarily unreachable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.businessCategory) return;
    setError(null);
    setIsSubmitting(true);
    
    try {
      const walletId = generateWalletId();
      const initialCoins = 50;

      await submitLeadToGoogleSheet({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        businessCategory: formData.businessCategory,
        walletId: walletId,
        coins: initialCoins
      });
      
      setGeneratedWalletId(walletId);
      setIsSuccess(true);
    } catch (err: any) {
      setError("Server busy. Please try one more time.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl animate-in fade-in duration-500">
        <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Coins className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Registration Complete</h3>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">
            Welcome, <b>{formData.name}</b>. Your studio is ready with 50 free credits.
          </p>
          <div className="bg-black p-6 rounded-2xl mb-8 shadow-xl">
            <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-2">Unique Studio Key</p>
            <p className="text-2xl font-mono font-bold text-white tracking-widest">{generatedWalletId}</p>
          </div>
          <button 
            onClick={() => onSuccess(generatedWalletId, 50, formData.name)}
            className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95"
          >
            Enter Studio <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white animate-in zoom-in-95">
        <div className="bg-white p-8 pb-4 text-center relative border-b border-slate-50">
          <div className="relative z-10">
            <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold mb-1 text-slate-900 tracking-tight">Studio Access</h3>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">
              {mode === 'signup' ? 'New Creative Account' : 'Returning Studio Member'}
            </p>
          </div>
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-black transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-8 pt-6">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'signup' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Start New
            </button>
            <button 
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'login' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Sync Key
            </button>
          </div>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}

          {mode === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-3">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors z-10" />
                  <input 
                    required 
                    type="text" 
                    placeholder="Your Professional Name" 
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-900 placeholder-slate-300 focus:border-black transition-all" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors z-10" />
                  <input 
                    required 
                    type="email" 
                    placeholder="Work Email" 
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-900 placeholder-slate-300 focus:border-black transition-all" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors z-10" />
                  <input 
                    required 
                    type="tel" 
                    placeholder="WhatsApp (for support)" 
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-900 placeholder-slate-300 focus:border-black transition-all" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                  />
                </div>
                <div className="relative group">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors z-10" />
                  <select 
                    required 
                    className="w-full pl-11 pr-8 py-3.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-900 appearance-none focus:border-black transition-all cursor-pointer" 
                    value={formData.businessCategory} 
                    onChange={e => setFormData({...formData, businessCategory: e.target.value})}
                  >
                    <option value="" disabled>Select Category</option>
                    <option value="Fashion">Fashion Brand</option>
                    <option value="Ecom">Amazon/E-com Seller</option>
                    <option value="Agency">Creative Agency</option>
                    <option value="Jewelry">Jewelry & Accessories</option>
                    <option value="Other">Independent Artist</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-black text-white rounded-xl font-bold text-base flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 mt-4 active:scale-[0.98]">
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5 text-amber-500" /> Create Atelier Account</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative group">
                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors z-10" />
                <input 
                  required 
                  type="text" 
                  placeholder="ST-XXXXXX" 
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-base text-slate-900 placeholder-slate-300 focus:border-black focus:bg-white transition-all text-center uppercase tracking-[0.2em]" 
                  value={loginKey} 
                  onChange={e => setLoginKey(e.target.value)} 
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Your profile and balance will be synced<br/>from the global registry.
                </p>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-black text-white rounded-xl font-bold text-base flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Syncing Identity...</span>
                  </div>
                ) : (
                  <><Search className="w-5 h-5 text-amber-500" /> Restore My Session</>
                )}
              </button>
            </form>
          )}
          
          <div className="mt-8 flex items-center justify-center gap-2 opacity-30">
            <div className="h-[1px] w-8 bg-slate-300"></div>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Global Registry Sync</p>
            <div className="h-[1px] w-8 bg-slate-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadForm;
