import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Edit2, Edit3, Package, Plus, ArrowUpDown, ArrowUp, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InventoryList({ inventory, categories, lowStockThreshold, onEdit, onEditDetails, onAddProduct, userRole, initialFilters, onFiltersConsumed }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategories, setFilterCategories] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [lastEditedId, setLastEditedId] = useState(null);
  const parentRef = useRef(null);

  // Clear lastEditedId when filters change
  useEffect(() => {
    setLastEditedId(null);
  }, [filterStatus, filterCategories, searchTerm]);

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

  const toggleSelect = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === sortedInventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(sortedInventory.map(i => i.id)));
    }
  };

  const filteredInventory = inventory.filter(item => {
    const searchLower = String(searchTerm || '').toLowerCase();
    const matchesSearch = String(item.item || '').toLowerCase().includes(searchLower) || 
                          String(item.code || '').toLowerCase().includes(searchLower);
    
    let matchesStatus = true;
    const closing = parseInt(item.closing) || 0;
    const minStock = parseInt(item.minStockLevel) || lowStockThreshold;
    const isRecentlyEdited = item.id === lastEditedId;
    
    if (filterStatus === 'low') matchesStatus = (closing > 0 && closing <= minStock) || isRecentlyEdited;
    if (filterStatus === 'out') matchesStatus = closing <= 0 || isRecentlyEdited;

    const matchesCategory = filterCategories.length === 0 ? true : filterCategories.includes(item.categoryId);
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sortedInventory = useMemo(() => {
    return [...filteredInventory].sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'status') {
        const getStatusPriority = (item) => {
          const closing = parseInt(item.closing) || 0;
          const minStock = parseInt(item.minStockLevel) || lowStockThreshold;
          if (closing <= 0) return 0; // Out of stock
          if (closing <= minStock) return 1; // Low stock
          return 2; // Good
        };
        aVal = getStatusPriority(a);
        bVal = getStatusPriority(b);
      } else if (sortConfig.key === 'value') {
        aVal = (parseInt(a.closing) || 0) * (parseFloat(a.cost) || 0);
        bVal = (parseInt(b.closing) || 0) * (parseFloat(b.cost) || 0);
      } else if (sortConfig.key === 'price' || sortConfig.key === 'cost') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortConfig.key === 'closing') {
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
  const lowCount = inventory.filter(i => {
    const closing = parseInt(i.closing) || 0;
    const minStock = parseInt(i.minStockLevel) || lowStockThreshold;
    return closing > 0 && closing <= minStock;
  }).length;
  const outCount = inventory.filter(i => (parseInt(i.closing) || 0) <= 0).length;



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
                  placeholder="Search products or code..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="toolbar-actions">
              {['Admin', 'Manager'].includes(userRole) && (
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
              <p>No products found.</p>
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
                      <span className="batch-bar-label">{selectedItems.size} product(s) selected</span>
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
                      <SortHeader label="Code" sortKey="code" />
                      <SortHeader label="Product Name" sortKey="item" />
                      <SortHeader label="Category" sortKey="categoryId" />
                      <SortHeader label="Quantity" sortKey="closing" />
                      {['Admin', 'Manager'].includes(userRole) && <SortHeader label="Price" sortKey="price" />}
                      {['Admin', 'Manager'].includes(userRole) && <SortHeader label="Value" sortKey="value" />}
                      <SortHeader label="Status" sortKey="status" />
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
                          const minStock = parseInt(item.minStockLevel) || lowStockThreshold;
                          const isLowStock = closing > 0 && closing <= minStock;
                          const isOutOfStock = closing <= 0;
                          const isSelected = selectedItems.has(item.id);
                          
                          return (
                            <tr 
                              key={item.id} 
                              ref={rowVirtualizer.measureElement} 
                              data-index={virtualRow.index} 
                              className={isSelected ? 'selected' : ''}
                            >
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleSelect(item.id)}
                                />
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{item.code}</td>
                              <td style={{ fontWeight: 500 }}>{item.item}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{getCategoryLabel(item.categoryId)}</td>
                              <td style={{ fontWeight: 700 }}>{item.closing}</td>
                              {['Admin', 'Manager'].includes(userRole) && <td style={{ color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '12px' }}>Cost: ฿{item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div>Price: ฿{item.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              </td>}
                              {['Admin', 'Manager'].includes(userRole) && <td style={{ fontWeight: 600, textAlign: 'right' }}>฿{(item.closing * (item.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
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
                                <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'center' }}>
                                  <button className="btn-icon" onClick={() => { setLastEditedId(item.id); onEdit(item); }} title="Adjust Stock">
                                    <Package size={14} />
                                  </button>
                                  {['Admin', 'Manager'].includes(userRole) && (
                                    <button className="btn-icon" onClick={() => { setLastEditedId(item.id); onEditDetails(item); }} title="Edit Details">
                                      <Edit3 size={14} />
                                    </button>
                                  )}
                                </div>
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
                    const minStock = parseInt(item.minStockLevel) || lowStockThreshold;
                    const isLowStock = closing > 0 && closing <= minStock;
                    const isOutOfStock = closing <= 0;

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={item.id} 
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
                            {['Admin', 'Manager'].includes(userRole) && ` · Cost: ฿${item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Price: ฿${item.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                          {['Admin', 'Manager'].includes(userRole) && (
                            <div className="mobile-item-stock">
                              <div className="mobile-item-stock-value" style={{ 
                                color: 'var(--text-primary)', 
                                fontWeight: 600 
                              }}>
                                ฿{(item.closing * (item.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="mobile-item-stock-label">Value</div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                            <button className="btn-icon" onClick={() => { setLastEditedId(item.id); onEdit(item); }}>
                              <Package size={15} />
                            </button>
                            {['Admin', 'Manager'].includes(userRole) && (
                              <button className="btn-icon" onClick={() => { setLastEditedId(item.id); onEditDetails(item); }}>
                                <Edit3 size={15} />
                              </button>
                            )}
                          </div>
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
