import React from 'react';
import { Loader2, Layers, Users, AlertTriangle, FileCode2, CheckCircle2 } from 'lucide-react';
import { ExtractionJob } from '../types';

interface ProcessingSectionProps {
  job: ExtractionJob;
}

export const ProcessingSection: React.FC<ProcessingSectionProps> = ({ job }) => {
  const percent = job.total_pages > 0 ? Math.min(100, Math.round((job.current_page / job.total_pages) * 100)) : 0;

  return (
    <div id="processing-section-container" className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Processing Electoral Roll PDF</h2>
              <p className="text-xs text-slate-500">{job.filename}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-slate-900">{job.current_page}</span>
            <span className="text-sm font-medium text-slate-400"> / {job.total_pages} Pages</span>
          </div>
        </div>

        {/* Real Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Extraction Progress</span>
            <span>{percent}% Completed</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Real-time Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Cards Detected</span>
            </div>
            <div className="text-xl font-bold text-slate-900">{job.cards_detected.toLocaleString()}</div>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Records Extracted</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">{job.records_extracted.toLocaleString()}</div>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Needs Review</span>
            </div>
            <div className="text-xl font-bold text-amber-600">{job.needs_review_count.toLocaleString()}</div>
          </div>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
              <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>OCR Pages</span>
            </div>
            <div className="text-xl font-bold text-indigo-600">{job.ocr_pages_count}</div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-2">
          Analyzing visual card boundaries, isolating card regions, and applying Hindi Devanagari OCR...
        </div>
      </div>
    </div>
  );
};
