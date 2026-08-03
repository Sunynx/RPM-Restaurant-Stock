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
        <div className="inventory-toolbar" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="toolbar-top">
            <div className="skeleton" style={{ height: 36, width: 250, borderRadius: 'var(--radius-md)' }}></div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <div className="skeleton" style={{ height: 32, width: 80, borderRadius: 'var(--radius-md)' }}></div>
              <div className="skeleton" style={{ height: 32, width: 80, borderRadius: 'var(--radius-md)' }}></div>
              <div className="skeleton" style={{ height: 32, width: 80, borderRadius: 'var(--radius-md)' }}></div>
            </div>
          </div>
          <div className="filter-chips">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ height: 32, width: 100, borderRadius: 'var(--radius-full)' }}></div>
            ))}
          </div>
        </div>
        {/* Table Rows */}
        <div className="data-table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
          <table className="data-table">
            <thead>
               <tr>
                 <th style={{ width: 44 }}></th>
                 <th><div className="skeleton" style={{ height: 16, width: '50%' }}></div></th>
                 <th><div className="skeleton" style={{ height: 16, width: '40%' }}></div></th>
                 <th><div className="skeleton" style={{ height: 16, width: '30%' }}></div></th>
                 <th><div className="skeleton" style={{ height: 16, width: '60%' }}></div></th>
                 <th><div className="skeleton" style={{ height: 16, width: '40%' }}></div></th>
                 <th style={{ width: 64 }}></th>
               </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <tr key={i}>
                  <td><div className="skeleton" style={{ height: 16, width: 16, borderRadius: 4 }}></div></td>
                  <td><div className="skeleton" style={{ height: 20, width: '70%' }}></div></td>
                  <td><div className="skeleton" style={{ height: 16, width: '50%' }}></div></td>
                  <td><div className="skeleton" style={{ height: 20, width: '40%' }}></div></td>
                  <td><div className="skeleton" style={{ height: 20, width: '80%' }}></div></td>
                  <td><div className="skeleton" style={{ height: 24, width: 60, borderRadius: 12 }}></div></td>
                  <td><div className="skeleton" style={{ height: 28, width: 28, borderRadius: '50%' }}></div></td>
                </tr>
              ))}
            </tbody>
          </table>
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
