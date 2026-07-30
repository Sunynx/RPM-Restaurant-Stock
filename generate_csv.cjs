const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'c:\\Users\\Sun\\Desktop\\Restaurant Inventory\\Stock V.1.xlsx';
const outputDir = 'c:\\Users\\Sun\\Desktop\\Restaurant Inventory';

function parseExcelDate(excelSerial) {
  if (!excelSerial || isNaN(excelSerial)) return '';
  const date = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
  return date.toISOString();
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers, rows) {
  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map(row => headers.map(h => escapeCSV(row[h])).join(','));
  return [headerRow, ...dataRows].join('\n');
}

try {
  console.log("Reading Excel file...");
  const workbook = XLSX.readFile(excelPath);
  
  // 1. Process Products
  console.log("Processing Products...");
  const stockSheet = workbook.Sheets['Stock_Balance'];
  const stockData = XLSX.utils.sheet_to_json(stockSheet, { range: 1 }); // Skip first empty row
  
  const productsRows = [];
  stockData.forEach(row => {
    if (!row.Code || !row.Item) return;
    
    productsRows.push({
      Title: row.Code,
      ProductName: row.Item,
      Category: '', // Need to be assigned manually in SP
      Unit: 'pcs',
      UnitPrice: 0,
      StockOnHand: row.Closing || 0,
      MinStockLevel: 10,
      Status: 'Active'
    });
  });
  
  fs.writeFileSync(path.join(outputDir, 'Products_Import.csv'), toCSV([
    'Title', 'ProductName', 'Category', 'Unit', 'UnitPrice', 'StockOnHand', 'MinStockLevel', 'Status'
  ], productsRows));

  // 2. Process Transactions (DailySales + Issues)
  console.log("Processing Transactions...");
  const txRows = [];
  
  if (workbook.Sheets['DailySales']) {
    const salesData = XLSX.utils.sheet_to_json(workbook.Sheets['DailySales'], { range: 0 });
    salesData.forEach((row, index) => {
      if (!row.Date || !row.Code) return;
      txRows.push({
        Title: `TX-S${index}`,
        TransactionDate: parseExcelDate(row.Date),
        TransactionType: 'Sales',
        Product: row.Code,
        Quantity: -(row.QTY || 0), // Sales is deduction
        Remarks: row.Remark || '',
        PerformedBy: ''
      });
    });
  }

  if (workbook.Sheets['Issues']) {
    const issuesData = XLSX.utils.sheet_to_json(workbook.Sheets['Issues'], { range: 0 });
    issuesData.forEach((row, index) => {
      if (!row.Date || !row.Code) return;
      txRows.push({
        Title: `TX-I${index}`,
        TransactionDate: parseExcelDate(row.Date),
        TransactionType: 'Receive',
        Product: row.Code,
        Quantity: row.QTY || 0, // Issue from main store = Receive into cart
        Remarks: row.Remark || '',
        PerformedBy: row.S_code || ''
      });
    });
  }

  fs.writeFileSync(path.join(outputDir, 'Transactions_Import.csv'), toCSV([
    'Title', 'TransactionDate', 'TransactionType', 'Product', 'Quantity', 'Remarks', 'PerformedBy'
  ], txRows));

  // 3. Process Users (Staff)
  console.log("Processing Users...");
  const userRows = [];
  if (workbook.Sheets['Staff']) {
    const staffData = XLSX.utils.sheet_to_json(workbook.Sheets['Staff'], { range: 0 });
    staffData.forEach((row) => {
      if (!row.Name) return;
      userRows.push({
        Title: `${row.Name.toLowerCase().replace(/\s/g, '')}@rpm.com`, // Dummy email
        DisplayName: row.Name,
        Role: 'Staff',
        Status: 'Active'
      });
    });
  }

  fs.writeFileSync(path.join(outputDir, 'Users_Import.csv'), toCSV([
    'Title', 'DisplayName', 'Role', 'Status'
  ], userRows));

  console.log("Successfully generated CSV files in Desktop/Restaurant Inventory!");
} catch (err) {
  console.error("Error:", err);
}
