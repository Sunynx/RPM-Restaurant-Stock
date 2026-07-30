import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';

const TARGET_LISTS = [
  { id: 'Inventory_Products', name: 'Products' },
  { id: 'Inventory_Categories', name: 'Categories' },
  { id: 'Inventory_Transactions', name: 'Transactions' },
  { id: 'Inventory_Users', name: 'Users' }
];

export default function CSVImporterModal({ onClose, onImport, isImporting, importProgress }) {
  const [targetList, setTargetList] = useState(TARGET_LISTS[0].id);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError(null);

    if (selectedFile) {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          if (results.errors.length > 0) {
            setError(`Error parsing CSV: ${results.errors[0].message}`);
            return;
          }
          if (results.data.length === 0) {
            setError("CSV file is empty.");
            return;
          }
          setHeaders(Object.keys(results.data[0]));
          setPreview(results.data.slice(0, 3));
        },
        error: function(err) {
          setError(err.message);
        }
      });
    }
  };

  const handleStartImport = () => {
    if (!file || preview.length === 0) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: function(results) {
        onImport(targetList, results.data);
      }
    });
  };

  const progressPercent = importProgress.total > 0 
    ? Math.round((importProgress.current / importProgress.total) * 100) 
    : 0;

  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="modal-content"
        style={{ maxWidth: 560 }}
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <UploadCloud size={20} style={{ color: 'var(--primary)' }} />
            CSV Importer
          </h2>
          {!isImporting && (
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        {isImporting ? (
          <div className="import-progress">
            <Loader2 size={40} className="spin import-progress-icon" />
            <h3 className="import-progress-title">Importing Data...</h3>
            <p className="import-progress-subtitle">
              Processed {importProgress.current} of {importProgress.total} rows ({progressPercent}%)
            </p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            {importProgress.errors > 0 && (
              <div className="alert-error" style={{ marginTop: 'var(--sp-4)', justifyContent: 'center' }}>
                <AlertCircle size={14} /> {importProgress.errors} errors encountered
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Target SharePoint List</label>
              <select 
                className="form-input" 
                value={targetList} 
                onChange={e => setTargetList(e.target.value)}
              >
                {TARGET_LISTS.map(list => (
                  <option key={list.id} value={list.id}>{list.name} ({list.id})</option>
                ))}
              </select>
              <p className="form-hint">
                Ensure your CSV column headers exactly match the internal names.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Select CSV File</label>
              <div className="csv-dropzone" onClick={() => document.getElementById('csv-file-input').click()}>
                <UploadCloud size={28} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {file ? file.name : 'Click to select a CSV file'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports .csv files'}
                </p>
                <input 
                  id="csv-file-input"
                  type="file" 
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {error && (
              <div className="alert-error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {preview.length > 0 && !error && (
              <div style={{ marginBottom: 'var(--sp-6)' }}>
                <div className="alert-success" style={{ marginBottom: 'var(--sp-3)' }}>
                  <CheckCircle2 size={14} />
                  File parsed — {headers.length} columns found
                </div>
                <div style={{ 
                  overflowX: 'auto', 
                  border: '1px solid var(--border-default)', 
                  borderRadius: 'var(--radius-md)' 
                }}>
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        {headers.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {headers.map(h => (
                            <td key={h}>{String(row[h] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="form-hint" style={{ marginTop: 'var(--sp-2)', fontStyle: 'italic' }}>
                  Showing first {preview.length} rows as preview.
                </p>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleStartImport}
                disabled={!file || preview.length === 0}
                style={{ opacity: !file || preview.length === 0 ? 0.5 : 1 }}
              >
                <UploadCloud size={16} />
                Start Import
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
