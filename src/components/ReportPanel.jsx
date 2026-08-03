import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, RefreshCw, Package, TrendingDown, TrendingUp, Activity, AlertTriangle, Search } from 'lucide-react';
import { fetchAuditLogs, fetchTransactions } from '../graphService';
import toast from 'react-hot-toast';
import { useMsal } from '@azure/msal-react';

export default function ReportPanel({ inventory }) {
  const { instance, accounts } = useMsal();
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('daily');
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'transactions' | 'inventory'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const account = accounts[0];
      const response = await instance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All'],
        account: account
      });
      const [logData, txData] = await Promise.all([
        fetchAuditLogs(response.accessToken),
        fetchTransactions(response.accessToken)
      ]);
      setLogs(logData);
      setTransactions(txData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  // Filter logs by period
  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter(log => {
      const logDate = new Date(log.date);
      if (filter === 'daily') return logDate.toDateString() === now.toDateString();
      if (filter === 'monthly') return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [logs, filter]);

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (filter === 'daily') return txDate.toDateString() === now.toDateString();
      if (filter === 'monthly') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, filter]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalProducts = inventory.length;
    const totalStock = inventory.reduce((sum, p) => sum + (parseInt(p.stockOnHand) || 0), 0);
    const lowStock = inventory.filter(p => {
      const stock = parseInt(p.stockOnHand) || 0;
      const min = parseInt(p.minStockLevel) || 0;
      return stock > 0 && stock <= min;
    }).length;
    const outOfStock = inventory.filter(p => (parseInt(p.stockOnHand) || 0) <= 0).length;

    const salesQty = filteredTransactions.filter(t => t.type === 'Sales').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const entQty = filteredTransactions.filter(t => t.type === 'ENT').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const receiveQty = filteredTransactions.filter(t => t.type === 'Receive').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const totalMovements = filteredTransactions.length;

    return { totalProducts, totalStock, lowStock, outOfStock, salesQty, entQty, receiveQty, totalMovements };
  }, [inventory, filteredTransactions]);

  // Inventory data enriched with product names for the full report table
  const inventorySearched = useMemo(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(p =>
      (p.item || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  const handleExportCSV = (type) => {
    let csvRows = [];
    if (type === 'transactions') {
      csvRows = [['Date', 'Type', 'Product ID', 'Quantity', 'Performed By', 'Remarks'].join(',')];
      filteredTransactions.forEach(tx => {
        const product = inventory.find(p => String(p.id) === String(tx.productId));
        csvRows.push([
          `"${new Date(tx.date).toLocaleString()}"`,
          `"${tx.type}"`,
          `"${product ? product.item : tx.productId}"`,
          tx.quantity,
          `"${tx.performedBy}"`,
          `"${(tx.remarks || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    } else if (type === 'inventory') {
      csvRows = [['Code', 'Product Name', 'Unit', 'Price', 'Stock', 'Min Level', 'Status'].join(',')];
      inventory.forEach(p => {
        const stockVal = parseInt(p.stockOnHand) || 0;
        const minVal = parseInt(p.minStockLevel) || 0;
        let status = 'Active';
        if (stockVal <= 0) status = 'Out of Stock';
        else if (stockVal <= minVal) status = 'Low Stock';
        csvRows.push([
          `"${p.code}"`, `"${p.item}"`, `"${p.unit}"`, p.price, stockVal, minVal, `"${status}"`
        ].join(','));
      });
    } else if (type === 'daily-summary') {
      csvRows = [['Date & Time', 'Action', 'Product Name', 'Quantity', 'Performed By'].join(',')];
      const today = new Date();
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.toDateString() === today.toDateString()) {
          const product = inventory.find(p => String(p.id) === String(tx.productId));
          csvRows.push([
            `"${txDate.toLocaleString()}"`,
            `"${tx.type}"`,
            `"${product ? product.item : tx.productId}"`,
            tx.quantity,
            `"${tx.performedBy}"`
          ].join(','));
        }
      });
    } else {
      csvRows = [['Date', 'User', 'Action', 'Details', 'Status'].join(',')];
      filteredLogs.forEach(log => {
        csvRows.push([
          `"${new Date(log.date).toLocaleString()}"`,
          `"${log.user}"`, `"${log.title}"`,
          `"${(log.details || '').replace(/"/g, '""')}"`,
          `"${log.status}"`
        ].join(','));
      });
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPM_Report_${type}_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export successful!');
  };

  const filterLabel = filter === 'daily' ? 'Today' : filter === 'monthly' ? 'This Month' : 'All Time';

  const sectionTabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'transactions', label: 'Transaction Log', icon: TrendingDown },
    { key: 'inventory', label: 'Inventory Snapshot', icon: Package },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {/* Header */}
      <motion.div 
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: 'var(--sp-5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', margin: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--primary), var(--indigo-500))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} style={{ color: '#fff' }} />
            </div>
            System Report
          </h2>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => handleExportCSV('daily-summary')} 
              style={{ padding: '8px 14px', fontSize: 13, marginRight: 'var(--sp-2)' }}
            >
              <Download size={16} style={{ marginRight: 6 }} /> Daily Report Export
            </button>
            <select 
              className="form-input" 
              style={{ padding: '8px 14px', minWidth: 130, fontWeight: 600, borderRadius: 'var(--radius-lg)' }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="daily">📅 Today</option>
              <option value="monthly">📆 This Month</option>
              <option value="all">📊 All Time</option>
            </select>
            <button 
              className="btn btn-ghost" 
              onClick={loadData} 
              style={{ padding: '8px' }}
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI Summary Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}
      >
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Movements ({filterLabel})</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>{stats.totalMovements}</div>
        </div>
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Used</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--indigo-500)', marginTop: 4 }}>{stats.salesQty}</div>
        </div>
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spoilage / ENT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: 4 }}>{stats.entQty}</div>
        </div>
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{stats.receiveQty}</div>
        </div>
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Stock</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.lowStock > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: 4 }}>{stats.lowStock}</div>
        </div>
        <div className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out of Stock</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.outOfStock > 0 ? 'var(--danger)' : 'var(--text-primary)', marginTop: 4 }}>{stats.outOfStock}</div>
        </div>
      </motion.div>

      {/* Section Tabs */}
      <motion.div 
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ padding: 'var(--sp-5)' }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--sp-3)', overflowX: 'auto' }}>
          {sectionTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`btn ${activeSection === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveSection(tab.key)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, 
                  padding: '8px 16px', borderRadius: 'var(--radius-lg)',
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Activity Log ({filterLabel})</h3>
              <button className="btn btn-ghost" onClick={() => handleExportCSV('overview')} style={{ fontSize: 13 }}>
                <Download size={14} style={{ marginRight: 4 }} /> Export
              </button>
            </div>
            <div className="data-table-container" style={{ display: 'block' }}>
              <table className="data-table">
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
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>Loading...</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No activity found for {filterLabel.toLowerCase()}.</td></tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(log.date).toLocaleString()}</td>
                        <td style={{ fontSize: 13 }}>{log.user}</td>
                        <td>
                          <span className={`badge ${log.title.includes('Create') || log.title.includes('Add') ? 'badge-success' : log.title.includes('Update') ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: 11 }}>
                            {log.title}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
                        <td><span className="badge badge-success" style={{ fontSize: 11 }}>{log.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Section */}
        {activeSection === 'transactions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Stock Transactions ({filterLabel})</h3>
              <button className="btn btn-ghost" onClick={() => handleExportCSV('transactions')} style={{ fontSize: 13 }}>
                <Download size={14} style={{ marginRight: 4 }} /> Export
              </button>
            </div>
            <div className="data-table-container" style={{ display: 'block' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>Loading...</td></tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No transactions found for {filterLabel.toLowerCase()}.</td></tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const product = inventory.find(p => String(p.id) === String(tx.productId));
                      const isNegative = tx.quantity < 0;
                      return (
                        <tr key={tx.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(tx.date).toLocaleString()}</td>
                          <td>
                            <span className={`badge ${tx.type === 'Receive' ? 'badge-success' : tx.type === 'Sales' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 600 }}>{product ? product.item : `#${tx.productId}`}</td>
                          <td style={{ fontWeight: 700, color: isNegative ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>
                            {isNegative ? '' : '+'}{tx.quantity}
                          </td>
                          <td style={{ fontSize: 13 }}>{tx.performedBy}</td>
                          <td style={{ fontSize: 13, color: tx.remarks ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{tx.remarks || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Snapshot Section */}
        {activeSection === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Full Inventory Snapshot ({inventory.length} products)</h3>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 32, minWidth: 160, fontSize: 13 }}
                  />
                </div>
                <button className="btn btn-ghost" onClick={() => handleExportCSV('inventory')} style={{ fontSize: 13 }}>
                  <Download size={14} style={{ marginRight: 4 }} /> Export
                </button>
              </div>
            </div>
            <div className="data-table-container" style={{ display: 'block' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product Name</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Min Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventorySearched.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No products found.</td></tr>
                  ) : (
                    inventorySearched.map(p => {
                      const stockVal = parseInt(p.stockOnHand) || 0;
                      const minVal = parseInt(p.minStockLevel) || 0;
                      let status = 'Active';
                      let badgeClass = 'badge-success';
                      if (stockVal <= 0) { status = 'Out of Stock'; badgeClass = 'badge-danger'; }
                      else if (stockVal <= minVal) { status = 'Low Stock'; badgeClass = 'badge-warning'; }
                      return (
                        <tr key={p.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.code}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{p.item}</td>
                          <td style={{ fontSize: 13 }}>{p.unit}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>฿{(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: stockVal <= 0 ? 'var(--danger)' : stockVal <= minVal ? 'var(--warning)' : 'var(--text-primary)' }}>{stockVal}</td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-tertiary)' }}>{minVal}</td>
                          <td><span className={`badge ${badgeClass}`} style={{ fontSize: 11 }}>{status}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
