const XLSX = require('xlsx');
const fs = require('fs');

try {
  const workbook = XLSX.readFile('c:\\Users\\Sun\\Desktop\\Restaurant Inventory\\Stock V.1.xlsx');
  
  const result = {};
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    result[sheetName] = data.slice(0, 10); // get first 10 rows
  });

  fs.writeFileSync('c:\\Users\\Sun\\.gemini\\antigravity-ide\\brain\\a37e8c5b-e0a7-4cb0-9c36-9605d4c4f937\\scratch\\excel_preview.json', JSON.stringify(result, null, 2));
  console.log("Success");
} catch (err) {
  console.error("Error reading excel:", err);
}
