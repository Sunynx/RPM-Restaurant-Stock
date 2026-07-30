const XLSX = require('xlsx');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'Stock V.2.xlsx');
const outputPath = path.join(__dirname, '..', 'SharePoint_Import.xlsx');

const workbook = XLSX.readFile(inputPath);
const allData = [];
let headers = [];

workbook.SheetNames.forEach((sheetName, index) => {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
  if (index === 0 && jsonData.length > 0) {
    headers = Object.keys(jsonData[0]);
  }
  
  jsonData.forEach(row => {
    // Basic cleanup, sometimes excel has empty rows
    if (Object.values(row).some(val => val !== "")) {
       allData.push(row);
    }
  });
});

console.log(`Combined ${allData.length} rows from ${workbook.SheetNames.length} sheets.`);

const newWorkbook = XLSX.utils.book_new();
const newSheet = XLSX.utils.json_to_sheet(allData);

XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'InventoryList');
XLSX.writeFile(newWorkbook, outputPath);

console.log(`Saved combined file to ${outputPath}`);
