import { useState } from 'react';
import { X, Save, Loader2, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EditProductDetailsModal({ item, categories = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    code: item.code || '',
    item: item.item || '',
    categoryId: item.categoryId || '',
    unit: item.unit || '',
    cost: item.cost || '',
    price: item.price || '',
    minStockLevel: item.minStockLevel || '10'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...item,
      ...formData,
      categoryId: parseInt(formData.categoryId) || null,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      minStockLevel: parseInt(formData.minStockLevel) || 0
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
        style={{ maxWidth: 500 }}
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
          </div>

          <div className="modal-footer">
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
