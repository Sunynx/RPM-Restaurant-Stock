import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { fetchAuditLogs } from '../graphService';
import toast from 'react-hot-toast';
import { useMsal } from '@azure/msal-react';

export default function ReportPanel({ inventory }) {
  const { instance, accounts } = useMsal();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('daily'); // 'daily' | 'monthly' | 'all'

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const account = accounts[0];
      const response = await instance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All'],
        account: account
      });
      const data = await fetchAuditLogs(response.accessToken);
      setLogs(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter(log => {
      const logDate = new Date(log.date);
      if (filter === 'daily') {
        return logDate.toDateString() === now.toDateString();
      } else if (filter === 'monthly') {
        return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [logs, filter]);

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.error('No data to export.');
      return;
    }
    
    // Create CSV content
    const headers = ['Date', 'User', 'Action', 'Details', 'Status'];
    const csvRows = [headers.join(',')];
    
    filteredLogs.forEach(log => {
      const row = [
        new Date(log.date).toLocaleString(),
        `"${log.user}"`,
        `"${log.title}"`,
        `"${log.details?.replace(/"/g, '""') || ''}"`,
        `"${log.status}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPM_Inventory_Report_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <FileText size={24} style={{ color: 'var(--primary)' }} />
          Transaction Report
        </h2>
        
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <select 
            className="form-input" 
            style={{ padding: '6px 12px', minWidth: 120 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="all">All Time (Top 50)</option>
          </select>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} style={{ marginRight: 6 }} /> Export CSV
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>Loading reports...</td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
                  No transactions found for the selected period.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.date).toLocaleString()}</td>
                  <td>{log.user}</td>
                  <td>
                    <span className={`badge ${log.title.includes('Create') ? 'badge-success' : log.title.includes('Update') ? 'badge-warning' : 'badge-primary'}`}>
                      {log.title}
                    </span>
                  </td>
                  <td>{log.details}</td>
                  <td>{log.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
