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
    Line: () => <div />
  };
});

describe('Dashboard Component', () => {
  const mockInventory = [
    { code: 'ITM001', item: 'Coke', closing: '50', groupId: 2 },
    { code: 'ITM002', item: 'Pepsi', closing: '0', groupId: 2 }, // Out of stock
    { code: 'ITM003', item: 'Water', closing: '5', groupId: 2 }, // Low stock (threshold 10)
  ];

  const mockTransactions = [
    { id: 1, item: 'Coke', type: 'Sales', quantity: 10, date: '2026-07-24' },
    { id: 2, item: 'Water', type: 'Receive', quantity: 20, date: '2026-07-24' },
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
    
    // Out of Stock Items: 1 (Pepsi)
    expect(screen.getByText('1')).toBeInTheDocument();
    
    // Low Stock Details Table should render Water and Pepsi (since Pepsi is 0 < 10)
    expect(screen.getAllByText('Pepsi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Water').length).toBeGreaterThan(0);
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
    
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });
});
