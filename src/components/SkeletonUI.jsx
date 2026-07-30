export default function SkeletonUI({ type }) {
  if (type === 'dashboard') {
    return (
      <div>
        {/* KPI Cards */}
        <div className="kpi-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton skeleton-card" style={{ height: 130 }}></div>
          ))}
        </div>
        {/* Charts */}
        <div className="charts-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }}></div>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }}></div>
        </div>
        {/* Table */}
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-xl)' }}></div>
      </div>
    );
  }

  if (type === 'inventory') {
    return (
      <div>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <div className="skeleton" style={{ height: 40, flex: 1, borderRadius: 'var(--radius-full)' }}></div>
          <div className="skeleton" style={{ height: 40, width: 80, borderRadius: 'var(--radius-md)' }}></div>
          <div className="skeleton" style={{ height: 40, width: 80, borderRadius: 'var(--radius-md)' }}></div>
        </div>
        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 34, width: 100, borderRadius: 'var(--radius-full)' }}></div>
          ))}
        </div>
        {/* Table Rows */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="skeleton" style={{ height: 48, borderRadius: 0 }}></div>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--sp-4)' }}>
              <div className="skeleton" style={{ height: 18, width: '30%' }}></div>
              <div className="skeleton" style={{ height: 18, width: '15%' }}></div>
              <div className="skeleton" style={{ height: 18, width: '12%' }}></div>
              <div className="skeleton" style={{ height: 18, width: '15%' }}></div>
              <div className="skeleton" style={{ height: 18, width: '18%' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default / Admin skeleton
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-xl)', marginBottom: 'var(--sp-6)' }}></div>
      <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }}></div>
    </div>
  );
}
