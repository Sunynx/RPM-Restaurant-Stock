import { useState } from 'react';
import { Shield, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminPanel({ users, onAddUser, onRemoveUser }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Staff');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await onAddUser({ email, role });
    setEmail('');
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-container"
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
        
        <form onSubmit={handleAdd} className="admin-form-row" style={{ paddingLeft: 56 }}>
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
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: 44, flexShrink: 0 }}>
            {loading ? <Loader2 size={16} className="spin" /> : <><Plus size={16} /> Add User</>}
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
                <th style={{ paddingRight: 'var(--sp-6)', textAlign: 'right' }}>Actions</th>
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
                  <td style={{ paddingRight: 'var(--sp-6)', textAlign: 'right' }}>
                    <button className="btn-icon" onClick={() => onRemoveUser(u.id)} title="Remove user">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: 'var(--sp-12)', color: 'var(--text-tertiary)' }}>
                    No users found. Anyone can access currently.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
