import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Code2, ShieldCheck, AlertCircle, FileCheck } from 'lucide-react';
import { VoterRecord } from '../types';

interface ExportSectionProps {
  jobId: string;
  filename: string;
  records: VoterRecord[];
}

export const ExportSection: React.FC<ExportSectionProps> = ({ jobId, filename, records }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'verified_only' | 'needs_review_only'>('all');

  const totalCount = records.length;
  const verifiedCount = records.filter((r) => r.verification_status === 'verified').length;
  const needsReviewCount = records.filter((r) => r.needs_review).length;

  const currentDownloadCount =
    filterMode === 'all' ? totalCount : filterMode === 'verified_only' ? verifiedCount : needsReviewCount;

  return (
    <div id="export-section-container" className="max-w-4xl mx-auto space-y-6">
      {/* Header & Filter Selection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Export Extracted Electoral Records</h3>
          <p className="text-xs text-slate-500">
            Export structured voter data to your preferred database or spreadsheet format.
          </p>
        </div>

        {/* Filter Selection Chips */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Records</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterMode === 'all' ? 'bg-indigo-700' : 'bg-slate-100'}`}>
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('verified_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              filterMode === 'verified_only'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Only</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterMode === 'verified_only' ? 'bg-emerald-700' : 'bg-slate-100'}`}>
              {verifiedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('needs_review_only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              filterMode === 'needs_review_only'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Needs Review Only</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterMode === 'needs_review_only' ? 'bg-amber-700' : 'bg-slate-100'}`}>
              {needsReviewCount}
            </span>
          </button>
        </div>
      </div>

      {/* Export Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Excel XLSX */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Microsoft Excel (.xlsx)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Formatted workbook with auto-adjusted columns, Hindi UTF-8 encoding, and verification summary tab.
              </p>
            </div>
          </div>
          <a
            href={`/api/export/${jobId}/xlsx?filter=${filterMode}`}
            download
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel ({currentDownloadCount} records)</span>
          </a>
        </div>

        {/* CSV */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Comma-Separated Values (.csv)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard UTF-8 CSV with BOM for immediate compatibility with Excel, Python, Pandas, and R.
              </p>
            </div>
          </div>
          <a
            href={`/api/export/${jobId}/csv?filter=${filterMode}`}
            download
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV ({currentDownloadCount} records)</span>
          </a>
        </div>

        {/* JSON */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Structured JSON (.json)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Full schema representation including bounding boxes, field-level confidence scores, and review reasons.
              </p>
            </div>
          </div>
          <a
            href={`/api/export/${jobId}/json?filter=${filterMode}`}
            download
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON ({currentDownloadCount} records)</span>
          </a>
        </div>

        {/* Aligned TXT */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Fixed-Width Plain Text (.txt)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Column-aligned plain text report formatted for terminal review, printing, or legacy database ingestion.
              </p>
            </div>
          </div>
          <a
            href={`/api/export/${jobId}/txt?filter=${filterMode}`}
            download
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download TXT ({currentDownloadCount} records)</span>
          </a>
        </div>
      </div>

      {/* Diagnostics & Audit Reports */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <FileCheck className="w-5 h-5 text-slate-500" />
          <div>
            <div className="text-xs font-semibold text-slate-900">Extraction Audit Report (extraction_report.json)</div>
            <div className="text-xs text-slate-500">
              Comprehensive telemetry: page-by-page timings, OCR fallback counts, and validation logs.
            </div>
          </div>
        </div>
        <a
          href={`/api/export/${jobId}/report`}
          download
          className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shrink-0 flex items-center space-x-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Audit Report</span>
        </a>
      </div>
    </div>
  );
};
