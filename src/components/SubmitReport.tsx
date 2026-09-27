import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Video,
  Mic,
  MicOff,
  Upload,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  MapPin,
  Phone,
  User,
  FileText,
  Volume2,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Report } from '../types';

interface SubmitReportProps {
  onSuccess: (report: Report) => void;
  onNavigateTrack: (code: string) => void;
  onNavigateQueue: () => void;
}

export const SubmitReport: React.FC<SubmitReportProps> = ({
  onSuccess,
  onNavigateTrack,
  onNavigateQueue,
}) => {
  // Form fields
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [location, setLocation] = useState('');
  const [textDescription, setTextDescription] = useState('');

  // Media files
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // File input refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [photoPreview, videoPreview, audioUrl]);

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Handle Video selection
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Handle Audio File fallback selection
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  // Start in-browser Voice Recording
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioFile(new File([blob], `voice-note-${Date.now()}.webm`, { type: mimeType }));
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setErrorMessage(
        'Could not access microphone. Please allow microphone permissions or use the file upload fallback below.'
      );
    }
  };

  // Stop in-browser Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const removeAudio = () => {
    if (isRecording) stopRecording();
    setAudioBlob(null);
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  // Quick Preset Helper for Fast Demoing
  const applyPreset = (presetType: 'sinkhole' | 'pothole' | 'water' | 'electric') => {
    if (presetType === 'sinkhole') {
      setReporterName('Marcus Vance');
      setReporterPhone('555-412-8821');
      setLocation('5th Ave & Market St, Downtown');
      setTextDescription(
        'Enormous sinkhole opened right next to the crosswalk. Pavement has collapsed 3 feet deep. Multiple cars swerving into oncoming lane.'
      );
    } else if (presetType === 'pothole') {
      setReporterName('Sarah Jenkins');
      setReporterPhone('555-829-4100');
      setLocation('Pine Valley Blvd & 4th Ave, Westside');
      setTextDescription(
        'Deep rim pothole in right travel lane. Severe impact on passing vehicles and exposed sub-base gravel.'
      );
    } else if (presetType === 'water') {
      setReporterName('David Chen');
      setReporterPhone('555-901-2244');
      setLocation('Oak St & 12th Ave, Midtown');
      setTextDescription(
        'Water main fractured underneath sidewalk, high pressure flood submerging pedestrian curb ramp and building entry.'
      );
    } else if (presetType === 'electric') {
      setReporterName('Amara Okafor');
      setReporterPhone('555-321-7788');
      setLocation('Elm Rd & 8th St, North Park');
      setTextDescription(
        'Live electrical power line snapped and arcing against metal chainlink fence. Sparks emitting continually.'
      );
    }
  };

  // Client-side Validation:
  // Requires: reporterName, reporterPhone, location
  // AND at least one evidence item: photo, video, voice note, or text description
  const hasEvidence = Boolean(
    photoFile || videoFile || audioBlob || (textDescription && textDescription.trim().length > 0)
  );
  const isFormValid = Boolean(
    reporterName.trim() && reporterPhone.trim() && location.trim() && hasEvidence
  );

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reporterName.trim()) {
      setErrorMessage('Reporter name is required.');
      return;
    }
    if (!reporterPhone.trim()) {
      setErrorMessage('Reporter phone number is required.');
      return;
    }
    if (!location.trim()) {
      setErrorMessage('Location is required.');
      return;
    }
    if (!hasEvidence) {
      setErrorMessage(
        'Evidence is required: please provide a photo, video, voice note, or written description so the vision-language AI model can analyze the issue.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('reporter_name', reporterName.trim());
      formData.append('reporter_phone', reporterPhone.trim());
      formData.append('location', location.trim());

      if (textDescription.trim()) {
        formData.append('text_description', textDescription.trim());
      }
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      if (videoFile) {
        formData.append('video', videoFile);
      }
      if (audioFile) {
        formData.append('voice_note', audioFile);
      } else if (audioBlob) {
        formData.append('voice_note', audioBlob, 'recording.webm');
      }

      const res = await fetch('/reports', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error status ${res.status}`);
      }

      const data: Report = await res.json();
      setSubmittedReport(data);
      onSuccess(data);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'Failed to submit report. Please check server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingCode = () => {
    if (submittedReport?.tracking_code) {
      navigator.clipboard.writeText(submittedReport.tracking_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const resetForm = () => {
    setSubmittedReport(null);
    setReporterName('');
    setReporterPhone('');
    setLocation('');
    setTextDescription('');
    removePhoto();
    removeVideo();
    removeAudio();
    setErrorMessage(null);
  };

  // Severity color indicator
  const getSeverityBadge = (score: number) => {
    if (score >= 9) return { label: 'CRITICAL', color: 'bg-rose-600 text-white border-rose-500' };
    if (score >= 7) return { label: 'HIGH', color: 'bg-orange-600 text-white border-orange-500' };
    if (score >= 4) return { label: 'MEDIUM', color: 'bg-amber-600 text-white border-amber-500' };
    return { label: 'LOW', color: 'bg-emerald-600 text-white border-emerald-500' };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Screen Title */}
      <div className="mb-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Citizen Infrastructure Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit photo, voice, or text evidence. NVIDIA Llama 3.1 Nemotron Vision-Language AI will triage and calculate severity.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            type="button"
            onClick={() => applyPreset('sinkhole')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded border border-slate-300 transition"
            title="Auto-fill with duplicate sinkhole test data"
          >
            Duplicate Test (5th & Market)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('water')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded border border-slate-300 transition"
            title="Auto-fill with water main leak"
          >
            Water Leak Preset
          </button>
        </div>
      </div>

      {/* Success Result View */}
      {submittedReport ? (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-emerald-200 shrink-0" />
              <div>
                <h2 className="text-xl font-bold">Report Submitted & Triaged Successfully!</h2>
                <p className="text-emerald-100 text-sm">
                  Evaluated by NVIDIA Llama-3.1 Nemotron Nano VL (8B)
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Tracking Code Banner */}
            <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Your Citizen Tracking Code
              </p>
              <div className="mt-2 flex items-center justify-center space-x-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-wider font-mono">
                  {submittedReport.tracking_code}
                </span>
                <button
                  type="button"
                  onClick={copyTrackingCode}
                  className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 shadow-sm transition"
                  title="Copy Tracking Code"
                >
                  {copiedCode ? (
                    <span className="text-xs font-bold text-emerald-600">Copied!</span>
                  ) : (
                    <Copy className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-900 font-medium max-w-md mx-auto">
                Save this tracking code to check your report later. No account, login, or password required.
              </p>
            </div>

            {/* AI Evaluation Metrics Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium block">Category</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  {submittedReport.category}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium block">Severity Score</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">
                    {submittedReport.severity_score}
                  </span>
                  <span className="text-slate-400 text-sm">/ 10</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      getSeverityBadge(submittedReport.severity_score).color
                    }`}
                  >
                    {getSeverityBadge(submittedReport.severity_score).label}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium block">Confidence Score</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">
                    {Math.round(submittedReport.confidence_score * 100)}%
                  </span>
                  {submittedReport.confidence_score < 0.6 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      Review Flag
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Duplicate Notice */}
            {submittedReport.duplicate_of ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
                <Layers className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">Duplicate Report Detected</p>
                  <p className="text-blue-800 mt-0.5">
                    This report matches an existing report for this location and has been automatically merged into the municipal priority queue.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Unique report registered. No duplicate issues detected at this location.</span>
              </div>
            )}

            {/* Recommended Action / Details */}
            {submittedReport.recommended_action && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Model Recommended Action
                </span>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {submittedReport.recommended_action}
                </p>
              </div>
            )}

            {/* Inference Metadata */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
              <span className="font-mono">
                Model: {submittedReport.model_name} | GPU: {submittedReport.gpu_type}
              </span>
              <span>Inference Latency: {submittedReport.latency_ms} ms</span>
            </div>

            {/* Next Steps Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onNavigateTrack(submittedReport.tracking_code)}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-center text-sm shadow-md transition flex items-center justify-center space-x-2"
              >
                <span>Track Report Status</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNavigateQueue}
                className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-center text-sm shadow-md transition flex items-center justify-center space-x-2"
              >
                <span>View in Priority Queue</span>
                <Layers className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-center text-sm transition"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Error Message Alert */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-800 text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Submission Incomplete</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Reporter Contact Information (Required) */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center space-x-2">
                <User className="w-4 h-4 text-slate-500" />
                <span>Reporter Identification</span>
                <span className="text-xs font-normal text-slate-500">(Required, no login needed)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jordan Miller"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 555-234-5678"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location (Required) */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Incident Location <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 5th Ave & Market St, Downtown or near 1420 Pine St"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 self-center">Quick pick:</span>
                {[
                  '5th Ave & Market St, Downtown',
                  'Oak St & 12th Ave, Midtown',
                  'Broadway & Grand Ave, Central Square',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLocation(preset)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Evidence Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>Problem Evidence</span>
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    hasEvidence
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {hasEvidence ? 'Evidence attached' : 'At least one evidence item required'}
                </span>
              </div>

              {/* Photo & Video Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Photo Upload */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-50/80 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                      <Camera className="w-4 h-4 text-slate-600" />
                      <span>Photo Evidence</span>
                    </span>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {photoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video bg-black flex items-center justify-center">
                      <img
                        src={photoPreview}
                        alt="Evidence Preview"
                        className="object-contain w-full h-full"
                      />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-6 cursor-pointer bg-white transition">
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Choose photo or take picture</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP</span>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Video Upload */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-50/80 transition">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                      <Video className="w-4 h-4 text-slate-600" />
                      <span>Video Evidence</span>
                    </span>
                    {videoFile && (
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {videoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video bg-black flex items-center justify-center">
                      <video
                        src={videoPreview}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-6 cursor-pointer bg-white transition">
                      <Video className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Choose video clip</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        MP4, MOV, WEBM (frame extracted if no photo)
                      </span>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                  {videoFile && photoFile && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Note: Photo is also provided; photo will take priority for vision analysis.
                    </p>
                  )}
                </div>
              </div>

              {/* Voice Recording Widget */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Mic className="w-4 h-4 text-slate-600" />
                    <span>Voice Note Recording</span>
                  </span>
                  {(audioBlob || audioUrl) && (
                    <button
                      type="button"
                      onClick={removeAudio}
                      className="text-xs text-rose-600 hover:text-rose-800 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Voice Note</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-lg border border-slate-200">
                  {/* Record button or status */}
                  {isRecording ? (
                    <div className="flex items-center space-x-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium text-xs transition animate-pulse"
                      >
                        <MicOff className="w-4 h-4" />
                        <span>Stop Recording ({recordingSeconds}s)</span>
                      </button>
                      <span className="inline-block w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-xs transition"
                    >
                      <Mic className="w-4 h-4 text-rose-400" />
                      <span>Record Voice Note</span>
                    </button>
                  )}

                  {/* Audio player preview if recorded */}
                  {audioUrl && !isRecording && (
                    <div className="flex-1 w-full flex items-center space-x-2">
                      <audio controls src={audioUrl} className="w-full h-8" />
                    </div>
                  )}

                  {/* Fallback audio file upload */}
                  {!audioUrl && !isRecording && (
                    <div className="sm:border-l sm:border-slate-200 sm:pl-4 w-full sm:w-auto flex items-center">
                      <label className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 underline">
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>Or upload audio file (.mp3, .wav, .m4a)</span>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Written Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Written Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue, hazards, estimated size, or how long it has been present..."
                  value={textDescription}
                  onChange={(e) => setTextDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Validation warning if evidence missing */}
            {!hasEvidence && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Please provide at least one piece of evidence (photo, video, voice note, or written description) before analyzing.
                </span>
              </div>
            )}

            {/* Submit / Analyze Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`w-full py-4 px-6 rounded-xl font-bold text-base shadow-lg transition flex items-center justify-center space-x-2 ${
                  isFormValid && !isSubmitting
                    ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white cursor-pointer shadow-rose-600/25'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Analyzing with Llama-3.1 Nemotron Vision-Language Model...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-200" />
                    <span>Analyze & Prioritize Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
