import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Database
} from 'lucide-react';
import { Report } from '../types';

interface PriorityQueueProps {
  onSelectTrack: (code: string) => void;
  onRefreshTrigger?: number;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({ onSelectTrack, onRefreshTrigger }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  // Expanded duplicate cards
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Seeding state
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/reports');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: Report[] = await res.json();
      setReports(data);
    } catch (err: any) {
      console.error('Failed to load priority queue:', err);
      setError('Could not connect to priority queue backend. Ensure server is active.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [onRefreshTrigger]);

  const handleSeedReports = async () => {
    setIsSeeding(true);
    setSeedNotice(null);
    try {
      const res = await fetch('/reports/seed', { method: 'POST' });
      const data = await res.json();
      setSeedNotice(data.message || 'Seeded 247 benchmark reports successfully!');
      await fetchReports();
      setTimeout(() => setSeedNotice(null), 4000);
    } catch (err: any) {
      console.error('Failed to seed:', err);
      setError('Failed to seed benchmark dataset.');
    } finally {
      setIsSeeding(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedReportId(expandedReportId === id ? null : id);
  };

  // Severity pill
  const getSeverityStyle = (score: number) => {
    if (score >= 9) {
      return {
        bg: 'bg-rose-600',
        text: 'text-white',
        border: 'border-rose-700',
        label: 'CRITICAL',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    if (score >= 7) {
      return {
        bg: 'bg-orange-600',
        text: 'text-white',
        border: 'border-orange-700',
        label: 'HIGH',
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200'
      };
    }
    if (score >= 4) {
      return {
        bg: 'bg-amber-600',
        text: 'text-white',
        border: 'border-amber-700',
        label: 'MEDIUM',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    return {
      bg: 'bg-emerald-600',
      text: 'text-white',
      border: 'border-emerald-700',
      label: 'LOW',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  };

  // Unique categories for filter
  const categories = Array.from(new Set(reports.map((r) => r.category).filter(Boolean)));

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.tracking_code && r.tracking_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.transcript && r.transcript.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
    const matchesDuplicates = !onlyDuplicates || (r.duplicate_count && r.duplicate_count > 0);
    const matchesFlagged = !onlyFlagged || r.confidence_score < 0.6;

    return matchesSearch && matchesCategory && matchesDuplicates && matchesFlagged;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Exact required Responsible AI notice banner at top */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm text-xs sm:text-sm text-amber-950 font-medium flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          CivicFix AI provides prioritization support. It does not make final decisions, profile individuals, or act autonomously. Low confidence results are flagged for human review.
        </p>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Priority Repair Queue
            </h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white rounded-full">
              {filteredReports.length} {filteredReports.length === 1 ? 'Issue' : 'Issues'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Ranked by AI severity score (1–10). Duplicates grouped to indicate municipal repair urgency.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>

          <button
            onClick={handleSeedReports}
            disabled={isSeeding}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSeeding ? 'Seeding...' : 'Load 247 Demo Reports'}</span>
          </button>
        </div>
      </div>

      {seedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold p-3 rounded-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{seedNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by location, keyword, or tracking code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Categories ({reports.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Checkbox toggles */}
        <div className="flex items-center space-x-4 text-xs font-medium text-slate-700 pt-1 md:pt-0">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyDuplicates}
              onChange={(e) => setOnlyDuplicates(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <span>Duplicates Merged</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <span>Flagged for Review</span>
          </label>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">Loading priority queue...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchReports}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <p className="text-base font-semibold text-slate-700">No reports matched your filters.</p>
          <p className="text-xs mt-1">Try resetting search keywords or category filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report, index) => {
            const sev = getSeverityStyle(report.severity_score);
            const isLowConfidence = report.confidence_score < 0.6;
            const duplicateCount = report.duplicate_count || (report.duplicates?.length ?? 0);
            const isExpanded = expandedReportId === report.id;

            return (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Main Report Row */}
                <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Severity Badge & Rank */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="w-7 text-center font-mono font-bold text-xs text-slate-400">
                      #{index + 1}
                    </div>

                    <div
                      className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center font-black ${sev.bg} ${sev.text} shadow-md`}
                    >
                      <span className="text-2xl leading-none">{report.severity_score}</span>
                      <span className="text-[9px] font-bold tracking-wider mt-0.5 opacity-90">
                        {sev.label}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {report.category}
                      </span>

                      {/* Low Confidence Flag (< 0.6) - Mandatory Requirement */}
                      {isLowConfidence && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-700" />
                          Flagged for Human Review
                        </span>
                      )}

                      {/* Duplicate Count Badge */}
                      {duplicateCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                          <Layers className="w-3 h-3 mr-1 text-blue-700" />
                          +{duplicateCount} duplicate {duplicateCount === 1 ? 'report' : 'reports'} merged
                        </span>
                      )}

                      <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {report.tracking_code}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center text-xs text-slate-600 space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">{report.location}</span>
                    </div>

                    {/* Transcript or Description excerpt */}
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {report.transcript || report.text_description || 'Visual evidence submitted.'}
                    </p>

                    {/* Model Metadata footer */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span>
                        Confidence: <strong className="text-slate-700">{Math.round(report.confidence_score * 100)}%</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Status: <strong className="capitalize text-slate-700">{report.status}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {report.model_name} ({report.latency_ms}ms)
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions & Photo preview */}
                  <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                    {report.photo_url && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img
                          src={report.photo_url}
                          alt="Evidence thumbnail"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="flex flex-col space-y-1.5">
                      <button
                        onClick={() => onSelectTrack(report.tracking_code)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
                      >
                        <span>Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      {duplicateCount > 0 && (
                        <button
                          onClick={() => toggleExpand(report.id)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition flex items-center justify-between space-x-1"
                        >
                          <span>{isExpanded ? 'Hide' : 'Duplicates'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Nested Duplicates Drawer */}
                {isExpanded && report.duplicates && report.duplicates.length > 0 && (
                  <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <span>Merged Duplicate Citizen Reports ({report.duplicates.length})</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        Grouped under primary report #{report.tracking_code}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.duplicates.map((dup) => (
                        <div
                          key={dup.id}
                          className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {dup.tracking_code}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(dup.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {dup.transcript || dup.text_description}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Reporter: {dup.reporter_name}</span>
                            <button
                              onClick={() => onSelectTrack(dup.tracking_code)}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              Track
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mandatory exact Responsible AI text line at bottom as well */}
      <div className="text-center pt-8 pb-4 text-xs text-slate-500 border-t border-slate-200">
        <p className="font-medium">
          CivicFix AI provides prioritization support. It does not make final decisions, profile individuals, or act autonomously. Low confidence results are flagged for human review.
        </p>
      </div>
    </div>
  );
};
