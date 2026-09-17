import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckCircle2, AlertCircle, Eye, Edit3, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { VoterRecord } from '../types';

interface RecordsTableProps {
  records: VoterRecord[];
  onSelectRecord: (record: VoterRecord) => void;
  onVerifyRecord: (recordId: string) => void;
  totalPages: number;
}

export const RecordsTable: React.FC<RecordsTableProps> = ({
  records,
  onSelectRecord,
  onVerifyRecord,
  totalPages,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof VoterRecord>('serial_number');
  const [sortAsc, setSortAsc] = useState(true);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          String(r.serial_number || '').includes(term) ||
          (r.voter_id || '').toLowerCase().includes(term) ||
          (r.elector_name || '').toLowerCase().includes(term) ||
          (r.relation_name || '').toLowerCase().includes(term) ||
          (r.house_number || '').toLowerCase().includes(term) ||
          String(r.age || '').includes(term);
        if (!matches) return false;
      }

      // Gender filter
      if (selectedGender !== 'all') {
        if (selectedGender === 'male' && r.gender !== 'male' && r.gender_original !== 'पुरुष') return false;
        if (selectedGender === 'female' && r.gender !== 'female' && r.gender_original !== 'महिला') return false;
        if (selectedGender === 'third_gender' && r.gender !== 'third_gender') return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'needs_review' && !r.needs_review) return false;
        if (selectedStatus === 'verified' && r.verification_status !== 'verified') return false;
        if (selectedStatus === 'unverified' && (r.verification_status !== 'unverified' || r.needs_review)) return false;
      }

      // Page filter
      if (selectedPage !== 'all' && r.source_page !== parseInt(selectedPage)) {
        return false;
      }

      return true;
    });
  }, [records, searchTerm, selectedGender, selectedStatus, selectedPage]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      return sortAsc ? 1 : -1;
    });
  }, [filteredRecords, sortField, sortAsc]);

  const handleSort = (field: keyof VoterRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div id="records-table-container" className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search input with Hindi Unicode support */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Name, Voter ID, Serial, House, Age (supports Hindi)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="needs_review">Needs Review</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>

          {/* Gender */}
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Genders</option>
            <option value="male">Male (पुरुष)</option>
            <option value="female">Female (महिला)</option>
            <option value="third_gender">Third Gender</option>
          </select>

          {/* Page */}
          {totalPages > 1 && (
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Pages</option>
              {pagesArray.map((p) => (
                <option key={p} value={p}>
                  Page {p}
                </option>
              ))}
            </select>
          )}

          <div className="text-slate-400 font-medium ml-1">
            Showing <span className="font-semibold text-slate-900">{sortedRecords.length}</span> of {records.length}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th
                  onClick={() => handleSort('serial_number')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>Serial</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('voter_id')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>Voter ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('elector_name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Elector Name (निर्वाचक)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Relation</th>
                <th className="py-3 px-4">Relation Name</th>
                <th className="py-3 px-3 whitespace-nowrap">House</th>
                <th
                  onClick={() => handleSort('age')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>Age</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Gender</th>
                <th
                  onClick={() => handleSort('source_page')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap text-center"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Page</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Status</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record, index) => {
                  const isFlagged = record.needs_review;
                  const isVerified = record.verification_status === 'verified';

                  return (
                    <tr
                      key={record.id}
                      onClick={() => onSelectRecord(record)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isFlagged ? 'bg-amber-50/25' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-900 font-mono">
                        {record.serial_number ?? <span className="text-slate-400 font-normal italic">null</span>}
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-slate-800">
                        {record.voter_id ? (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 border border-slate-200">
                            {record.voter_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">null</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-900 text-[13px]">
                        {record.elector_name ?? <span className="text-slate-400 text-xs font-normal italic">null</span>}
                      </td>

                      <td className="py-3 px-3 text-slate-600 capitalize">
                        {record.relation_type ?? '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-800 text-[13px]">
                        {record.relation_name ?? <span className="text-slate-400 text-xs font-normal italic">null</span>}
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-mono">
                        {record.house_number ?? <span className="text-slate-400 font-normal italic font-sans">null</span>}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-900">
                        {record.age ?? <span className="text-slate-400 font-normal italic">null</span>}
                      </td>

                      <td className="py-3 px-3 text-slate-700">
                        {record.gender_original || record.gender || <span className="text-slate-400 italic">null</span>}
                      </td>

                      <td className="py-3 px-3 text-center text-slate-500 font-mono">
                        {record.source_page}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {isFlagged ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Review
                          </span>
                        ) : isVerified ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Unverified
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onSelectRecord(record)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Inspect PDF Card"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isVerified && (
                            <button
                              onClick={() => onVerifyRecord(record.id)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              title="Mark Verified"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
