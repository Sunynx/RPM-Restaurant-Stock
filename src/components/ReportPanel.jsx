import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, RefreshCw, Package, TrendingDown, Activity, Search, FileDown } from 'lucide-react';
import { fetchAuditLogs, fetchTransactions } from '../graphService';
import toast from 'react-hot-toast';
import { useMsal } from '@azure/msal-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CHART_COLORS = ['#4f6ef7', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];

export default function ReportPanel({ inventory, categories = [] }) {
  const { instance, accounts } = useMsal();
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('daily');
  const [activeSection, setActiveSection] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const account = accounts[0];
      const response = await instance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All'],
        account: account
      });
      const [logData, txData] = await Promise.all([
        fetchAuditLogs(response.accessToken),
        fetchTransactions(response.accessToken)
      ]);
      setLogs(logData);
      setTransactions(txData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter(log => {
      const logDate = new Date(log.date);
      if (filter === 'daily') return logDate.toDateString() === now.toDateString();
      if (filter === 'monthly') return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [logs, filter]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (filter === 'daily') return txDate.toDateString() === now.toDateString();
      if (filter === 'monthly') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, filter]);

  const stats = useMemo(() => {
    const totalProducts = inventory.length;
    const totalStock = inventory.reduce((sum, p) => sum + (parseInt(p.stockOnHand) || 0), 0);
    const lowStock = inventory.filter(p => {
      const stock = parseInt(p.stockOnHand) || 0;
      const min = parseInt(p.minStockLevel) || 0;
      return stock > 0 && stock <= min;
    }).length;
    const outOfStock = inventory.filter(p => (parseInt(p.stockOnHand) || 0) <= 0).length;
    const salesQty = filteredTransactions.filter(t => t.type === 'Sales').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const entQty = filteredTransactions.filter(t => t.type === 'ENT').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const receiveQty = filteredTransactions.filter(t => t.type === 'Receive').reduce((s, t) => s + Math.abs(t.quantity), 0);
    const totalMovements = filteredTransactions.length;
    return { totalProducts, totalStock, lowStock, outOfStock, salesQty, entQty, receiveQty, totalMovements };
  }, [inventory, filteredTransactions]);

  const inventorySearched = useMemo(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(p =>
      (p.item || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  // Chart data
  const stockStatusData = useMemo(() => {
    const active = inventory.filter(p => {
      const s = parseInt(p.stockOnHand) || 0;
      const m = parseInt(p.minStockLevel) || 0;
      return s > m;
    }).length;
    return [
      { name: 'Good', value: active, color: '#10b981' },
      { name: 'Low Stock', value: stats.lowStock, color: '#f59e0b' },
      { name: 'Out of Stock', value: stats.outOfStock, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [inventory, stats]);

  const movementData = useMemo(() => {
    return [
      { name: 'Sales', qty: stats.salesQty, fill: '#4f6ef7' },
      { name: 'Spoilage/ENT', qty: stats.entQty, fill: '#f59e0b' },
      { name: 'Received', qty: stats.receiveQty, fill: '#10b981' },
    ];
  }, [stats]);

  // --- CSV Export ---
  const handleExportCSV = (type) => {
    let csvRows = [];
    if (type === 'transactions') {
      csvRows = [['Date', 'Type', 'Product ID', 'Quantity', 'Performed By', 'Remarks'].join(',')];
      filteredTransactions.forEach(tx => {
        const product = inventory.find(p => String(p.id) === String(tx.productId));
        csvRows.push([
          `"${new Date(tx.date).toLocaleString('en-GB')}"`,
          `"${tx.type}"`,
          `"${product ? product.item : tx.productId}"`,
          tx.quantity,
          `"${tx.performedBy}"`,
          `"${(tx.remarks || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    } else if (type === 'inventory') {
      csvRows = [['Code', 'Product Name', 'Unit', 'Price', 'Stock', 'Min Level', 'Status'].join(',')];
      inventory.forEach(p => {
        const stockVal = parseInt(p.stockOnHand) || 0;
        const minVal = parseInt(p.minStockLevel) || 0;
        let status = 'Good';
        if (stockVal <= 0) status = 'Out of Stock';
        else if (stockVal <= minVal) status = 'Low Stock';
        csvRows.push([
          `"${p.code}"`, `"${p.item}"`, `"${p.unit}"`, p.price, stockVal, minVal, `"${status}"`
        ].join(','));
      });
    } else if (type === 'daily-summary') {
      csvRows = [['Date & Time', 'Category', 'Product Name', 'Action', 'Qty', 'Unit Price', 'Current Stock', 'Performed By', 'Remarks'].join(',')];
      const today = new Date();
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.toDateString() === today.toDateString()) {
          const product = inventory.find(p => String(p.id) === String(tx.productId));
          const categoryObj = categories.find(c => c.id === product?.categoryId);
          const category = categoryObj ? categoryObj.name : '—';
          const currentStock = product ? (parseInt(product.stockOnHand) || 0) : '—';
          const unitPrice = product ? (product.price || 0) : 0;
          csvRows.push([
            `"${txDate.toLocaleString('en-GB')}"`,
            `"${category}"`,
            `"${product ? product.item : tx.productId}"`,
            `"${tx.type}"`,
            tx.quantity,
            unitPrice,
            currentStock,
            `"${tx.performedBy}"`,
            `"${(tx.remarks || '').replace(/"/g, '""')}"`
          ].join(','));
        }
      });
    } else if (type === 'monthly-summary') {
      csvRows = [['Date & Time', 'Category', 'Product Name', 'Action', 'Qty', 'Unit Price', 'Current Stock', 'Performed By', 'Remarks'].join(',')];
      const today = new Date();
      const thisMonth = today.getMonth();
      const thisYear = today.getFullYear();
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === thisMonth && txDate.getFullYear() === thisYear) {
          const product = inventory.find(p => String(p.id) === String(tx.productId));
          const categoryObj = categories.find(c => c.id === product?.categoryId);
          const category = categoryObj ? categoryObj.name : '—';
          const currentStock = product ? (parseInt(product.stockOnHand) || 0) : '—';
          const unitPrice = product ? (product.price || 0) : 0;
          csvRows.push([
            `"${txDate.toLocaleString('en-GB')}"`,
            `"${category}"`,
            `"${product ? product.item : tx.productId}"`,
            `"${tx.type}"`,
            tx.quantity,
            unitPrice,
            currentStock,
            `"${tx.performedBy}"`,
            `"${(tx.remarks || '').replace(/"/g, '""')}"`
          ].join(','));
        }
      });
    } else {
      csvRows = [['Date', 'User', 'Action', 'Details', 'Status'].join(',')];
      filteredLogs.forEach(log => {
        csvRows.push([
          `"${new Date(log.date).toLocaleString('en-GB')}"`,
          `"${log.user}"`, `"${log.title}"`,
          `"${(log.details || '').replace(/"/g, '""')}"`,
          `"${log.status}"`
        ].join(','));
      });
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RPM_Report_${type}_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export successful!');
  };

  // --- PDF Export with Charts + Tables ---
  const handleExportPDF = useCallback(async () => {
    setPdfExporting(true);
    toast.loading('Generating PDF report...', { id: 'pdf' });

    try {
      // Small delay for state update
      await new Promise(r => setTimeout(r, 100));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      // === PAGE 1: Cover + Summary ===
      // Header bar
      pdf.setFillColor(28, 52, 93);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Inventory Report', margin, 22);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Royal Phuket Marina — Generated ${dateStr} at ${timeStr}`, margin, 32);

      // Summary KPIs
      let y = 52;
      pdf.setTextColor(28, 52, 93);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary Overview', margin, y);
      y += 8;

      const kpiData = [
        ['Total Products', stats.totalProducts],
        ['Total Stock', stats.totalStock],
        ['Sales (Today)', stats.salesQty],
        ['Spoilage/ENT (Today)', stats.entQty],
        ['Received (Today)', stats.receiveQty],
        ['Movements (Today)', stats.totalMovements],
      ];

      const kpiBoxW = (contentWidth - 8) / 3;
      const kpiBoxH = 20;
      kpiData.forEach((kpi, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = margin + col * (kpiBoxW + 4);
        const boxY = y + row * (kpiBoxH + 4);

        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(x, boxY, kpiBoxW, kpiBoxH, 3, 3, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(kpi[0], x + 4, boxY + 8);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(28, 52, 93);
        pdf.text(String(kpi[1]), x + 4, boxY + 16);
      });

      y += Math.ceil(kpiData.length / 3) * (kpiBoxH + 4) + 8;

      // Stock Status section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(28, 52, 93);
      pdf.text('Stock Health', margin, y);
      y += 6;

      const statusItems = [
        { label: 'Good', count: stats.totalProducts - stats.lowStock - stats.outOfStock, color: [16, 185, 129] },
        { label: 'Low Stock', count: stats.lowStock, color: [245, 158, 11] },
        { label: 'Out of Stock', count: stats.outOfStock, color: [239, 68, 68] },
      ];

      statusItems.forEach((item) => {
        const barMaxW = contentWidth - 60;
        const pct = stats.totalProducts > 0 ? item.count / stats.totalProducts : 0;
        pdf.setFillColor(240, 240, 240);
        pdf.roundedRect(margin, y, barMaxW, 8, 2, 2, 'F');
        if (pct > 0) {
          pdf.setFillColor(...item.color);
          pdf.roundedRect(margin, y, Math.max(barMaxW * pct, 4), 8, 2, 2, 'F');
        }
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`${item.label}: ${item.count}`, margin + barMaxW + 4, y + 6);
        y += 12;
      });

      y += 4;

      // Movement bars
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(28, 52, 93);
      pdf.text('Today\'s Movements', margin, y);
      y += 6;

      const mvItems = [
        { label: 'Sales', qty: stats.salesQty, color: [79, 110, 247] },
        { label: 'Spoilage / ENT', qty: stats.entQty, color: [245, 158, 11] },
        { label: 'Received', qty: stats.receiveQty, color: [16, 185, 129] },
      ];
      const maxMvQty = Math.max(...mvItems.map(m => m.qty), 1);
      mvItems.forEach((item) => {
        const barMaxW = contentWidth - 60;
        const pct = item.qty / maxMvQty;
        pdf.setFillColor(240, 240, 240);
        pdf.roundedRect(margin, y, barMaxW, 8, 2, 2, 'F');
        if (pct > 0) {
          pdf.setFillColor(...item.color);
          pdf.roundedRect(margin, y, Math.max(barMaxW * pct, 4), 8, 2, 2, 'F');
        }
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`${item.label}: ${item.qty}`, margin + barMaxW + 4, y + 6);
        y += 12;
      });

      // === PAGE 2: Low Stock / Out of Stock Alert ===
      pdf.addPage();
      pdf.setFillColor(28, 52, 93);
      pdf.rect(0, 0, pageWidth, 18, 'F');
      pdf.setTextColor(255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('⚠ Stock Alerts — Low Stock & Out of Stock Items', margin, 12);

      const alertItems = inventory.filter(p => {
        const s = parseInt(p.stockOnHand) || 0;
        const m = parseInt(p.minStockLevel) || 0;
        return s <= 0 || (s > 0 && s <= m);
      }).map(p => {
        const s = parseInt(p.stockOnHand) || 0;
        const m = parseInt(p.minStockLevel) || 0;
        return [p.code || '', p.item || '', p.unit || '', String(s), String(m), s <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'];
      });

      if (alertItems.length > 0) {
        autoTable(pdf, {
          startY: 24,
          head: [['Code', 'Product Name', 'Unit', 'Stock', 'Min Level', 'Status']],
          body: alertItems,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [28, 52, 93], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 5: { fontStyle: 'bold' } },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              data.cell.styles.textColor = data.cell.raw === 'OUT OF STOCK' ? [239, 68, 68] : [245, 158, 11];
            }
          },
        });
      } else {
        pdf.setTextColor(100);
        pdf.setFontSize(11);
        pdf.text('All items are sufficiently stocked. No alerts at this time.', margin, 32);
      }

      // === PAGE 3: Full Inventory Table ===
      pdf.addPage();
      pdf.setFillColor(28, 52, 93);
      pdf.rect(0, 0, pageWidth, 18, 'F');
      pdf.setTextColor(255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Full Inventory Snapshot (${inventory.length} products)`, margin, 12);

      const invRows = inventory.map(p => {
        const s = parseInt(p.stockOnHand) || 0;
        const m = parseInt(p.minStockLevel) || 0;
        let status = 'Good';
        if (s <= 0) status = 'Out of Stock';
        else if (s <= m) status = 'Low Stock';
        return [p.code || '', p.item || '', p.unit || '', `฿${(p.price || 0).toLocaleString()}`, String(s), String(m), status];
      });

      autoTable(pdf, {
        startY: 24,
        head: [['Code', 'Product', 'Unit', 'Price', 'Stock', 'Min', 'Status']],
        body: invRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [28, 52, 93], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            if (data.cell.raw === 'Out of Stock') data.cell.styles.textColor = [239, 68, 68];
            else if (data.cell.raw === 'Low Stock') data.cell.styles.textColor = [245, 158, 11];
            else data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // === PAGE 4: Today's Transactions ===
      const todayTx = transactions.filter(tx => new Date(tx.date).toDateString() === now.toDateString());
      if (todayTx.length > 0) {
        pdf.addPage();
        pdf.setFillColor(28, 52, 93);
        pdf.rect(0, 0, pageWidth, 18, 'F');
        pdf.setTextColor(255);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Today's Transactions (${todayTx.length} records)`, margin, 12);

        const txRows = todayTx.map(tx => {
          const product = inventory.find(p => String(p.id) === String(tx.productId));
          return [
            new Date(tx.date).toLocaleString('en-GB'),
            tx.type,
            product ? product.item : `#${tx.productId}`,
            String(tx.quantity),
            tx.performedBy || '',
            tx.remarks || '—',
          ];
        });

        autoTable(pdf, {
          startY: 24,
          head: [['Date & Time', 'Type', 'Product', 'Qty', 'By', 'Remarks']],
          body: txRows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [28, 52, 93], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }

      // Footer on all pages
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.setFillColor(245, 247, 250);
        pdf.rect(0, pageH - 12, pageWidth, 12, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(160, 160, 160);
        pdf.text(`RPM Inventory Report — Page ${i} of ${pageCount}`, margin, pageH - 4);
        pdf.text(`Generated: ${dateStr} ${timeStr}`, pageWidth - margin, pageH - 4, { align: 'right' });
      }

      pdf.save(`RPM_Inventory_Report_${now.toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported successfully!', { id: 'pdf' });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF', { id: 'pdf' });
    } finally {
      setPdfExporting(false);
    }
  }, [inventory, stats, transactions, categories, filteredTransactions]);

  const filterLabel = filter === 'daily' ? 'Today' : filter === 'monthly' ? 'This Month' : 'All Time';

  const sectionTabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'transactions', label: 'Transaction Log', icon: TrendingDown },
    { key: 'inventory', label: 'Inventory Snapshot', icon: Package },
  ];

  const kpiCards = [
    { label: `Movements (${filterLabel})`, value: stats.totalMovements, color: 'var(--primary)' },
    { label: 'Sales Used', value: stats.salesQty, color: 'var(--indigo-500)' },
    { label: 'Spoilage / ENT', value: stats.entQty, color: 'var(--warning)' },
    { label: 'Received', value: stats.receiveQty, color: 'var(--success)' },
    { label: 'Low Stock', value: stats.lowStock, color: stats.lowStock > 0 ? 'var(--warning)' : 'var(--text-primary)' },
    { label: 'Out of Stock', value: stats.outOfStock, color: stats.outOfStock > 0 ? 'var(--danger)' : 'var(--text-primary)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* Header Card */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: 'var(--sp-5)' }}
      >
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', margin: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--primary), var(--indigo-500))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} style={{ color: '#fff' }} />
            </div>
            System Report
          </h2>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ padding: '8px 12px', minWidth: 120, fontWeight: 600, borderRadius: 'var(--radius-lg)', fontSize: 13 }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="daily">📅 Today</option>
              <option value="monthly">📆 This Month</option>
              <option value="all">📊 All Time</option>
            </select>
            <button
              className="btn btn-ghost"
              onClick={loadData}
              style={{ padding: '8px' }}
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {/* Export Buttons Row */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => handleExportCSV('daily-summary')}
            style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Daily CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleExportCSV('monthly-summary')}
            style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Monthly CSV
          </button>
          <button
            className="btn"
            onClick={handleExportPDF}
            disabled={pdfExporting}
            style={{
              padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-lg)', fontWeight: 600, cursor: pdfExporting ? 'wait' : 'pointer',
              opacity: pdfExporting ? 0.6 : 1
            }}
          >
            <FileDown size={14} /> {pdfExporting ? 'Exporting...' : 'PDF Report'}
          </button>
        </div>
      </motion.div>

      {/* KPI Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-3)' }}
      >
        {kpiCards.map((kpi, i) => (
          <div key={i} className="card" style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}
      >
        {/* Pie Chart: Stock Status */}
        <div className="card" style={{ padding: 'var(--sp-4)' }} ref={pieChartRef}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>Stock Health</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stockStatusData}
                cx="50%"
                cy="55%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {stockStatusData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={30} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart: Movements */}
        <div className="card" style={{ padding: 'var(--sp-4)' }} ref={barChartRef}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>Movements ({filterLabel})</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={movementData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
                {movementData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Section Tabs */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ padding: 'var(--sp-5)' }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--sp-3)', overflowX: 'auto' }}>
          {sectionTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`btn ${activeSection === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveSection(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '8px 16px', borderRadius: 'var(--radius-lg)',
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Activity Log ({filterLabel})</h3>
              <button className="btn btn-ghost" onClick={() => handleExportCSV('overview')} style={{ fontSize: 13 }}>
                <Download size={14} style={{ marginRight: 4 }} /> Export
              </button>
            </div>
            <div className="data-table-container" style={{ display: 'block', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>Loading...</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No activity found for {filterLabel.toLowerCase()}.</td></tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(log.date).toLocaleString('en-GB')}</td>
                        <td style={{ fontSize: 13 }}>{log.user}</td>
                        <td>
                          <span className="badge badge-primary" style={{ fontSize: 11 }}>{log.title}</span>
                        </td>
                        <td style={{ fontSize: 13, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
                        <td>
                          <span className={`badge ${log.status === 'Success' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>{log.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transaction Log Section */}
        {activeSection === 'transactions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Stock Transactions ({filterLabel})</h3>
              <button className="btn btn-ghost" onClick={() => handleExportCSV('transactions')} style={{ fontSize: 13 }}>
                <Download size={14} style={{ marginRight: 4 }} /> Export
              </button>
            </div>
            <div className="data-table-container" style={{ display: 'block', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>Loading...</td></tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No transactions found for {filterLabel.toLowerCase()}.</td></tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const product = inventory.find(p => String(p.id) === String(tx.productId));
                      const isNegative = tx.quantity < 0;
                      return (
                        <tr key={tx.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(tx.date).toLocaleString('en-GB')}</td>
                          <td>
                            <span className={`badge ${tx.type === 'Receive' ? 'badge-success' : tx.type === 'Sales' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 600 }}>{product ? product.item : `#${tx.productId}`}</td>
                          <td style={{ fontWeight: 700, color: isNegative ? 'var(--danger)' : 'var(--success)', fontSize: 13 }}>
                            {isNegative ? '' : '+'}{tx.quantity}
                          </td>
                          <td style={{ fontSize: 13 }}>{tx.performedBy}</td>
                          <td style={{ fontSize: 13, color: tx.remarks ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{tx.remarks || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Snapshot Section */}
        {activeSection === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Full Inventory Snapshot ({inventory.length} products)</h3>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 32, minWidth: 160, fontSize: 13 }}
                  />
                </div>
                <button className="btn btn-ghost" onClick={() => handleExportCSV('inventory')} style={{ fontSize: 13 }}>
                  <Download size={14} style={{ marginRight: 4 }} /> Export
                </button>
              </div>
            </div>
            <div className="data-table-container" style={{ display: 'block', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product Name</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Min Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventorySearched.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>No products found.</td></tr>
                  ) : (
                    inventorySearched.map(p => {
                      const stockVal = parseInt(p.stockOnHand) || 0;
                      const minVal = parseInt(p.minStockLevel) || 0;
                      let status = 'Good';
                      let badgeClass = 'badge-success';
                      if (stockVal <= 0) { status = 'Out of Stock'; badgeClass = 'badge-danger'; }
                      else if (stockVal <= minVal) { status = 'Low Stock'; badgeClass = 'badge-warning'; }
                      return (
                        <tr key={p.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.code}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{p.item}</td>
                          <td style={{ fontSize: 13 }}>{p.unit}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>฿{(p.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: stockVal <= 0 ? 'var(--danger)' : stockVal <= minVal ? 'var(--warning)' : 'var(--text-primary)' }}>{stockVal}</td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-tertiary)' }}>{minVal}</td>
                          <td><span className={`badge ${badgeClass}`} style={{ fontSize: 11 }}>{status}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
