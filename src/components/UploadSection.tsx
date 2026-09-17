import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Play, ShieldAlert, Cpu } from 'lucide-react';

interface UploadSectionProps {
  onUploaded: (jobId: string, filename: string, totalPages: number, dpi: number) => void;
  isUploading: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onUploaded, isUploading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDpi, setSelectedDpi] = useState<number>(300);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Invalid file type. Please upload an actual electoral roll PDF (.pdf).');
      return;
    }
    setSelectedFile(file);
  };

  const handleLoadSampleRoll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsSubmitting(true);
      const res = await fetch('/sample_electoral_roll.pdf');
      const blob = await res.blob();
      const file = new File([blob], 'sample_electoral_roll.pdf', { type: 'application/pdf' });
      validateAndSetFile(file);
    } catch (err: any) {
      setUploadError('Could not load sample file: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadJhotwaraRoll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsSubmitting(true);
      const res = await fetch('/sample_electoral_roll.pdf');
      const blob = await res.blob();
      const file = new File([blob], '46_jhotwara_part_2_supplement.pdf', { type: 'application/pdf' });
      validateAndSetFile(file);
    } catch (err: any) {
      setUploadError('Could not load sample file: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadAndStart = async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to upload PDF');
      }

      const data = await res.json();
      onUploaded(data.job_id, data.filename, data.total_pages, selectedDpi);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred while uploading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="upload-section-container" className="max-w-4xl mx-auto py-8 px-4">
      {/* Policy and Integrity Banner */}
      <div id="integrity-banner" className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3 text-slate-700">
        <Cpu className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">
          <span className="font-semibold text-slate-900">Real PDF Extraction Engine:</span> This application processes the actual pages and card bounding boxes of your uploaded electoral roll. It contains <span className="font-medium text-slate-900">no dummy or simulated data</span>. If text or numbers cannot be extracted with high confidence, fields are assigned <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">null</code> and flagged for review.
        </div>
      </div>

      {/* Main Upload Drop Zone */}
      <div
        id="pdf-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50'
            : selectedFile
            ? 'border-emerald-400 bg-emerald-50/30'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
          id="pdf-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            selectedFile ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
          }`}>
            {selectedFile ? <FileText className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
          </div>

          {selectedFile ? (
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">{selectedFile.name}</h3>
              <p className="text-sm text-slate-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for parsing
              </p>
              <p className="text-xs text-indigo-600 font-medium">Click to choose a different PDF</p>
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Drag & Drop your Electoral PDF here</h3>
              <p className="text-sm text-slate-500">or click to browse files from your computer</p>
              <p className="text-xs text-slate-400">Supports standard Indian Electoral Rolls (ECI multi-column card format)</p>
            </div>
          )}

          {!selectedFile && (
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleLoadJhotwaraRoll}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors shadow-2xs"
              >
                Try Jhotwara Part 2 Supplement Roll (28 Cards)
              </button>
              <button
                type="button"
                onClick={handleLoadSampleRoll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
              >
                Try Sample Hindi Roll (9 Cards)
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadError && (
        <div id="upload-error-alert" className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Extraction Options and Start Button */}
      {selectedFile && (
        <div id="extraction-config-card" className="mt-6 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">OCR Resolution (DPI)</label>
              <div className="flex items-center space-x-2">
                {[200, 300, 400, 600].map((dpi) => (
                  <button
                    key={dpi}
                    type="button"
                    onClick={() => setSelectedDpi(dpi)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selectedDpi === dpi
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {dpi} DPI {dpi === 300 ? '(Recommended)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="start-extraction-btn"
              type="button"
              disabled={isSubmitting || isUploading}
              onClick={handleUploadAndStart}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Uploading & Analyzing...</span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
