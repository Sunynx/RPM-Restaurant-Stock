import { useState, useMemo } from 'react';
import { X, Plus, Minus, ArrowRight, Package, ShoppingCart, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EditModal({ item, onClose, onSave, userRole }) {
  const [mode, setMode] = useState(null); // null = choose, 'add' = receive, 'use' = deduct
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('sales'); // 'sales' | 'ent'
  const [remark, setRemark] = useState('');
  const [receiveCost, setReceiveCost] = useState('');

  const currentStock = parseInt(item.stockOnHand) || 0;
  const qty = parseInt(quantity) || 0;

  const newStock = useMemo(() => {
    if (mode === 'add') return currentStock + qty;
    if (mode === 'use') return currentStock - qty;
    return currentStock;
  }, [mode, currentStock, qty]);

  const willGoNegative = mode === 'use' && newStock < 0;
  const canSave = qty > 0 && (mode === 'add' || (mode === 'use' && (!willGoNegative || (remark && remark.trim() !== ''))));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;

    let updatedCost = item.cost;
    if (mode === 'add' && receiveCost && parseFloat(receiveCost) > 0) {
      const currentAvgCost = parseFloat(item.cost) || 0;
      const totalCurrentValue = currentStock * currentAvgCost;
      const totalReceivedValue = parseFloat(receiveCost);
      const computedAvgCost = (totalCurrentValue + totalReceivedValue) / newStock;
      updatedCost = parseFloat(computedAvgCost.toFixed(2));
    }

    const saveData = {
      ...item,
      cost: updatedCost,
      issued: mode === 'add' ? qty : 0,
      sales: mode === 'use' && reason === 'sales' ? qty : 0,
      ent: mode === 'use' && reason === 'ent' ? qty : 0,
      closing: newStock,
      remarks: remark.trim()
    };
    onSave(saveData);
  };

  const increment = () => setQuantity(prev => String((parseInt(prev) || 0) + 1));
  const decrement = () => setQuantity(prev => {
    const val = (parseInt(prev) || 0) - 1;
    return val < 0 ? '0' : String(val);
  });

  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div 
        className="modal-content"
        style={{ maxWidth: 400 }}
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="modal-title" style={{ fontSize: 16 }}>{item.item}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {item.code}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Current Stock Display */}
        <div className="stock-display-current">
          <span className="stock-display-label">Current Stock</span>
          <span className="stock-display-number">{currentStock}</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Mode Selection */}
          {mode === null ? (
            <div className="stock-mode-selector">
              <button 
                type="button"
                className="stock-mode-btn add"
                onClick={() => setMode('add')}
              >
                <div className="stock-mode-icon add">
                  <Plus size={22} />
                </div>
                <div>
                  <div className="stock-mode-title">Receive</div>
                  <div className="stock-mode-desc">Receive new products</div>
                </div>
              </button>
              {currentStock > 0 && (
                <button 
                  type="button"
                  className="stock-mode-btn use"
                  onClick={() => setMode('use')}
                >
                  <div className="stock-mode-icon use">
                    <Minus size={22} />
                  </div>
                  <div>
                    <div className="stock-mode-title">Sales / ENT</div>
                    <div className="stock-mode-desc">Use / Remove products</div>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Mode Header */}
                <button 
                  type="button"
                  className="stock-mode-back"
                  onClick={() => { setMode(null); setQuantity(''); setReason('sales'); setRemark(''); }}
                >
                  <div className={`stock-mode-icon-sm ${mode}`}>
                    {mode === 'add' ? <Plus size={14} /> : <Minus size={14} />}
                  </div>
                  <span>{mode === 'add' ? 'Receive' : 'Sales / ENT'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Change</span>
                </button>

                {/* Reason (only for Use mode) */}
                {mode === 'use' && (
                  <div className="stock-reason-row">
                    <button 
                      type="button"
                      className={`stock-reason-chip ${reason === 'sales' ? 'active' : ''}`}
                      onClick={() => setReason('sales')}
                    >
                      <ShoppingCart size={14} />
                      Sales
                    </button>
                    <button 
                      type="button"
                      className={`stock-reason-chip ${reason === 'ent' ? 'active' : ''}`}
                      onClick={() => setReason('ent')}
                    >
                      <Trash2 size={14} />
                      Spoilage / ENT
                    </button>
                  </div>
                )}

                {/* Quantity Input with Stepper */}
                <div className="stock-stepper">
                  <button 
                    type="button" 
                    className="stock-stepper-btn"
                    onClick={decrement}
                    disabled={qty <= 0}
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    className="stock-stepper-input"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                  <button 
                    type="button" 
                    className="stock-stepper-btn"
                    onClick={increment}
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Quick amount buttons */}
                <div className="stock-quick-amounts">
                  {[1, 5, 10, 20, 50].map(n => (
                    <button 
                      key={n}
                      type="button"
                      className={`stock-quick-btn ${qty === n ? 'active' : ''}`}
                      onClick={() => setQuantity(String(n))}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* Stock Preview */}
                {qty > 0 && (
                  <motion.div 
                    className="stock-preview"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div className="stock-preview-row">
                      <span className="stock-preview-old">{currentStock}</span>
                      <ArrowRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                      <span className={`stock-preview-new ${willGoNegative ? 'negative' : mode === 'add' ? 'positive' : ''}`}>
                        {newStock}
                      </span>
                    </div>
                    {willGoNegative && (
                      <p className="stock-preview-warning">
                        ⚠️ Stock will be negative — Please verify
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Receive Cost (Optional) */}
                {mode === 'add' && qty > 0 && (
                  <div style={{ marginTop: 'var(--sp-4)', padding: '0 var(--sp-4)' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                      Total Cost (Optional)
                    </label>
                    <input 
                      type="number" 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-body)', color: 'var(--text-primary)', outline: 'none' }}
                      placeholder="Enter total cost for this batch..."
                      value={receiveCost}
                      onChange={(e) => setReceiveCost(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    {receiveCost && parseFloat(receiveCost) > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 'var(--sp-1)' }}>
                        ≈ ฿{(parseFloat(receiveCost) / qty).toFixed(2)} / unit 
                        | New Avg Cost: ฿{(((currentStock * (parseFloat(item.cost)||0)) + parseFloat(receiveCost)) / newStock).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                {/* Remark (Optional, but required if negative) */}
                <div style={{ marginTop: 'var(--sp-4)', padding: '0 var(--sp-4)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: (mode === 'use' && willGoNegative) ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                    Remark {(mode === 'use' && willGoNegative) ? `(Required: Stock will be ${newStock})` : '(Optional)'}
                  </label>
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-body)', color: 'var(--text-primary)', outline: 'none' }}
                    placeholder="Enter remark..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                </div>


                {/* Actions */}
                <div className="stock-actions">
                  <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={`btn ${mode === 'add' ? 'stock-btn-add' : 'stock-btn-use'}`}
                    disabled={!canSave}
                    style={{ flex: 2, opacity: canSave ? 1 : 0.4 }}
                  >
                    {mode === 'add' ? (
                      <><Plus size={16} /> Save {qty > 0 ? qty : ''}</>
                    ) : (
                      <><Minus size={16} /> Save {qty > 0 ? qty : ''}</>
                    )}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}
