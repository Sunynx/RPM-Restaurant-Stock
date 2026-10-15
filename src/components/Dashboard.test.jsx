import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';

// Mock recharts because it uses ResizeObserver and SVG which is hard to mock in jsdom
vi.mock('recharts', () => {
  const OriginalRecharts = vi.importActual('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    PieChart: () => <div data-testid="pie-chart">PieChart</div>,
    Pie: () => <div />,
    Cell: () => <div />,
    BarChart: () => <div data-testid="bar-chart">BarChart</div>,
    Bar: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
    ComposedChart: () => <div data-testid="composed-chart">ComposedChart</div>,
    AreaChart: () => <div data-testid="area-chart">AreaChart</div>,
    Area: () => <div />,
    Line: () => <div />
  };
});

describe('Dashboard Component', () => {
  const mockInventory = [
    { id: '1', code: 'ITM001', item: 'Coke', closing: '50', cost: 10 },
    { id: '2', code: 'ITM002', item: 'Pepsi', closing: '0', cost: 12 }, // Out of stock
    { id: '3', code: 'ITM003', item: 'Water', closing: '5', cost: 5 }, // Low stock (threshold 10)
  ];

  const mockTransactions = [
    { id: 1, productId: '1', item: 'Coke', type: 'Sales', quantity: 10, date: '2026-07-24T10:00:00' },
    { id: 2, productId: '3', item: 'Water', type: 'Receive', quantity: 20, date: '2026-07-24T11:00:00' },
  ];

  it('renders correct total and out of stock items', () => {
    render(
      <Dashboard 
        inventory={mockInventory} 
        lowStockThreshold={10} 
        onNavigate={vi.fn()} 
        transactions={mockTransactions} 
      />
    );

    // Total Items: 3
    expect(screen.getByText('3')).toBeInTheDocument();
    
    // Out of Stock / Low Stock Items KPI
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    
    // Recent Transactions / Top Sellers
    expect(screen.getAllByText('Coke').length).toBeGreaterThan(0);
  });

  it('renders charts without crashing', () => {
    render(
      <Dashboard 
        inventory={mockInventory} 
        lowStockThreshold={10} 
        onNavigate={vi.fn()} 
        transactions={mockTransactions} 
      />
    );
    
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });
});
