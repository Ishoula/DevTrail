'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Compass, BookOpen, RefreshCw, X } from 'lucide-react';

const DEVELOPER_FABLES = [
  {
    title: 'The Curse of the Friday Deploy',
    content: "A bold squire of the code committed a major refactor directly to main at Friday 4:59 PM. 'It compiles locally,' he whispered to the wind. The weekend came, and with it, a tempest of database locks and PagerDuty sirens. When Monday dawned, the staging server had vanished, replaced by a single, mocking file: debug_final_v3.tmp.",
  },
  {
    title: 'The Wandering Git Branch',
    content: 'Long ago, a branch named feature/auth-cleanup diverged from the path of main. It wandered through the dark valleys of merge conflicts, surviving on stale refactors and legacy APIs. Legend says it still roams the Git history, calling out to developers who forget to rebase.',
  },
  {
    title: 'The Centered Div Portal',
    content: 'A young wizard sought to center a block element both vertically and horizontally. Rejecting the ancient runes of Flexbox and Grid, he used absolute positioning with top, left, and transform translate. The div centered, but the sheer force tore a rift in the DOM, pulling all surrounding text into a black hole of undefined spacing.',
  },
  {
    title: 'The Siren Song of Custom Auth',
    content: "A builder of apps heard a voice: 'Why write complex security rules when you can code your own crypto in 12 lines of custom Node middleware?' He set sail into the sea of token management and session cookies. After three sleepless nights, his ship crashed upon the reef of cross-site vulnerabilities.",
  },
  {
    title: 'The Legend of the Infinite Loop',
    content: "A traveler forgot to increment the loop counter. 'While true,' they wrote, 'we shall seek the truth.' The CPU cores began to hum a dark song, fans spinning like jet engines. The memory heap filled to the brim. To this day, the traveler's browser tab is still spinning, seeking the unreachable truth.",
  },
];

export default function NotFound() {
  const [fableIndex, setFableIndex] = useState(0);
  const [isFableOpen, setIsFableOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setFableIndex(Math.floor(Math.random() * DEVELOPER_FABLES.length));
  }, []);

  const nextFable = () => {
    setFableIndex((prev) => (prev + 1) % DEVELOPER_FABLES.length);
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#070b19]" />;
  }

  return (
    <main className="bg-gradient-to-b from-[#070b19] via-[#0d1530] to-[#1a1429] min-h-screen w-full text-[#eedbb2] flex flex-col items-center justify-center p-4 overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Desktop/Tablet Layout */}
      <div className="relative hidden md:block w-full max-w-[960px] aspect-[1024/681] bg-[url('/images/404-bg.jpg')] bg-cover bg-center rounded-2xl border-4 border-amber-950/40 shadow-2xl shadow-black/85 overflow-hidden group select-none">
        
        {/* Soft atmospheric overlay */}
        <div className="absolute inset-0 bg-indigo-950/5 pointer-events-none mix-blend-color-burn" />

        {/* Ambient Moon Glow */}
        <div className="absolute left-[72%] top-[16%] w-24 h-24 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen bg-[radial-gradient(circle,rgba(254,240,138,0.25)_0%,rgba(147,197,253,0.05)_50%,transparent_70%)] animate-lantern-glow" />

        {/* Animated Lantern Light */}
        <div className="absolute left-[63.5%] top-[47.5%] w-16 h-16 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen bg-[radial-gradient(circle,rgba(253,224,71,0.65)_0%,rgba(251,191,36,0.3)_40%,transparent_70%)] animate-lantern-glow" />

        {/* Pulsing Question Mark Glow */}
        <div className="absolute left-[45.2%] top-[40%] w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen bg-[radial-gradient(circle,rgba(253,224,71,0.35)_0%,transparent_75%)] animate-question-float" />

        {/* Sky Sparkles / Stars */}
        <div className="absolute left-[9%] top-[18%] w-1.5 h-1.5 bg-amber-200 rounded-full blur-[0.5px] animate-twinkle opacity-60" style={{ animationDelay: '0s' }} />
        <div className="absolute left-[11%] top-[23%] w-1 h-1 bg-amber-100 rounded-full blur-[0.5px] animate-twinkle opacity-40" style={{ animationDelay: '1.2s' }} />
        <div className="absolute left-[27%] top-[7%] w-1.5 h-1.5 bg-amber-200 rounded-full blur-[0.5px] animate-twinkle opacity-70" style={{ animationDelay: '0.5s' }} />
        <div className="absolute left-[29%] top-[10%] w-1 h-1 bg-amber-100 rounded-full blur-[0.5px] animate-twinkle opacity-50" style={{ animationDelay: '1.8s' }} />
        <div className="absolute left-[81%] top-[8%] w-1.5 h-1.5 bg-amber-200 rounded-full blur-[0.5px] animate-twinkle opacity-85" style={{ animationDelay: '0.8s' }} />
        <div className="absolute left-[88%] top-[11%] w-1 h-1 bg-amber-100 rounded-full blur-[0.5px] animate-twinkle opacity-60" style={{ animationDelay: '2.1s' }} />

        {/* Forest Fireflies */}
        <div className="absolute left-[48%] top-[72%] w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[1px] animate-drift-1 pointer-events-none shadow-[0_0_8px_2px_rgba(234,179,8,0.5)]" />
        <div className="absolute left-[66%] top-[78%] w-1 h-1 bg-yellow-300 rounded-full blur-[1px] animate-drift-2 pointer-events-none shadow-[0_0_6px_2px_rgba(234,179,8,0.4)]" />
        <div className="absolute left-[38%] top-[83%] w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[1px] animate-drift-3 pointer-events-none shadow-[0_0_8px_2px_rgba(234,179,8,0.5)]" />
        <div className="absolute left-[78%] top-[82%] w-1 h-1 bg-yellow-300 rounded-full blur-[1px] animate-drift-1 pointer-events-none shadow-[0_0_6px_2px_rgba(234,179,8,0.4)]" style={{ animationDelay: '1.5s' }} />
        <div className="absolute left-[54%] top-[86%] w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[1px] animate-drift-2 pointer-events-none shadow-[0_0_8px_2px_rgba(234,179,8,0.5)]" style={{ animationDelay: '3s' }} />

        {/* --- Clickable Hotspots overlaying the visual elements --- */}

        {/* 1. "Go back home" Button */}
        <Link
          href="/"
          className="absolute left-[15%] top-[52%] w-[18.5%] h-[7.5%] rounded-2xl group cursor-pointer"
          title="Go back home"
        >
          {/* Stitched vintage border glow */}
          <span className="absolute inset-0 rounded-[12px] border border-amber-500/0 group-hover:border-amber-500/80 group-hover:bg-amber-950/20 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.55),inset_0_0_10px_rgba(245,158,11,0.3)] transition-all duration-300 scale-[1.03] backdrop-blur-[0.5px]" />
        </Link>

        {/* 2. "Home" Signpost Arrow (points right) */}
        <Link
          href="/"
          className="absolute left-[82.5%] top-[35.5%] w-[13.5%] h-[5.5%] group cursor-pointer"
          title="Home"
        >
          <span 
            className="absolute inset-0 bg-amber-500/0 border border-amber-500/0 group-hover:border-amber-500/40 group-hover:bg-amber-950/20 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-300 scale-y-105 scale-x-102"
            style={{ clipPath: 'polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%)' }}
          />
        </Link>

        {/* 3. "Explore" Signpost Arrow (points left) */}
        <Link
          href="/dashboard"
          className="absolute left-[82%] top-[44.5%] w-[13.5%] h-[6%] group cursor-pointer"
          title="Explore Dashboard"
        >
          <span 
            className="absolute inset-0 bg-amber-500/0 border border-amber-500/0 group-hover:border-amber-500/40 group-hover:bg-amber-950/20 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-300 scale-y-105 scale-x-102"
            style={{ clipPath: 'polygon(12% 0%, 100% 0%, 100% 100%, 12% 100%, 0% 50%)' }}
          />
        </Link>

        {/* 4. "Stories" Signpost Arrow (opens parchment modal) */}
        <button
          onClick={() => {
            setFableIndex(Math.floor(Math.random() * DEVELOPER_FABLES.length));
            setIsFableOpen(true);
          }}
          className="absolute left-[82.5%] top-[52.5%] w-[12%] h-[6%] group cursor-pointer text-left"
          title="Read Developer Fables"
        >
          <span 
            className="absolute inset-0 bg-amber-500/0 border border-amber-500/0 group-hover:border-amber-500/40 group-hover:bg-amber-950/20 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-300 scale-y-105 scale-x-102"
            style={{ clipPath: 'polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%)' }}
          />
        </button>

        {/* 5. "Back to Start" Signpost Arrow (points right) */}
        <Link
          href="/"
          className="absolute left-[83%] top-[60.5%] w-[13.5%] h-[7%] group cursor-pointer"
          title="Back to Start"
        >
          <span 
            className="absolute inset-0 bg-amber-500/0 border border-amber-500/0 group-hover:border-amber-500/40 group-hover:bg-amber-950/20 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all duration-300 scale-y-105 scale-x-102"
            style={{ clipPath: 'polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%)' }}
          />
        </Link>
      </div>

      {/* Mobile-Friendly Accessible Fallback Layout */}
      <div className="flex flex-col items-center max-w-sm w-full gap-6 md:hidden">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-6xl font-bold font-serif text-amber-500 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold mt-1 text-[#eedbb2] font-serif">You seem to be lost.</h2>
          <p className="text-sm text-slate-400 mt-2 px-4">
            The path you&apos;re looking for doesn&apos;t exist... or maybe it moved.
          </p>
        </div>

        {/* Visual Card containing the artwork */}
        <div className="relative w-full aspect-[1024/681] bg-[url('/images/404-bg.jpg')] bg-cover bg-center rounded-xl border-2 border-amber-900/30 shadow-lg shadow-black/60 overflow-hidden">
          {/* Pulsing light overlay for mobile */}
          <div className="absolute left-[63.5%] top-[47.5%] w-10 h-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen bg-[radial-gradient(circle,rgba(253,224,71,0.6)_0%,transparent_70%)] animate-lantern-glow" />
          <div className="absolute left-[45.2%] top-[40%] w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen bg-[radial-gradient(circle,rgba(253,224,71,0.3)_0%,transparent_75%)] animate-question-float" />
        </div>

        {/* Styled action buttons matching the aesthetic */}
        <div className="w-full flex flex-col gap-3 px-2">
          
          <Link href="/" className="w-full">
            <button className="w-full py-3 px-4 bg-gradient-to-r from-amber-800 to-amber-900 border border-amber-700 hover:from-amber-700 hover:to-amber-800 text-amber-100 rounded-xl shadow-md text-sm font-semibold flex items-center justify-center gap-2 transition-all font-serif">
              <Home className="h-4 w-4" />
              Go back home
            </button>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard" className="w-full">
              <button className="w-full py-2.5 px-3 bg-slate-900/80 border border-amber-900/40 hover:bg-slate-800/80 hover:border-amber-700/60 text-amber-200/90 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all font-serif">
                <Compass className="h-3.5 w-3.5 text-amber-500/80" />
                Explore
              </button>
            </Link>

            <button 
              onClick={() => {
                setFableIndex(Math.floor(Math.random() * DEVELOPER_FABLES.length));
                setIsFableOpen(true);
              }}
              className="w-full py-2.5 px-3 bg-slate-900/80 border border-amber-900/40 hover:bg-slate-800/80 hover:border-amber-700/60 text-amber-200/90 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all font-serif"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-500/80" />
              Stories
            </button>
          </div>
        </div>
      </div>

      {/* --- Parchment Scroll / Book Modal for Developer Fables --- */}
      {isFableOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
          <div className="relative max-w-md w-full bg-[#f6edd2] text-[#4d2d18] border-8 border-double border-[#825a2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95),_inset_0_0_40px_rgba(130,90,43,0.25)] p-6 md:p-8 flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out] font-serif">
            
            {/* Scroll Header */}
            <div className="flex justify-between items-center border-b-2 border-[#825a2b]/30 pb-3">
              <h3 className="text-xl font-bold italic tracking-wide text-[#6c431b] select-none">
                Fables of the Lost Dev
              </h3>
              <button
                onClick={() => setIsFableOpen(false)}
                className="h-8 w-8 rounded-full bg-[#825a2b]/10 text-[#825a2b] hover:bg-[#825a2b]/25 flex items-center justify-center transition-all focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Fable Content */}
            <div className="py-2 space-y-3">
              <h4 className="text-lg font-bold text-[#4d2d18] tracking-tight">
                📜 {DEVELOPER_FABLES[fableIndex].title}
              </h4>
              <p className="text-sm leading-relaxed text-[#5c3e29] italic antialiased first-letter:text-3xl first-letter:font-bold first-letter:text-[#825a2b] first-letter:mr-1 first-letter:float-left first-letter:leading-none">
                {DEVELOPER_FABLES[fableIndex].content}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-[#825a2b]/20">
              <button
                onClick={nextFable}
                className="flex-1 py-2.5 px-4 bg-[#825a2b] hover:bg-[#6c431b] text-[#f6edd2] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 focus:outline-none"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Read Another Fable
              </button>
              
              <button
                onClick={() => setIsFableOpen(false)}
                className="py-2.5 px-4 bg-transparent hover:bg-[#825a2b]/10 text-[#825a2b] border border-[#825a2b]/40 rounded-xl text-xs font-bold transition-all active:scale-95 focus:outline-none"
              >
                Return to Path
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
