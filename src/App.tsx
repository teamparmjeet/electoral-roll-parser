import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
  Download,
  FileCode2,
  AlertCircle,
  RefreshCw,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { ExtractionJob, VoterRecord } from './types';
import { UploadSection } from './components/UploadSection';
import { ProcessingSection } from './components/ProcessingSection';
import { RecordsTable } from './components/RecordsTable';
import { VisualReviewModal } from './components/VisualReviewModal';
import { ExportSection } from './components/ExportSection';
import { RawTextSection } from './components/RawTextSection';
import { ErrorsSection } from './components/ErrorsSection';

type ActiveTab = 'records' | 'export' | 'raw_text' | 'errors';

export default function App() {
  const [currentJob, setCurrentJob] = useState<ExtractionJob | null>(null);
  const [records, setRecords] = useState<VoterRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<VoterRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const pollIntervalRef = useRef<any>(null);

  // Triggered when PDF is uploaded
  const handleUploaded = async (jobId: string, filename: string, totalPages: number, dpi: number) => {
    // Start extraction on the backend
    try {
      setIsProcessing(true);
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, dpi }),
      });

      if (!res.ok) {
        throw new Error('Failed to initiate extraction');
      }

      const initialStatus: ExtractionJob = {
        job_id: jobId,
        filename,
        status: 'processing',
        current_page: 0,
        total_pages: totalPages,
        cards_detected: 0,
        records_extracted: 0,
        records_processed: 0,
        needs_review_count: 0,
        verified_count: 0,
        ocr_pages_count: 0,
        errors_count: 0,
        failed_pages: [],
        errors: [],
      };

      setCurrentJob(initialStatus);
      startPolling(jobId);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/extraction/${jobId}`);
        if (!res.ok) return;

        const job: ExtractionJob = await res.json();
        setCurrentJob(job);

        // Fetch records so far in real time
        const recordsRes = await fetch(`/api/records/${jobId}`);
        if (recordsRes.ok) {
          const rData = await recordsRes.json();
          setRecords(rData.records || []);
        }

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsProcessing(false);
          // Final fetch to guarantee all records are loaded
          const finalRecordsRes = await fetch(`/api/records/${jobId}`);
          if (finalRecordsRes.ok) {
            const finalData = await finalRecordsRes.json();
            setRecords(finalData.records || []);
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleVerifyRecord = async (recordId: string) => {
    try {
      const res = await fetch(`/api/record/${recordId}/verify`, { method: 'POST' });
      if (res.ok) {
        const updated: VoterRecord = await res.json();
        handleUpdateRecord(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRecord = (updated: VoterRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedRecord && selectedRecord.id === updated.id) {
      setSelectedRecord(updated);
    }
  };

  const handleNextRecord = () => {
    if (!selectedRecord) return;
    const currentIndex = records.findIndex((r) => r.id === selectedRecord.id);
    if (currentIndex >= 0 && currentIndex < records.length - 1) {
      setSelectedRecord(records[currentIndex + 1]);
    }
  };

  const handlePreviousRecord = () => {
    if (!selectedRecord) return;
    const currentIndex = records.findIndex((r) => r.id === selectedRecord.id);
    if (currentIndex > 0) {
      setSelectedRecord(records[currentIndex - 1]);
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setCurrentJob(null);
    setRecords([]);
    setSelectedRecord(null);
    setIsProcessing(false);
    setActiveTab('records');
  };

  const selectedIndex = selectedRecord ? records.findIndex((r) => r.id === selectedRecord.id) : -1;
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < records.length - 1;

  return (
    <div id="app-root" className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              EP
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Electoral PDF Data Extractor</span>
                <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal border border-slate-200">
                  Card-Isolated OCR
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Direct PDF card boundary detection • Hindi Devanagari OCR • Real data only
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentJob && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Another PDF</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {!currentJob ? (
          /* Empty / Upload View */
          <UploadSection onUploaded={handleUploaded} isUploading={isProcessing} />
        ) : isProcessing && records.length === 0 ? (
          /* Processing Initial View */
          <ProcessingSection job={currentJob} />
        ) : (
          /* Results View with Live Tabs */
          <div className="space-y-6">
            {/* Real Stats Metric Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{currentJob.filename}</h2>
                  <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span>{currentJob.total_pages} Pages</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">
                      {isProcessing ? `Extracting (Page ${currentJob.current_page}/${currentJob.total_pages})...` : 'Extraction Complete'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Counts */}
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Records</span>
                  <span className="text-base font-bold text-slate-900">{records.length}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verified</span>
                  <span className="text-base font-bold text-emerald-600">
                    {records.filter((r) => r.verification_status === 'verified').length}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Needs Review</span>
                  <span className="text-base font-bold text-amber-600">
                    {records.filter((r) => r.needs_review).length}
                  </span>
                </div>
              </div>
            </div>

            {/* In-flight processing banner if still running */}
            {isProcessing && (
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-900">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>
                    Background extraction active: Processing page {currentJob.current_page} of {currentJob.total_pages}... Real records appear automatically.
                  </span>
                </div>
                <span className="font-semibold text-indigo-700">
                  {Math.round((currentJob.current_page / currentJob.total_pages) * 100)}%
                </span>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium text-slate-500">
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className={`pb-3 relative transition-colors flex items-center space-x-2 ${
                  activeTab === 'records' ? 'text-indigo-600 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <span>Records Table</span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">
                  {records.length}
                </span>
                {activeTab === 'records' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`pb-3 relative transition-colors flex items-center space-x-2 ${
                  activeTab === 'export' ? 'text-indigo-600 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Export Data</span>
                {activeTab === 'export' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('raw_text')}
                className={`pb-3 relative transition-colors flex items-center space-x-2 ${
                  activeTab === 'raw_text' ? 'text-indigo-600 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <FileCode2 className="w-4 h-4" />
                <span>Raw Text Dumps</span>
                {activeTab === 'raw_text' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('errors')}
                className={`pb-3 relative transition-colors flex items-center space-x-2 ${
                  activeTab === 'errors' ? 'text-indigo-600 font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Errors & Diagnostics</span>
                {currentJob.errors_count > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                    {currentJob.errors_count}
                  </span>
                )}
                {activeTab === 'errors' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'records' && (
              <RecordsTable
                records={records}
                onSelectRecord={setSelectedRecord}
                onVerifyRecord={handleVerifyRecord}
                totalPages={currentJob.total_pages}
              />
            )}

            {activeTab === 'export' && (
              <ExportSection
                jobId={currentJob.job_id}
                filename={currentJob.filename}
                records={records}
              />
            )}

            {activeTab === 'raw_text' && <RawTextSection jobId={currentJob.job_id} />}

            {activeTab === 'errors' && (
              <ErrorsSection
                job={currentJob}
                onPageRetried={() => {
                  fetch(`/api/records/${currentJob.job_id}`)
                    .then((r) => r.json())
                    .then((d) => setRecords(d.records || []));
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Visual Review / Card Image Comparison Modal */}
      {selectedRecord && (
        <VisualReviewModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onNext={handleNextRecord}
          onPrevious={handlePreviousRecord}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onUpdateRecord={handleUpdateRecord}
        />
      )}
    </div>
  );
}
