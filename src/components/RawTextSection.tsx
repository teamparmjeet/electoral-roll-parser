import React, { useState, useEffect } from 'react';
import { Download, FileCode, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { RawPageInfo } from '../types';

interface RawTextSectionProps {
  jobId: string;
}

export const RawTextSection: React.FC<RawTextSectionProps> = ({ jobId }) => {
  const [pages, setPages] = useState<RawPageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch(`/api/extraction/${jobId}/raw-pages`)
      .then((res) => res.json())
      .then((data) => {
        setPages(data.pages || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [jobId]);

  const filteredPages = pages.filter((p) => {
    if (!searchTerm.trim()) return true;
    return (
      String(p.page_number).includes(searchTerm) ||
      p.raw_text_snippet.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div id="raw-text-section-container" className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search within raw page text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <a
          href={`/api/export/${jobId}/raw-txt`}
          download
          className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center space-x-2 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download All Raw Text (.txt)</span>
        </a>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-400">
          Loading raw text dumps...
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-400">
          No raw text available.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPages.map((p) => (
            <div key={p.page_number} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-900">Page {p.page_number}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.is_ocr ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {p.is_ocr ? 'Tesseract OCR' : 'Native Vector Text'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Cards: <span className="font-semibold text-slate-800">{p.cards_count}</span> • Text length: {p.text_length} chars
                </div>
              </div>

              <pre className="text-xs font-mono bg-slate-50 p-3 rounded-lg text-slate-700 whitespace-pre-wrap max-h-44 overflow-y-auto border border-slate-200/60">
                {p.raw_text_snippet || <span className="text-slate-400 italic">No text content</span>}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
