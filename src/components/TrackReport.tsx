import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Phone,
  User,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  FileText
} from 'lucide-react';
import { Report } from '../types';

interface TrackReportProps {
  initialCode?: string;
  onNavigateTrack?: (code: string) => void;
}

export const TrackReport: React.FC<TrackReportProps> = ({ initialCode }) => {
  const [trackingCodeInput, setTrackingCodeInput] = useState(initialCode || '');
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLookup = async (codeToSearch?: string) => {
    const code = (codeToSearch || trackingCodeInput).trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a tracking code (e.g. CFX-2026-0001)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setReport(null);

    try {
      const res = await fetch(`/reports/track/${encodeURIComponent(code)}`);
      if (res.status === 404) {
        setErrorMessage(`No civic report was found with tracking code "${code}". Please check for typos.`);
        return;
      }
      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }
      const data: Report = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error('Error looking up report:', err);
      setErrorMessage(err.message || 'Failed to look up report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setTrackingCodeInput(initialCode);
      handleLookup(initialCode);
    }
  }, [initialCode]);

  // Severity color style
  const getSeverityStyle = (score: number) => {
    if (score >= 9) return { bg: 'bg-rose-600', label: 'CRITICAL', border: 'border-rose-500' };
    if (score >= 7) return { bg: 'bg-orange-600', label: 'HIGH', border: 'border-orange-500' };
    if (score >= 4) return { bg: 'bg-amber-600', label: 'MEDIUM', border: 'border-amber-500' };
    return { bg: 'bg-emerald-600', label: 'LOW', border: 'border-emerald-500' };
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return { label: 'In Progress (Crew Dispatched)', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'triaged':
        return { label: 'Triaged by AI & Queued', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'resolved':
        return { label: 'Repairs Completed', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      default:
        return { label: 'Reported & AI Verified', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Track Your Report
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your unique tracking code to view real-time triage status, AI severity assessment, and duplicate matches.
        </p>
      </div>

      {/* Look Up Form */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Enter Tracking Code, e.g. CFX-2026-0001"
              value={trackingCodeInput}
              onChange={(e) => setTrackingCodeInput(e.target.value.toUpperCase())}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !trackingCodeInput.trim()}
            className="py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <span>Looking up...</span>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Look Up</span>
              </>
            )}
          </button>
        </form>

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-500 font-medium">Quick demo codes:</span>
          {['CFX-2026-0001', 'CFX-2026-0002', 'CFX-2026-0009', 'CFX-2026-0015', 'CFX-2026-0020'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setTrackingCodeInput(code);
                handleLookup(code);
              }}
              className="px-2 py-0.5 font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition"
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Error / Not Found Message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-800 text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Report Result Display */}
      {report && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in space-y-6 p-6 sm:p-8">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Civic Report File
              </span>
              <h2 className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                {report.tracking_code}
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full border ${
                  getStatusBadge(report.status).bg
                }`}
              >
                {getStatusBadge(report.status).label}
              </span>
            </div>
          </div>

          {/* Key Metrics: Category, Severity, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Category</span>
              <span className="text-base font-bold text-slate-900 mt-1 block">
                {report.category}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Severity Score</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {report.severity_score}
                </span>
                <span className="text-slate-400 text-sm">/ 10</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                    getSeverityStyle(report.severity_score).bg
                  }`}
                >
                  {getSeverityStyle(report.severity_score).label}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">AI Confidence</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {Math.round(report.confidence_score * 100)}%
                </span>
                {report.confidence_score < 0.6 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Review Flag
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Duplicate Match Status */}
          {report.duplicate_of ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>Duplicate Match Found</span>
              </div>
              <p className="text-xs text-blue-800">
                This report matches an earlier report filed for the same infrastructure issue at this location. It has been combined to increase priority in the municipal repair queue.
              </p>
              {report.matched_parent && (
                <div className="mt-2 bg-white/80 p-2.5 rounded-lg border border-blue-200 text-xs text-blue-950 flex items-center justify-between">
                  <span>
                    Primary Report: <strong>{report.matched_parent.tracking_code}</strong> ({report.matched_parent.category})
                  </span>
                  <button
                    onClick={() => {
                      setTrackingCodeInput(report.matched_parent!.tracking_code);
                      handleLookup(report.matched_parent!.tracking_code);
                    }}
                    className="text-blue-700 hover:underline font-semibold flex items-center space-x-1"
                  >
                    <span>View Primary</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Original primary report. {report.duplicate_reports && report.duplicate_reports.length > 0
                  ? `${report.duplicate_reports.length} other citizen reports merged into this item.`
                  : 'No duplicate reports filed yet.'}
              </span>
            </div>
          )}

          {/* Location & Details */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start space-x-2 text-sm text-slate-800">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Location:</span> {report.location}
              </div>
            </div>

            {/* Transcript or Description */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Report Evidence & Citizen Transcript</span>
              </span>
              <p className="text-sm text-slate-800 leading-relaxed">
                {report.transcript || report.text_description || 'No audio transcript provided.'}
              </p>
            </div>

            {/* Photo / Frame visual evidence */}
            {report.photo_url && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Visual Evidence
                </span>
                <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video max-h-64 bg-slate-900 flex items-center justify-center">
                  <img
                    src={report.photo_url}
                    alt="Problem evidence"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Metadata */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>Reported on: {new Date(report.created_at).toLocaleString()}</span>
            <span className="font-mono">
              Evaluated by: {report.model_name} ({report.latency_ms}ms)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
