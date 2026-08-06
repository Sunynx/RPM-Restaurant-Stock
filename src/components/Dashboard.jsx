import { PackageOpen, AlertTriangle, TrendingUp, Box, AlertCircle, CheckCircle2, DollarSign, FileText, Clock, ChevronDown, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Dashboard({ inventory, categories = [], lowStockThreshold, onNavigate, transactions = [], userRole = 'Staff' }) {
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(i => {
    const closing = parseInt(i.closing) || 0;
    const minStock = parseInt(i.minStockLevel) || lowStockThreshold;
    return closing > 0 && closing <= minStock;
  });
  const outOfStockItems = inventory.filter(i => (parseInt(i.closing) || 0) <= 0);

  const handleNavigate = (params) => {
    if (window.innerWidth <= 768) return;
    onNavigate(params);
  };
  const totalStock = inventory.reduce((sum, item) => sum + (parseInt(item.closing) || 0), 0);
  const totalStockValue = inventory.reduce((sum, item) => sum + ((parseInt(item.closing) || 0) * (parseFloat(item.cost) || 0)), 0);

  const inventoryMap = useMemo(() => new Map(inventory.map(p => [String(p.id), p])), [inventory]);

  const { enrichedTransactions, totalCOGS } = useMemo(() => {
    let cogs = 0;
    const enriched = transactions.map(t => {
      const product = inventoryMap.get(String(t.productId));
      if ((t.type || '').toLowerCase() === 'sales' && product) {
        cogs += Math.abs(t.quantity) * (parseFloat(product.cost) || 0);
      }
      return {
        ...t,
        code: product?.code || '-',
        item: product?.item || 'Unknown Item',
        displayDate: t.date ? t.date.split('T')[0] : '—'
      };
    });
    return { enrichedTransactions: enriched, totalCOGS: cogs };
  }, [transactions, inventoryMap]);

  // Group transactions by date for the chart
  const chartDataMap = {};
  enrichedTransactions.forEach(t => {
    const displayDate = t.displayDate;
    if (displayDate === '—') return;
    if (!chartDataMap[displayDate]) {
      chartDataMap[displayDate] = { date: displayDate, sales: 0, receive: 0 };
    }
    const type = (t.type || '').toLowerCase();
    if (type === 'sales' || type === 'ent') {
      chartDataMap[displayDate].sales += t.quantity;
    } else if (type === 'receive' || type === 'adjustment') {
      chartDataMap[displayDate].receive += t.quantity;
    }
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => {
    if (!a.date || !b.date || typeof a.date !== 'string' || typeof b.date !== 'string') return 0;
    const aParts = a.date.split('/');
    const bParts = b.date.split('/');
    if (aParts.length === 3 && bParts.length === 3) {
      const [d1, m1, y1] = aParts;
      const [d2, m2, y2] = bParts;
      return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
    }
    return new Date(a.date) - new Date(b.date);
  }).slice(-7);

  // Trend Chart Data
  const trendChartData = chartData.map(d => ({
    ...d,
    totalActivity: d.sales + d.receive
  }));

  // Top 5 Sellers (Top Movers)
  const itemMovementMap = {};
  enrichedTransactions.forEach(t => {
    const type = (t.type || '').toLowerCase();
    if (type === 'sales' || type === 'ent') {
      if (!itemMovementMap[t.item]) {
        itemMovementMap[t.item] = { name: t.item || t.code, quantity: 0, code: t.code };
      }
      itemMovementMap[t.item].quantity += Math.abs(t.quantity);
    }
  });
  const topMovers = Object.values(itemMovementMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Recent Transactions
  const recentTransactions = [...enrichedTransactions].reverse().slice(0, 5);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-lg)',
        fontSize: '13px'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{label}</div>
        {payload.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: entry.color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* KPI Cards */}
      <div className="kpi-grid">

        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'all' })}>
          <div className="kpi-icon emerald">
            <Box size={20} />
          </div>
          <div className="kpi-label">Total Products</div>
          <div className="kpi-value">{totalItems}</div>
        </motion.div>

        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'all' })}>
          <div className="kpi-icon indigo">
            <PackageOpen size={20} />
          </div>
          <div className="kpi-label">Total Quantity</div>
          <div className="kpi-value">{totalStock.toLocaleString()}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'low' })}>
          <div className="kpi-icon amber">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-label">Low Stock</div>
          <div className="kpi-value">{lowStockItems.length}</div>
          {lowStockItems.length > 0 && (
            <span className="badge badge-warning" style={{ marginTop: 8 }}>
              <AlertTriangle size={12} /> Needs attention
            </span>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'out' })}>
          <div className="kpi-icon rose">
            <AlertCircle size={20} />
          </div>
          <div className="kpi-label">Out of Stock</div>
          <div className="kpi-value">{outOfStockItems.length}</div>
          {outOfStockItems.length > 0 && (
            <span className="badge badge-danger" style={{ marginTop: 8 }}>
              <AlertCircle size={12} /> Critical
            </span>
          )}
        </motion.div>

        {['Admin', 'Manager'].includes(userRole) && (
          <motion.div variants={itemVariants} className="kpi-card">
            <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <DollarSign size={20} />
            </div>
            <div className="kpi-label">Inventory Value</div>
            <div className="kpi-value">฿{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </motion.div>
        )}

        {['Admin', 'Manager'].includes(userRole) && (
          <motion.div variants={itemVariants} className="kpi-card">
            <div className="kpi-icon" style={{ background: 'var(--bg-active)', color: 'var(--text-secondary)' }}>
              <Activity size={20} />
            </div>
            <div className="kpi-label">Total COGS</div>
            <div className="kpi-value">฿{totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </motion.div>
        )}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Top Movers */}
        <motion.div variants={itemVariants} className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Top Movers</h3>
              <p className="chart-subtitle">Most used products by volume</p>
            </div>
          </div>
          <div className="chart-area">
            {topMovers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0', height: '100%', overflowY: 'auto' }}>
                {topMovers.map((item, index) => {
                  const maxQty = topMovers[0]?.quantity || 1;
                  const pct = (item.quantity / maxQty) * 100;
                  return (
                    <div 
                      key={index} 
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onClick={() => handleNavigate({ searchTerm: item.name })}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, gap: 8 }}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)', flex: 1 }} title={item.name}>
                            {item.code && item.code !== '-' ? <span style={{ color: 'var(--text-tertiary)', marginRight: 4 }}>[{item.code}]</span> : null}
                            {item.name}
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{item.quantity}</div>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-active)', borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${pct}%` }} 
                            transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                            style={{ height: '100%', background: 'var(--primary)', borderRadius: 3 }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chart-empty">No sales data available</div>
            )}
          </div>
        </motion.div>

        {/* Stock Movement */}
        <motion.div variants={itemVariants} className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Stock Movement</h3>
              <p className="chart-subtitle">Activity trend over time</p>
            </div>
          </div>
          <div className="chart-area">
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendChartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                  <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="totalActivity" 
                    name="Total Activity" 
                    stroke="var(--primary)" 
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, fill: 'var(--bg-card)', strokeWidth: 2, stroke: 'var(--primary)' }} 
                    activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--bg-card)', strokeWidth: 3 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No activity data available</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Activity</h3>
            <p className="card-subtitle">Latest inventory transactions</p>
          </div>
        </div>
        
        {recentTransactions.length > 0 ? (
          <div className="activity-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {recentTransactions.map((tx, idx) => (
              <div 
                key={idx}
                onClick={() => handleNavigate({ searchTerm: tx.item || tx.code })}
                style={{ 
                  display: 'flex',  
                  alignItems: 'center', 
                  padding: 'var(--sp-4)', 
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  gap: 'var(--sp-4)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge ${
                      tx.type?.toLowerCase() === 'receive' ? 'badge-success' : 
                      tx.type?.toLowerCase() === 'sales' ? 'badge-info' : 
                      'badge-warning'
                    }`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                      {tx.type?.toUpperCase() || 'OTHER'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {tx.displayDate}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.item}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Code: #{tx.code || '—'}
                  </div>
                </div>

                <div style={{ 
                  fontWeight: 700, 
                  fontSize: 16,
                  color: tx.quantity > 0 ? 'var(--success)' : tx.quantity < 0 ? 'var(--danger)' : 'var(--text-primary)'
                }}>
                  {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--sp-10)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Activity size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p>No recent transactions</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
