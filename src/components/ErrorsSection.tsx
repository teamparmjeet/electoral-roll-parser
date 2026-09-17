import React, { useState } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ExtractionJob } from '../types';

interface ErrorsSectionProps {
  job: ExtractionJob;
  onPageRetried: () => void;
}

export const ErrorsSection: React.FC<ErrorsSectionProps> = ({ job, onPageRetried }) => {
  const [retryingPage, setRetryingPage] = useState<number | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const handleRetry = async (pageNumber: number) => {
    setRetryingPage(pageNumber);
    setRetryMessage(null);
    try {
      const res = await fetch(`/api/page/${pageNumber}/retry?job_id=${job.job_id}`, {
        method: 'POST',
      });
      if (res.ok) {
        setRetryMessage(`Page ${pageNumber} reprocessed successfully.`);
        onPageRetried();
      } else {
        const err = await res.json();
        setRetryMessage(`Failed to retry page ${pageNumber}: ${err.detail || 'Unknown error'}`);
      }
    } catch (e: any) {
      setRetryMessage(`Error: ${e.message}`);
    } finally {
      setRetryingPage(null);
    }
  };

  const hasErrors = (job.failed_pages && job.failed_pages.length > 0) || (job.errors && job.errors.length > 0);

  return (
    <div id="errors-section-container" className="max-w-4xl mx-auto space-y-4">
      {retryMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
          <span>{retryMessage}</span>
          <button onClick={() => setRetryMessage(null)} className="text-indigo-500 hover:text-indigo-800">
            Dismiss
          </button>
        </div>
      )}

      {!hasErrors ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">Zero Extraction Errors</h4>
          <p className="text-xs text-slate-500">
            All pages in this electoral roll document processed smoothly with no isolated page failures.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Failed Pages card */}
          {job.failed_pages && job.failed_pages.length > 0 && (
            <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <AlertCircle className="w-4 h-4" />
                <h4 className="text-sm font-semibold">Failed Pages ({job.failed_pages.length})</h4>
              </div>
              <p className="text-xs text-slate-600">
                The extraction pipeline isolates failures so the rest of the document succeeds. You can retry individual pages below:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {job.failed_pages.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handleRetry(pageNum)}
                    disabled={retryingPage === pageNum}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${retryingPage === pageNum ? 'animate-spin' : ''}`} />
                    <span>Retry Page {pageNum}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error entries */}
          {job.errors && job.errors.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Diagnostic Trace ({job.errors.length})
              </h4>
              <div className="space-y-2">
                {job.errors.map((err, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                      <span>Page {err.page}</span>
                      <span>{err.timestamp}</span>
                    </div>
                    <div className="text-rose-600 break-words">{err.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
