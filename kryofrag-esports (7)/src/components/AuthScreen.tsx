import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Zap } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

interface AuthScreenProps {
  appName: string;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ appName, onToast }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [ign, setIgn] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    const cleanIgn = ign.trim();
    const cleanMobile = mobileNumber.trim();

    if (authMode === 'signup') {
      if (!cleanIgn) {
        setErrorMsg('Please enter your Free Fire In-Game Name (IGN).');
        return;
      }
      const digitsOnly = cleanMobile.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        setErrorMsg('Please enter a valid 10-digit WhatsApp / Mobile Number.');
        return;
      }
    }

    setSubmitting(true);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        onToast('Welcome back to the Arena!', 'success');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        try {
          await setDoc(
            doc(db, 'users', cred.user.uid),
            {
              email: cred.user.email,
              ign: cleanIgn,
              mobileNumber: cleanMobile,
              walletBalance: 0,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, `users/${cred.user.uid}`);
        }
        onToast('Account created! Welcome!', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(msg.replace('Firebase: ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#00FF88]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#FF5500]/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md card-surface rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 border border-white/10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00FF88]/20 to-[#FF5500]/20 border border-[#00FF88]/40 mb-3 glow-green-sm">
            <Zap className="w-7 h-7 text-[#00FF88]" />
          </div>
          <h1 className="font-gaming text-3xl font-bold uppercase tracking-wider text-white text-balance">
            {appName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compete in Free Fire Custom Rooms &amp; Win Real Rewards
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
            }}
            className={`min-h-[42px] rounded-lg text-sm font-semibold transition whitespace-nowrap ${
              authMode === 'login'
                ? 'bg-[#00FF88] text-[#0B0E14] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setErrorMsg('');
            }}
            className={`min-h-[42px] rounded-lg text-sm font-semibold transition whitespace-nowrap ${
              authMode === 'signup'
                ? 'bg-[#00FF88] text-[#0B0E14] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div>
                <label
                  htmlFor="auth-ign"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Free Fire In-Game Name (IGN)
                </label>
                <input
                  id="auth-ign"
                  type="text"
                  required
                  maxLength={30}
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                  placeholder="Enter your exact FF IGN"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-mobile"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  WhatsApp / Mobile Number
                </label>
                <input
                  id="auth-mobile"
                  type="tel"
                  inputMode="tel"
                  required
                  maxLength={15}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g., 9876543210"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
            />
          </div>

          {errorMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-lg uppercase tracking-wider hover:brightness-110 active:scale-[0.99] transition glow-green disabled:opacity-60"
          >
            {submitting
              ? authMode === 'login'
                ? 'Signing In...'
                : 'Creating Account...'
              : authMode === 'login'
                ? 'Enter Arena'
                : 'Create Account'}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500 mt-5">
          1 Coin = ₹1 INR · Instant Room Details · Secure Wallet
        </p>
      </div>
    </section>
  );
};
