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
  const lowStockItems = inventory.filter(i => i.closing < lowStockThreshold);
  const outOfStockItems = inventory.filter(i => (parseInt(i.closing) || 0) === 0);
  const totalStock = inventory.reduce((sum, item) => sum + (parseInt(item.closing) || 0), 0);

  let totalCOGS = 0;

  const enrichedTransactions = transactions.map(t => {
    const product = inventory.find(i => String(i.id) === String(t.productId));
    return {
      ...t,
      code: product?.code || '-',
      item: product?.item || 'Unknown Item',
      displayDate: t.date ? t.date.split('T')[0] : '—'
    };
  });

  enrichedTransactions.forEach(t => {
    if ((t.type || '').toLowerCase() === 'sales') {
      const product = inventory.find(i => String(i.id) === String(t.productId));
      if (product) {
        totalCOGS += Math.abs(t.quantity) * (parseFloat(product.price) || 0);
      }
    }
  });

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
        itemMovementMap[t.item] = { name: t.item || t.code, quantity: 0 };
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
        {userRole === 'Admin' && (
          <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'all' })}>
            <div className="kpi-icon indigo">
              <DollarSign size={20} />
            </div>
            <div className="kpi-label">Cost of Goods Sold (COGS)</div>
            <div className="kpi-value">฿{totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </motion.div>
        )}
        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'all' })}>
          <div className="kpi-icon indigo">
            <PackageOpen size={20} />
          </div>
          <div className="kpi-label">Total Stock (Vol.)</div>
          <div className="kpi-value">{totalStock.toLocaleString()}</div>
        </motion.div>

        <motion.div variants={itemVariants} className="kpi-card" onClick={() => onNavigate({ filterStatus: 'all' })}>
          <div className="kpi-icon emerald">
            <Box size={20} />
          </div>
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{totalItems}</div>
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
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Top Movers */}
        <motion.div variants={itemVariants} className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Top Movers</h3>
              <p className="chart-subtitle">Most used items by volume</p>
            </div>
          </div>
          <div className="chart-area">
            {topMovers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMovers} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="var(--text-secondary)" 
                    fontSize={12} 
                    fontWeight={500} 
                    tickLine={false} 
                    axisLine={false} 
                    width={100} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <Bar 
                    dataKey="quantity" 
                    name="Quantity" 
                    fill="url(#barGradient)" 
                    radius={[0, 6, 6, 0]} 
                    barSize={14}
                    onClick={(data) => {
                      if (data?.name) {
                        onNavigate({ searchTerm: data.name });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No sales data available</div>
            )}
          </div>
        </motion.div>

        {/* Stock Movement */}
        {trendChartData.length > 0 ? (
          <motion.div variants={itemVariants} className="chart-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Stock Movement</h3>
                <p className="chart-subtitle">Activity trend over time</p>
              </div>
            </div>
            <div className="chart-area">
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
            </div>
          </motion.div>
        ) : (
          <div />
        )}
      </div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Activity</h3>
            <p className="card-subtitle">Latest inventory transactions</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate()}>
            View All
          </button>
        </div>
        
        {recentTransactions.length > 0 ? (
          <div className="dashboard-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Date</th>
                  <th>Quantity</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx, idx) => (
                  <tr 
                    key={idx}
                    onClick={() => onNavigate({ searchTerm: tx.item || tx.code })}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {tx.code || '—'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{tx.item}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.displayDate}</td>
                    <td style={{ fontWeight: 700 }}>{tx.quantity}</td>
                    <td>
                      <span className={`badge ${
                        tx.type?.toLowerCase() === 'receive' ? 'badge-success' : 
                        tx.type?.toLowerCase() === 'sales' ? 'badge-info' : 
                        'badge-warning'
                      }`}>
                        {tx.type?.toLowerCase() === 'receive' ? 'Received' : 
                         tx.type?.toLowerCase() === 'sales' ? 'Sales' : 
                         tx.type || 'Other'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
