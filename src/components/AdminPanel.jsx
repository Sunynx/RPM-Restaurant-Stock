import { useState, useEffect } from 'react';
import { Shield, Plus, Loader2, Database, List, FileClock, UploadCloud, FolderTree, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuditLogs } from '../graphService';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminPanel({ users, onAddUser, accessToken, setIsCSVModalOpen, categories = [], onAddCategory, inventory = [] }) {
  const [activeTab, setActiveTab] = useState('categories'); // default can stay users, but I'll make it 'categories' for testing or 'users'. Let's stick to 'users'.
  
  // Users state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Staff');
  const [loadingAddUser, setLoadingAddUser] = useState(false);

  // Categories state
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [loadingAddCat, setLoadingAddCat] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch Audit Logs when tab becomes active
  useEffect(() => {
    if (activeTab === 'logs' && accessToken) {
      setLoadingLogs(true);
      fetchAuditLogs(accessToken).then(logs => {
        setAuditLogs(logs);
        setLoadingLogs(false);
      });
    }
  }, [activeTab, accessToken]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoadingAddUser(true);
    await onAddUser({ email, role });
    setEmail('');
    setLoadingAddUser(false);
  };

  const handleAddCat = async (e) => {
    e.preventDefault();
    if (!catName || !catCode) return;
    setLoadingAddCat(true);
    await onAddCategory({ name: catName, code: catCode });
    setCatName('');
    setCatCode('');
    setLoadingAddCat(false);
  };

  const handleExportExcel = () => {
    if (!inventory.length) return;
    const exportData = inventory.map(item => ({
      'Item Code': item.code,
      'Item Name': item.item,
      'Category': item.category,
      'Unit': item.unit,
      'Price': item.price,
      'Closing Stock': item.closing,
      'Min Stock Level': item.minStockLevel,
      'Remarks': item.remarks
    }));
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Inventory");
    writeFile(wb, `RPM_Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!inventory.length) return;
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.text('RPM Inventory Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    const tableColumn = ["Code", "Item Name", "Category", "Unit", "Price", "Stock", "Min Stock"];
    const tableRows = [];
    
    inventory.forEach(item => {
      const itemData = [
        item.code || '-',
        item.item || '-',
        item.category || '-',
        item.unit || '-',
        item.price || '-',
        item.closing || '0',
        item.minStockLevel || '0'
      ];
      tableRows.push(itemData);
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138] }
    });
    
    doc.save(`RPM_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const tabs = [
    { id: 'users', label: 'Users', icon: Shield },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'data', label: 'Data & Reports', icon: Database },
    { id: 'logs', label: 'Audit Logs', icon: FileClock }
  ];

  return (
    <div className="admin-container" style={{ maxWidth: 1000, margin: '0 auto' }}>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 'var(--sp-2)', 
        marginBottom: 'var(--sp-6)', 
        borderBottom: '1px solid var(--border-subtle)' 
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: -1
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Add User Card */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon indigo">
                  <Shield size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>User Management</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', paddingLeft: 56 }}>
                Manage access to the inventory system. Only Admins can add or edit products.
              </p>
              
              <form onSubmit={handleAddUser} className="admin-form-row" style={{ paddingLeft: 56 }}>
                <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="user@example.com" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ width: 140 }}>
                  <label className="form-label">Role</label>
                  <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingAddUser} style={{ height: 44, flexShrink: 0 }}>
                  {loadingAddUser ? <Loader2 size={16} className="spin" /> : <><Plus size={16} /> Add User</>}
                </button>
              </form>
            </div>

            {/* Users Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="data-table-container" style={{ display: 'block' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 'var(--sp-6)' }}>User</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id || u.email}>
                        <td style={{ paddingLeft: 'var(--sp-6)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                            <div style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 'var(--radius-full)', 
                              background: u.role === 'Admin' ? 'var(--indigo-100)' : 'var(--emerald-100)',
                              color: u.role === 'Admin' ? 'var(--indigo-600)' : 'var(--emerald-600)',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: 13, 
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {(u.email || '?')[0].toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500 }}>{u.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'Admin' ? 'badge-info' : 'badge-success'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Add Category Card */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon orange">
                  <FolderTree size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>Category Management</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', paddingLeft: 56 }}>
                Create new product categories. They will immediately appear in the dropdown menus.
              </p>
              
              <form onSubmit={handleAddCat} className="admin-form-row" style={{ paddingLeft: 56 }}>
                <div className="form-group" style={{ width: 140 }}>
                  <label className="form-label">Code</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. BEV" 
                    value={catCode}
                    onChange={e => setCatCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                  <label className="form-label">Category Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Beverages" 
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingAddCat} style={{ height: 44, flexShrink: 0 }}>
                  {loadingAddCat ? <Loader2 size={16} className="spin" /> : <><Plus size={16} /> Add Category</>}
                </button>
              </form>
            </div>

            {/* Categories Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="data-table-container" style={{ display: 'block' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 'var(--sp-6)' }}>Category Name</th>
                      <th>Code</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id}>
                        <td style={{ paddingLeft: 'var(--sp-6)', fontWeight: 500 }}>
                          {c.name}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {c.code}
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                            {c.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'data' && (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
          >
            {/* Import Section */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon emerald">
                  <UploadCloud size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>Data Import</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', paddingLeft: 56 }}>
                Import initial products or batch update inventory using a CSV file.
              </p>
              <div style={{ paddingLeft: 56 }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsCSVModalOpen(true)}
                  style={{ gap: 'var(--sp-2)' }}
                >
                  <UploadCloud size={18} />
                  Open CSV Uploader
                </button>
              </div>
            </div>

            {/* Export Section */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon indigo">
                  <Download size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>Export Reports</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', paddingLeft: 56 }}>
                Download your current inventory data as an Excel spreadsheet or a PDF report.
              </p>
              <div style={{ paddingLeft: 56, display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <button 
                  className="btn"
                  onClick={handleExportExcel}
                  style={{ gap: 'var(--sp-2)', background: '#10b981', color: 'white', borderColor: '#10b981' }}
                >
                  <FileSpreadsheet size={18} />
                  Export to Excel
                </button>
                <button 
                  className="btn"
                  onClick={handleExportPDF}
                  style={{ gap: 'var(--sp-2)', background: '#ef4444', color: 'white', borderColor: '#ef4444' }}
                >
                  <FileText size={18} />
                  Export to PDF
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 'var(--sp-6)', borderBottom: '1px solid var(--border-subtle)' }}>
                <h2 className="card-title" style={{ fontSize: 18 }}>System Audit Logs</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Recent actions performed in the system.</p>
              </div>
              
              {loadingLogs ? (
                <div style={{ padding: 'var(--sp-12)', display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
                </div>
              ) : (
                <div className="data-table-container" style={{ display: 'block', maxHeight: 600, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                      <tr>
                        <th style={{ paddingLeft: 'var(--sp-6)' }}>Date</th>
                        <th>User</th>
                        <th>Action Type</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length > 0 ? auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ paddingLeft: 'var(--sp-6)', whiteSpace: 'nowrap' }}>
                            {new Date(log.date).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 500 }}>{log.user}</td>
                          <td>
                            <span className="badge badge-neutral">{log.title}</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{log.details}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-secondary)' }}>
                            No audit logs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
