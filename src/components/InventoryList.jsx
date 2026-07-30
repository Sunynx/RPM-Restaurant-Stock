import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Edit2, Download, Plus, ArrowUpDown, ArrowUp, AlertCircle, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function InventoryList({ inventory, categories, lowStockThreshold, onEdit, onAddProduct, userRole, initialFilters, onFiltersConsumed }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategories, setFilterCategories] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const parentRef = useRef(null);

  // Apply initial filters if provided
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.searchTerm !== undefined) setSearchTerm(initialFilters.searchTerm);
      if (initialFilters.filterStatus !== undefined) setFilterStatus(initialFilters.filterStatus);
      if (initialFilters.filterCategories !== undefined) setFilterCategories(initialFilters.filterCategories);
      if (onFiltersConsumed) onFiltersConsumed();
    }
  }, [initialFilters, onFiltersConsumed]);

  const getCategoryLabel = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : `Group ${id}`;
  };

  const dynamicCategories = categories.map(cat => ({
    id: cat.id,
    label: cat.name
  }));

  const toggleCategory = (id) => {
    setFilterCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSort = (key) => {
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ key, direction: 'desc' });
      } else {
        setSortConfig({ key: null, direction: 'asc' });
      }
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const toggleSelect = (code) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === sortedInventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedInventory.map(i => i.code)));
    }
  };

  const filteredInventory = inventory.filter(item => {
    const searchLower = String(searchTerm || '').toLowerCase();
    const matchesSearch = String(item.item || '').toLowerCase().includes(searchLower) || 
                          String(item.code || '').toLowerCase().includes(searchLower);
    
    let matchesStatus = true;
    if (filterStatus === 'low') matchesStatus = parseInt(item.closing) > 0 && parseInt(item.closing) < lowStockThreshold;
    if (filterStatus === 'out') matchesStatus = parseInt(item.closing) === 0;

    const matchesCategory = filterCategories.length === 0 ? true : filterCategories.includes(item.categoryId);
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sortedInventory = useMemo(() => {
    return [...filteredInventory].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'closing') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredInventory, sortConfig]);

  // Counts for filter chips
  const allCount = inventory.length;
  const lowCount = inventory.filter(i => parseInt(i.closing) > 0 && parseInt(i.closing) < lowStockThreshold).length;
  const outCount = inventory.filter(i => parseInt(i.closing) === 0).length;

  const handleExport = () => {
    const dataToExport = sortedInventory.map(item => ({
      Code: item.code,
      ItemName: item.item,
      Category: getCategoryLabel(item.categoryId),
      Opening: item.stockOnHand,
      Sales: item.sales,
      Closing: item.closing,
      Status: item.closing < lowStockThreshold ? 'Low Stock' : 'Optimal'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "Inventory_Export.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Inventory Status Report", 14, 15);
    
    const tableColumn = ["Code", "Item Name", "Category", "Opening", "Sales", "Closing", "Status"];
    const tableRows = [];

    sortedInventory.forEach(item => {
      const status = item.closing < lowStockThreshold ? 'Low Stock' : (item.closing == 0 ? 'Out of Stock' : 'Optimal');
      const itemData = [
        item.code || '',
        item.item || '',
        getCategoryLabel(item.categoryId),
        item.stockOnHand || '0',
        item.sales || '0',
        item.closing || '0',
        status
      ];
      tableRows.push(itemData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save("Inventory_Export.pdf");
  };

  const rowVirtualizer = useVirtualizer({
    count: sortedInventory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 5,
  });

  const SortHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    const isDesc = isActive && sortConfig.direction === 'desc';
    
    return (
      <th onClick={() => handleSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none' }}>
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
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Toolbar */}
        <div className="inventory-toolbar">
          <div className="toolbar-top">
            <div className="toolbar-search">
              <div className="search-container">
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search items or code..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="toolbar-actions">
              <button className="btn btn-ghost btn-sm" onClick={handleExport}>
                <Download size={15} /> Excel
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportPDF} style={{ color: 'var(--danger)' }}>
                <FileText size={15} /> PDF
              </button>
              {userRole === 'Admin' && (
                <button className="btn btn-primary btn-sm" onClick={onAddProduct}>
                  <Plus size={15} /> Add
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="filter-chips">
            <button
              className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({allCount})
            </button>
            <button
              className={`filter-chip warning ${filterStatus === 'low' ? 'active' : ''}`}
              onClick={() => setFilterStatus('low')}
            >
              Low Stock ({lowCount})
            </button>
            <button
              className={`filter-chip danger ${filterStatus === 'out' ? 'active' : ''}`}
              onClick={() => setFilterStatus('out')}
            >
              Out of Stock ({outCount})
            </button>

            {dynamicCategories.length > 0 && <div className="filter-divider" />}

            {dynamicCategories.map(cat => (
              <button
                key={cat.id}
                className={`filter-chip ${filterCategories.includes(cat.id) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sortedInventory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-12)', color: 'var(--text-tertiary)' }}>
              <Search size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <p>No items found.</p>
            </div>
          ) : (
            <>
              {/* Batch Action Bar */}
              <AnimatePresence>
                {selectedItems.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="batch-bar" style={{ borderRadius: 0 }}>
                      <span className="batch-bar-label">{selectedItems.size} item(s) selected</span>
                      <div className="batch-bar-actions">
                        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => alert("Bulk Update coming soon!")}>
                          Bulk Update
                        </button>
                        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => alert("Bulk Delete coming soon!")}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Table */}
              <div ref={parentRef} className="data-table-container" style={{ display: '', overflow: 'auto', minHeight: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={sortedInventory.length > 0 && selectedItems.size === sortedInventory.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <SortHeader label="Item Name" sortKey="item" />
                      <SortHeader label="Code" sortKey="code" />
                      <SortHeader label="Quantity" sortKey="closing" />
                      <SortHeader label="Category" sortKey="categoryId" />
                      <th>Status</th>
                      <th style={{ textAlign: 'center', width: 64 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <>
                        <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}></tr>
                        {rowVirtualizer.getVirtualItems().map(virtualRow => {
                          const item = sortedInventory[virtualRow.index];
                          const closing = parseInt(item.closing) || 0;
                          const isLowStock = closing > 0 && closing < lowStockThreshold;
                          const isOutOfStock = closing === 0;
                          const isSelected = selectedItems.has(item.code);
                          
                          return (
                            <tr 
                              key={item.id || item.code || virtualRow.index} 
                              ref={rowVirtualizer.measureElement} 
                              data-index={virtualRow.index} 
                              className={isSelected ? 'selected' : ''}
                            >
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleSelect(item.code)}
                                />
                              </td>
                              <td style={{ fontWeight: 500 }}>{item.item}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{item.code}</td>
                              <td style={{ fontWeight: 700 }}>{item.closing}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{getCategoryLabel(item.categoryId)}</td>
                              <td>
                                {isOutOfStock ? (
                                  <span className="badge badge-danger">
                                    <AlertCircle size={12} /> Out of Stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="badge badge-warning">
                                    <AlertTriangle size={12} /> Low Stock
                                  </span>
                                ) : (
                                  <span className="badge badge-success">
                                    <CheckCircle2 size={12} /> Good
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className="btn-icon" onClick={() => onEdit(item)} title="Edit item">
                                  <Edit2 size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}></tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="mobile-item-list" style={{ padding: 'var(--sp-4)' }}>
                <AnimatePresence>
                  {sortedInventory.map(item => {
                    const closing = parseInt(item.closing) || 0;
                    const isLowStock = closing > 0 && closing < lowStockThreshold;
                    const isOutOfStock = closing <= 0;

                    return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={item.code} 
                        className="mobile-item-card"
                      >
                        <div className="mobile-item-info">
                          <div className="mobile-item-name">
                            {item.item}
                            {isOutOfStock && <span className="status-dot danger" />}
                            {isLowStock && <span className="status-dot warning" />}
                          </div>
                          <div className="mobile-item-meta">
                            {item.code} · {getCategoryLabel(item.categoryId)}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <div className="mobile-item-stock">
                            <div className="mobile-item-stock-value" style={{ 
                              color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--text-primary)' 
                            }}>
                              {item.closing}
                            </div>
                            <div className="mobile-item-stock-label">Stock</div>
                          </div>
                          <button className="btn-icon" onClick={() => onEdit(item)}>
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
