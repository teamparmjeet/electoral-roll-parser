import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Flag, RefreshCw, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { VoterRecord } from '../types';

interface VisualReviewModalProps {
  record: VoterRecord;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onUpdateRecord: (updated: VoterRecord) => void;
}

export const VisualReviewModal: React.FC<VisualReviewModalProps> = ({
  record,
  onClose,
  onNext,
  onPrevious,
  hasPrevious,
  hasNext,
  onUpdateRecord,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'page'>('card');

  // Form state for editing
  const [formData, setFormData] = useState({
    serial_number: record.serial_number ?? '',
    voter_id: record.voter_id ?? '',
    elector_name: record.elector_name ?? '',
    relation_type: record.relation_type ?? 'father',
    relation_name: record.relation_name ?? '',
    house_number: record.house_number ?? '',
    age: record.age ?? '',
    gender: record.gender ?? 'male',
    gender_original: record.gender_original ?? '',
  });

  useEffect(() => {
    setFormData({
      serial_number: record.serial_number ?? '',
      voter_id: record.voter_id ?? '',
      elector_name: record.elector_name ?? '',
      relation_type: record.relation_type ?? 'father',
      relation_name: record.relation_name ?? '',
      house_number: record.house_number ?? '',
      age: record.age ?? '',
      gender: record.gender ?? 'male',
      gender_original: record.gender_original ?? '',
    });
    setIsEditing(false);
  }, [record.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!isEditing) {
        if (e.key === 'ArrowRight' && hasNext) onNext();
        if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, isEditing, onClose, onNext, onPrevious]);

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/record/${record.id}/verify`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        onUpdateRecord(updated);
        if (hasNext) onNext();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFlagReview = async () => {
    try {
      const res = await fetch(`/api/record/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_status: 'needs_review',
          needs_review: true,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdateRecord(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const res = await fetch(`/api/record/${record.id}/reprocess`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        onUpdateRecord(updated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        serial_number: formData.serial_number ? parseInt(String(formData.serial_number)) : null,
        voter_id: formData.voter_id ? String(formData.voter_id).trim() : null,
        elector_name: formData.elector_name ? String(formData.elector_name).trim() : null,
        relation_type: formData.relation_type || null,
        relation_name: formData.relation_name ? String(formData.relation_name).trim() : null,
        house_number: formData.house_number ? String(formData.house_number).trim() : null,
        age: formData.age ? parseInt(String(formData.age)) : null,
        gender: formData.gender || null,
        gender_original: formData.gender === 'male' ? 'पुरुष' : formData.gender === 'female' ? 'महिला' : 'तृतीय लिंग',
        verification_status: 'verified',
        needs_review: false,
      };

      const res = await fetch(`/api/record/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdateRecord(updated);
        setIsEditing(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const cardImageUrl = `/api/record/${record.id}/image`;
  const pageImageUrl = `/api/page-image/${record.document_id}/${record.source_page}`;

  return (
    <div id="visual-review-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold text-slate-900">Card Verification</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
              Page {record.source_page} • Card #{record.card_index}
            </span>
            {record.needs_review && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>Needs Review</span>
              </span>
            )}
            {record.verification_status === 'verified' && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Verified</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              title="Previous Card (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
              title="Next Card (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Split Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT SIDE: Original PDF Card Image */}
          <div className="flex-1 border-r border-slate-200 flex flex-col bg-slate-100 overflow-hidden">
            {/* Image Toolbar */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    viewMode === 'card' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cropped Card
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('page')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    viewMode === 'page' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Full Page View
                </button>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs px-1 text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Image Viewport */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
              {viewMode === 'card' ? (
                <div
                  className="bg-white rounded-lg shadow-md border border-slate-300 p-2 transition-transform duration-150"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={cardImageUrl}
                    alt={`Real PDF card ${record.card_index}`}
                    className="max-h-[50vh] object-contain rounded select-none"
                  />
                  <div className="mt-2 text-center text-xs text-slate-400 font-mono">
                    Direct crop from Page {record.source_page} (x: {record.source_bbox?.x}, y: {record.source_bbox?.y})
                  </div>
                </div>
              ) : (
                <div
                  className="relative bg-white shadow-md border border-slate-300 p-2 transition-transform duration-150"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={pageImageUrl}
                    alt={`Page ${record.source_page}`}
                    className="max-h-[65vh] object-contain select-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Extracted Structured Fields */}
          <div className="w-full md:w-[420px] bg-white flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Extracted Record Fields
              </span>
              <div className="flex items-center space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium"
                  >
                    Edit Values
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-xs px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                  title="Reprocess Card OCR"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Review Reasons alert if present */}
            {record.review_reasons && record.review_reasons.length > 0 && (
              <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1 shrink-0">
                <div className="font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Review Items Detected:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {record.review_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Field List / Edit Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Serial & Voter ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">Serial No.</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {record.serial_number ?? <span className="text-slate-400 font-normal italic">null</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Voter ID (EPIC)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.voter_id}
                      onChange={(e) => setFormData({ ...formData, voter_id: e.target.value })}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  ) : (
                    <div className="mt-1 text-sm font-semibold text-slate-900 font-mono">
                      {record.voter_id ?? <span className="text-slate-400 font-normal italic font-sans">null</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Name (Hindi) */}
              <div>
                <label className="text-xs font-medium text-slate-500">Elector Name (निर्वाचक का नाम)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.elector_name}
                    onChange={(e) => setFormData({ ...formData, elector_name: e.target.value })}
                    className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <div className="mt-1 text-base font-medium text-slate-900">
                    {record.elector_name ?? <span className="text-slate-400 text-sm font-normal italic">null</span>}
                  </div>
                )}
              </div>

              {/* Relation */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-xs font-medium text-slate-500">Relation</label>
                  {isEditing ? (
                    <select
                      value={formData.relation_type}
                      onChange={(e) => setFormData({ ...formData, relation_type: e.target.value })}
                      className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-2 py-2 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="father">Father</option>
                      <option value="husband">Husband</option>
                      <option value="mother">Mother</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <div className="mt-1 text-sm text-slate-800 capitalize">
                      {record.relation_type ?? '-'}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500">Relation Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.relation_name}
                      onChange={(e) => setFormData({ ...formData, relation_name: e.target.value })}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {record.relation_name ?? <span className="text-slate-400 font-normal italic">null</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* House No, Age, Gender */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">House No.</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.house_number}
                      onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-slate-900">
                      {record.house_number ?? <span className="text-slate-400 font-normal italic">null</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Age</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-slate-900 font-semibold">
                      {record.age ?? <span className="text-slate-400 font-normal italic">null</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Gender</label>
                  {isEditing ? (
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-2 py-2 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="male">Male (पुरुष)</option>
                      <option value="female">Female (महिला)</option>
                      <option value="third_gender">Third Gender</option>
                    </select>
                  ) : (
                    <div className="mt-1 text-sm text-slate-900">
                      {record.gender_original || record.gender || <span className="text-slate-400 font-normal italic">null</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw card text inspector */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-medium text-slate-400 block mb-1">Raw Card Text</label>
                <div className="bg-slate-50 rounded-lg p-2 text-xs font-mono text-slate-600 whitespace-pre-wrap max-h-24 overflow-y-auto border border-slate-200/60">
                  {record.raw_card_text || 'No text extracted'}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              {isEditing ? (
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-colors shadow-xs"
                >
                  {isSaving ? 'Saving Corrections...' : 'Save & Mark Verified'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleFlagReview}
                    className="px-3 py-2 border border-slate-200 hover:bg-white text-slate-700 text-xs font-medium rounded-xl flex items-center space-x-1.5"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-500" />
                    <span>Flag</span>
                  </button>

                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Next</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
