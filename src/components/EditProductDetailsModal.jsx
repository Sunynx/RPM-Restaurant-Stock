import { useState } from 'react';
import { X, Save, Loader2, Edit3, SlidersHorizontal, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EditProductDetailsModal({ item, categories = [], onClose, onSave, userRole = 'Staff' }) {
  const [formData, setFormData] = useState({
    code: item.code || '',
    item: item.item || '',
    categoryId: item.categoryId || '',
    unit: item.unit || '',
    cost: item.cost || '',
    price: item.price || '',
    minStockLevel: item.minStockLevel || '10',
    stockOnHand: item.stockOnHand || '0'
  });
  const [adjustmentReason, setAdjustmentReason] = useState('Initial Stock Setup');
  const [adjustmentRemarks, setAdjustmentRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = userRole === 'Admin';
  const oldStock = parseInt(item.stockOnHand, 10) || 0;
  const currentInputStock = parseInt(formData.stockOnHand, 10) || 0;
  const isStockChanged = currentInputStock !== oldStock;
  const stockDiff = currentInputStock - oldStock;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isStockChanged && !isAdmin) {
      return;
    }
    setSaving(true);
    const finalReason = isStockChanged ? adjustmentReason : undefined;
    const finalRemarks = isStockChanged 
      ? (adjustmentRemarks.trim() ? `${adjustmentReason}: ${adjustmentRemarks.trim()}` : adjustmentReason)
      : undefined;

    await onSave({
      ...item,
      ...formData,
      categoryId: parseInt(formData.categoryId) || null,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      minStockLevel: parseInt(formData.minStockLevel) || 0,
      stockOnHand: isAdmin ? currentInputStock : oldStock,
      oldStockOnHand: oldStock,
      adjustmentReason: finalReason,
      adjustmentRemarks: adjustmentRemarks.trim(),
      remarks: finalRemarks
    });
    setSaving(false);
  };

  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="modal-content"
        style={{ maxWidth: 520 }}
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <Edit3 size={20} style={{ color: 'var(--primary)' }} />
            Edit Product Details
          </h2>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', marginTop: '-var(--sp-3)' }}>
          Update the metadata for this product.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Product Code</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 1001"
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Product Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Red Wine"
                value={formData.item}
                onChange={e => setFormData({...formData, item: e.target.value})}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Category</label>
              <select 
                className="form-input" 
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Unit</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Bottle, KG"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Cost (฿)</label>
              <input 
                type="number" 
                className="form-input" 
                min="0" step="0.01"
                value={formData.cost}
                onChange={e => setFormData({...formData, cost: e.target.value})}
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Price (฿)</label>
              <input 
                type="number" 
                className="form-input" 
                min="0" step="0.01"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Min Stock Level</label>
              <input 
                type="number" 
                className="form-input" 
                min="0"
                value={formData.minStockLevel}
                onChange={e => setFormData({...formData, minStockLevel: e.target.value})}
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Current Stock</span>
                {!isAdmin && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <Lock size={10} /> Admin only
                  </span>
                )}
              </label>
              <input 
                type="number" 
                className="form-input" 
                min="0"
                value={formData.stockOnHand}
                onChange={e => {
                  if (isAdmin) setFormData({...formData, stockOnHand: e.target.value});
                }}
                disabled={!isAdmin}
                title={!isAdmin ? "เฉพาะ Admin เท่านั้นที่สามารถปรับยอดสต็อกโดยตรงได้" : undefined}
                style={!isAdmin ? { opacity: 0.7, cursor: 'not-allowed', background: 'var(--bg-subtle)' } : {}}
              />
            </div>
          </div>

          {/* Admin Stock Adjustment Reason Box */}
          <AnimatePresence>
            {isAdmin && isStockChanged && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                style={{
                  padding: 'var(--sp-4)',
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontWeight: 700, fontSize: 13, color: '#8b5cf6' }}>
                    <SlidersHorizontal size={16} />
                    <span>Admin Stock Adjustment</span>
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: 11 }}>
                    {stockDiff > 0 ? `+${stockDiff}` : stockDiff} {formData.unit || 'units'}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
                  สต็อกเดิม: <b>{oldStock}</b> ➔ ปรับเป็น: <b>{currentInputStock}</b> (ผลต่าง: <b style={{ color: stockDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>{stockDiff > 0 ? `+${stockDiff}` : stockDiff}</b>)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>เหตุผลในการปรับยอด (Adjustment Reason) *</label>
                    <select 
                      className="form-input"
                      value={adjustmentReason}
                      onChange={e => setAdjustmentReason(e.target.value)}
                      required
                      style={{ fontSize: 13 }}
                    >
                      <option value="Initial Stock Setup">ตั้งค่ายอดสต็อกเริ่มต้นใหม่ (Initial Stock Setup)</option>
                      <option value="Physical Stock Count">ตรวจนับสต็อกจริง (Physical Stock Count)</option>
                      <option value="Damaged / Spoiled">สินค้าชำรุดเสียหาย (Damaged / Spoiled)</option>
                      <option value="Lost / Missing">สินค้าสูญหาย (Lost / Missing)</option>
                      <option value="Correction / Other">แก้ไขข้อผิดพลาด / อื่นๆ (Correction / Other)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12 }}>หมายเหตุเพิ่มเติม (Remarks / Notes)</label>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="เช่น ปรับสต็อกตั้งต้นตามคำสั่ง ผจก. หรือ ผลการนับสต็อกปลายสัปดาห์"
                      value={adjustmentRemarks}
                      onChange={e => setAdjustmentRemarks(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="modal-footer" style={{ marginTop: 'var(--sp-6)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              Save Details
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
