import React from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck, Cpu, ClipboardList, Send, Search } from 'lucide-react';

interface NavbarProps {
  currentTab: 'submit' | 'queue' | 'track';
  setCurrentTab: (tab: 'submit' | 'queue' | 'track') => void;
  reportCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, reportCount }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('queue')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/20">
              CF
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-rose-300 to-amber-200">
                  CivicFix AI
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  NIM Vision VL
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Citizen Reporting & Prioritization Queue
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentTab('submit')}
              className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === 'submit'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Submit Report</span>
            </button>

            <button
              onClick={() => setCurrentTab('queue')}
              className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === 'queue'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Priority Queue</span>
              {typeof reportCount === 'number' && reportCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-950 text-amber-200 border border-amber-400/40">
                  {reportCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('track')}
              className={`flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                currentTab === 'track'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Track Report</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
