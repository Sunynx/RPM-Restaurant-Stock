import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Loader2, Database, List, FileClock, UploadCloud, FolderTree, FileSpreadsheet, FileText, Download, Pencil, Trash2, Check, X, ChevronUp, ChevronDown, Search, ArrowUp, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuditLogs } from '../graphService';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminPanel({ users, onAddUser, onEditUserRole, onUpdateUser, onDeleteUser, accessToken, setIsCSVModalOpen, categories = [], onAddCategory, inventory = [], userRole }) {
  const [activeTab, setActiveTab] = useState(userRole === 'Manager' ? 'categories' : 'users');
  
  // Users state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [loadingAddUser, setLoadingAddUser] = useState(false);

  // Category state
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  
  // User edit state
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({ name: '', email: '', role: '' });
  
  const [logSort, setLogSort] = useState({ key: 'date', direction: 'desc' });
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [logFilterAction, setLogFilterAction] = useState('all');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');

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

  const uniqueActions = useMemo(() => {
    const actions = new Set();
    auditLogs.forEach(log => {
      if (log.title) actions.add(log.title);
    });
    return Array.from(actions).sort();
  }, [auditLogs]);

  const handleLogSort = (key) => {
    if (logSort.key === key) {
      if (logSort.direction === 'asc') {
        setLogSort({ key, direction: 'desc' });
      } else {
        setLogSort({ key: null, direction: 'asc' });
      }
    } else {
      setLogSort({ key, direction: 'asc' });
    }
  };

  const filteredLogs = useMemo(() => {
    let filtered = auditLogs;
    if (logsSearchTerm.trim()) {
      const term = logsSearchTerm.toLowerCase();
      filtered = filtered.filter(l => 
        (l.user || '').toLowerCase().includes(term) ||
        (l.title || '').toLowerCase().includes(term) ||
        (l.details || '').toLowerCase().includes(term)
      );
    }
    
    if (logFilterAction !== 'all') {
      filtered = filtered.filter(l => (l.title || '').toLowerCase() === logFilterAction.toLowerCase());
    }

    if (logStartDate) {
      const start = new Date(logStartDate).getTime();
      filtered = filtered.filter(l => new Date(l.date).getTime() >= start);
    }

    if (logEndDate) {
      const end = new Date(logEndDate).getTime() + 86400000 - 1; // Include full day
      filtered = filtered.filter(l => new Date(l.date).getTime() <= end);
    }
    
    return [...filtered].sort((a, b) => {
      if (!logSort.key) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      let aValue = a[logSort.key] || '';
      let bValue = b[logSort.key] || '';
      if (logSort.key === 'date') {
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }
      
      if (aValue < bValue) return logSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return logSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [auditLogs, logsSearchTerm, logSort, logFilterAction, logStartDate, logEndDate]);

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!email) return;
    setLoadingAddUser(true);
    onAddUser({ email, name, role });
    // Reset form
    setEmail('');
    setName('');
    setRole('Staff');
    setTimeout(() => setLoadingAddUser(false), 500);
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setEditUserData({ name: u.name || '', email: u.email || '', role: u.role || 'Staff' });
  };

  const handleSaveUser = (userId) => {
    if (onUpdateUser) {
      onUpdateUser(userId, editUserData, editUserData.email);
    }
    setEditingUserId(null);
  };

  const handleDeleteClick = (userId, email) => {
    if (window.confirm(`Are you sure you want to remove access for ${email}?`)) {
      if (onDeleteUser) onDeleteUser(userId, email);
    }
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
      'Cost': item.cost,
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
    doc.text(`Generated on: ${new Date().toLocaleString('th-TH')}`, 14, 30);
    
    const tableColumn = ["Code", "Item Name", "Category", "Unit", "Cost", "Price", "Stock", "Min Stock"];
    const tableRows = [];
    
    inventory.forEach(item => {
      const itemData = [
        item.code || '-',
        item.item || '-',
        item.category || '-',
        item.unit || '-',
        item.cost || '-',
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

  const allTabs = [
    { id: 'users', label: 'Users', icon: Shield, adminOnly: true },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'data', label: 'Data & Reports', icon: Database, adminOnly: true },
    { id: 'logs', label: 'Audit Logs', icon: FileClock, adminOnly: true }
  ];

  const tabs = allTabs.filter(tab => userRole === 'Admin' || !tab.adminOnly);

  const SortHeader = ({ label, sortKey, style }) => {
    const isActive = logSort.key === sortKey;
    const isDesc = isActive && logSort.direction === 'desc';
    
    return (
      <th onClick={() => handleLogSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none', ...style }}>
        <div className={`sort-header ${isActive ? 'active' : ''}`}>
          <span>{label}</span>
          <div className="sort-indicator">
            {isActive ? (
              <motion.div
                initial={false}
                animate={{ rotate: isDesc ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ display: 'flex' }}
              >
                <ArrowUp size={13} strokeWidth={2.5} />
              </motion.div>
            ) : (
              <ArrowUpDown size={13} style={{ opacity: 0.25 }} />
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="admin-container" style={{ width: '100%', margin: '0 auto' }}>
      
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
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
          >
            {/* Add User Card */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon indigo">
                  <Shield size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>User Management</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
                Manage access to the inventory system. Only Admins can add or edit products.
              </p>
              
              <form onSubmit={handleAddUser} className="admin-form-row">
                <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                  <label className="form-label">Display Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. John Doe" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1.5, minWidth: 200 }}>
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="user@royalphuketmarina.com" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ width: 140 }}>
                  <label className="form-label">Role</label>
                  <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Account">Account</option>
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
                      <th style={{ paddingLeft: 'var(--sp-3)' }}>User</th>
                      <th style={{ paddingLeft: 4, paddingRight: 4 }}>Role</th>
                      <th style={{ textAlign: 'right', paddingRight: 'var(--sp-3)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const isEditing = editingUserId === u.id;
                      return (
                        <tr key={u.id || u.email}>
                          <td style={{ paddingLeft: 'var(--sp-3)', paddingRight: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ 
                                width: 32, 
                                height: 32, 
                                borderRadius: 'var(--radius-full)', 
                                background: u.role === 'Admin' ? 'var(--indigo-100)' : u.role === 'Manager' ? 'var(--amber-100)' : u.role === 'Account' ? 'var(--cyan-100)' : 'var(--emerald-100)',
                                color: u.role === 'Admin' ? 'var(--indigo-600)' : u.role === 'Manager' ? 'var(--amber-600)' : u.role === 'Account' ? 'var(--cyan-600)' : 'var(--emerald-600)',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: 13, 
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {(u.name || u.email || '?')[0].toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 100 }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <input 
                                      type="text" 
                                      className="form-input" 
                                      value={editUserData.name} 
                                      onChange={e => setEditUserData({...editUserData, name: e.target.value})}
                                      placeholder="Display Name"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                    />
                                    <input 
                                      type="email" 
                                      className="form-input" 
                                      value={editUserData.email} 
                                      onChange={e => setEditUserData({...editUserData, email: e.target.value})}
                                      placeholder="Email"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    {u.name && <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{u.name}</div>}
                                    <div style={{ fontWeight: u.name ? 400 : 500, fontSize: u.name ? 12 : 14, color: u.name ? 'var(--text-secondary)' : 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                      {u.email}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'middle', paddingLeft: 4, paddingRight: 4 }}>
                            {isEditing ? (
                              <select 
                                value={editUserData.role} 
                                onChange={(e) => setEditUserData({...editUserData, role: e.target.value})}
                                className="form-input"
                                style={{ padding: '4px 8px', height: 28, fontSize: 12, width: 85 }}
                              >
                                <option value="Staff">Staff</option>
                                <option value="Manager">Manager</option>
                                <option value="Admin">Admin</option>
                                <option value="Account">Account</option>
                              </select>
                            ) : (
                              <select 
                                value={u.role} 
                                onChange={(e) => onEditUserRole && onEditUserRole(u.id, e.target.value, u.email)}
                                className="form-input"
                                style={{ 
                                  padding: '4px 6px', 
                                  height: 'auto', 
                                  fontSize: 12, 
                                  fontWeight: 600,
                                  width: 85, 
                                  cursor: 'pointer',
                                  background: u.role === 'Admin' ? 'var(--indigo-50)' : u.role === 'Manager' ? 'var(--amber-50)' : u.role === 'Account' ? 'var(--cyan-50)' : 'var(--emerald-50)',
                                  color: u.role === 'Admin' ? 'var(--indigo-700)' : u.role === 'Manager' ? 'var(--amber-700)' : u.role === 'Account' ? 'var(--cyan-700)' : 'var(--emerald-700)',
                                  border: 'none',
                                  borderRadius: 'var(--radius-full)'
                                }}
                              >
                                <option value="Staff">Staff</option>
                                <option value="Manager">Manager</option>
                                <option value="Admin">Admin</option>
                                <option value="Account">Account</option>
                              </select>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 'var(--sp-3)', verticalAlign: 'middle', paddingLeft: 4 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={() => handleSaveUser(u.id)} style={{ padding: 4, width: 28, height: 28 }} title="Save">
                                  <Check size={16} />
                                </button>
                                <button className="btn" onClick={() => setEditingUserId(null)} style={{ padding: 4, width: 28, height: 28 }} title="Cancel">
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button className="btn" onClick={() => handleEditClick(u)} style={{ padding: 4, width: 28, height: 28, color: 'var(--text-secondary)' }} title="Edit">
                                  <Pencil size={16} />
                                </button>
                                <button className="btn" onClick={() => handleDeleteClick(u.id, u.email)} style={{ padding: 4, width: 28, height: 28, color: 'var(--danger)' }} title="Delete">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
          >
            {/* Add Category Card */}
            <div className="card" style={{ padding: 'var(--sp-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
                <div className="kpi-icon orange">
                  <FolderTree size={20} />
                </div>
                <h2 className="card-title" style={{ fontSize: 18 }}>Category Management</h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
                Create new product categories. They will immediately appear in the dropdown menus.
              </p>
              
              <form onSubmit={handleAddCat} className="admin-form-row">
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
              <div style={{ paddingLeft: 56, display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsCSVModalOpen(true)}
                  style={{ gap: 'var(--sp-2)' }}
                >
                  <UploadCloud size={18} />
                  Open CSV Uploader
                </button>
                <button 
                  className="btn"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFFTitle,ProductName,Category,Unit,UnitCost,UnitPrice,StockOnHand,MinStockLevel,Status\n6022,MARBORO GLOD,Souvenir,pcs,0,0,0,10,Active";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "product_import_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{ gap: 'var(--sp-2)', background: 'var(--bg-secondary)' }}
                >
                  <Download size={18} />
                  Download Template
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
                <div className="inventory-toolbar" style={{ borderBottom: 'none', padding: 'var(--sp-4) 0 0 0' }}>
                  <div className="toolbar-top" style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <div className="toolbar-search" style={{ flex: 1, minWidth: '250px' }}>
                      <div className="search-container">
                        <Search className="search-icon" size={16} />
                        <input 
                          type="text" 
                          className="search-input" 
                          placeholder="Search audit logs..." 
                          value={logsSearchTerm}
                          onChange={(e) => setLogsSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: '13px', height: '34px', width: 'auto' }}
                        value={logStartDate}
                        onChange={e => setLogStartDate(e.target.value)}
                        title="Start Date"
                      />
                      <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      <input 
                        type="date" 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: '13px', height: '34px', width: 'auto' }}
                        value={logEndDate}
                        onChange={e => setLogEndDate(e.target.value)}
                        title="End Date"
                      />
                      {(logStartDate || logEndDate) && (
                        <button 
                          className="btn btn-sm" 
                          style={{ height: '34px' }}
                          onClick={() => { setLogStartDate(''); setLogEndDate(''); }}
                        >
                          Clear Date
                        </button>
                      )}
                    </div>
                  </div>
                  {auditLogs.length > 0 && (
                    <div className="filter-chips">
                      <button
                        className={`filter-chip ${logFilterAction === 'all' ? 'active' : ''}`}
                        onClick={() => setLogFilterAction('all')}
                      >
                        All ({auditLogs.length})
                      </button>
                      {uniqueActions.map(action => {
                        const count = auditLogs.filter(l => l.title === action).length;
                        return (
                          <button
                            key={action}
                            className={`filter-chip ${logFilterAction === action ? 'active' : ''}`}
                            onClick={() => setLogFilterAction(action)}
                          >
                            {action} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              {loadingLogs ? (
                <div style={{ padding: 'var(--sp-12)', display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
                </div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="data-table-container desktop-only" style={{ maxHeight: 600, overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                        <tr>
                          <SortHeader label="Date" sortKey="date" style={{ paddingLeft: 'var(--sp-6)' }} />
                          <SortHeader label="User" sortKey="user" />
                          <SortHeader label="Action Type" sortKey="title" />
                          <SortHeader label="Details" sortKey="details" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.length > 0 ? filteredLogs.map(log => (
                          <tr key={log.id}>
                            <td style={{ paddingLeft: 'var(--sp-6)', whiteSpace: 'nowrap' }}>
                              {new Date(log.date).toLocaleString('th-TH')}
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
                  
                  {/* Mobile View */}
                  <div className="mobile-only" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {filteredLogs.length > 0 ? filteredLogs.map(log => (
                      <div key={log.id} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', background: 'var(--bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(log.date).toLocaleString('th-TH')}</span>
                          <span className="badge badge-neutral" style={{ flexShrink: 0, marginLeft: 'var(--sp-2)' }}>{log.title}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: '2px', wordBreak: 'break-all' }}>{log.user}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{log.details}</div>
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-secondary)' }}>
                        No audit logs found.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
