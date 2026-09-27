import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SubmitReport } from './components/SubmitReport';
import { PriorityQueue } from './components/PriorityQueue';
import { TrackReport } from './components/TrackReport';
import { Report } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'submit' | 'queue' | 'track'>('queue');
  const [trackingCodeToView, setTrackingCodeToView] = useState<string>('');
  const [refreshQueueCounter, setRefreshQueueCounter] = useState(0);
  const [totalReportsCount, setTotalReportsCount] = useState<number>(0);

  // Fetch report count periodically or on tab change
  const refreshCount = async () => {
    try {
      const res = await fetch('/reports');
      if (res.ok) {
        const data: Report[] = await res.json();
        setTotalReportsCount(data.length);
      }
    } catch {
      // Ignore count fetch errors
    }
  };

  useEffect(() => {
    refreshCount();
  }, [currentTab, refreshQueueCounter]);

  const handleReportSubmitted = (newReport: Report) => {
    setRefreshQueueCounter((prev) => prev + 1);
    refreshCount();
  };

  const handleNavigateToTrack = (code: string) => {
    setTrackingCodeToView(code);
    setCurrentTab('track');
  };

  const handleNavigateToQueue = () => {
    setCurrentTab('queue');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-rose-500 selection:text-white">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        reportCount={totalReportsCount}
      />

      <main className="flex-1">
        {currentTab === 'submit' && (
          <SubmitReport
            onSuccess={handleReportSubmitted}
            onNavigateTrack={handleNavigateToTrack}
            onNavigateQueue={handleNavigateToQueue}
          />
        )}

        {currentTab === 'queue' && (
          <PriorityQueue
            onSelectTrack={handleNavigateToTrack}
            onRefreshTrigger={refreshQueueCounter}
          />
        )}

        {currentTab === 'track' && (
          <TrackReport
            initialCode={trackingCodeToView}
            onNavigateTrack={handleNavigateToTrack}
          />
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">CivicFix AI</span>
            <span>—</span>
            <span>NVIDIA NIM Vision Language Infrastructure Prioritization</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentTab('queue')}
              className="hover:text-slate-200 transition"
            >
              Priority Queue
            </button>
            <button
              onClick={() => setCurrentTab('submit')}
              className="hover:text-slate-200 transition"
            >
              Submit Issue
            </button>
            <button
              onClick={() => setCurrentTab('track')}
              className="hover:text-slate-200 transition"
            >
              Track Code
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
