export const initialData = [
  { code: '6022', item: 'MARBORO GLOD', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6023', item: 'CAMEL BLUE', stockOnHand: -2, issued: 0, sales: 0, ent: 0, closing: -2, categoryId: 3 },
  { code: '6024', item: 'SUN CREAM', stockOnHand: 52, issued: 0, sales: 2, ent: 0, closing: 50, categoryId: 3 },
  { code: '6025', item: 'SUN CREAM 5 FREE 1', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6001', item: 'RPM REFILL BLUE BOTTLE 750 ML.', stockOnHand: 77, issued: 0, sales: 7, ent: 0, closing: 70, categoryId: 3 },
  { code: '6002', item: 'RPM REFILL BLUE BOTTLE 750 ML. - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6003', item: 'RPM WITHE MUG', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6004', item: 'RPM WITH MUG - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6005', item: 'RPM CLOTH BAG', stockOnHand: 53, issued: 0, sales: 3, ent: 0, closing: 50, categoryId: 3 },
  { code: '6006', item: 'RPM CLOTH BAG - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6007', item: 'RPM DRY BAG 10 L.', stockOnHand: 70, issued: 0, sales: 1, ent: 0, closing: 69, categoryId: 3 },
  { code: '6008', item: 'RPM DRY BAG 10 L. - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6009', item: 'RPM DRY BAG 5 L.', stockOnHand: 76, issued: 0, sales: 1, ent: 0, closing: 75, categoryId: 3 },
  { code: '6010', item: 'RPM DRY BAG 5 L. - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6011', item: 'RPM HADHELD FAN', stockOnHand: 35, issued: 0, sales: 0, ent: 0, closing: 35, categoryId: 3 },
  { code: '6012', item: 'RPM HADHELD FAN - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6013', item: 'RPM BEER COVER', stockOnHand: 115, issued: 0, sales: 10, ent: 0, closing: 105, categoryId: 3 },
  { code: '6014', item: 'RPM BEER COVER - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6015', item: 'RPM BUCKET HAT', stockOnHand: 75, issued: 0, sales: 0, ent: 0, closing: 75, categoryId: 3 },
  { code: '6016', item: 'RPM BUCKET HAT - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6017', item: 'RPM WATERPROFF PHONE CASE - 199', stockOnHand: 113, issued: 0, sales: 2, ent: 0, closing: 111, categoryId: 3 },
  { code: '6018', item: '2 PHONE CASE = 350.-', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6019', item: '3 PHONE CASE = 500.-', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6018', item: 'RPM POLO WHITE SHIRT', stockOnHand: 6, issued: 0, sales: 0, ent: 0, closing: 6, categoryId: 3 },
  { code: '6019', item: 'RPM POLO WHITE SHIRT - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
  { code: '6120', item: 'RPM UMBRELLA', stockOnHand: 22, issued: 0, sales: 0, ent: 0, closing: 22, categoryId: 3 },
  { code: '6121', item: 'RPM UMBRELLA - STAFF', stockOnHand: 0, issued: 0, sales: 0, ent: 0, closing: 0, categoryId: 3 },
];

export const loadInventory = () => {
  const data = localStorage.getItem('inventory_data');
  if (data) {
    const parsed = JSON.parse(data);
    // Add categoryId if missing (backward compatibility)
    return parsed.map(item => ({
      ...item,
      categoryId: item.categoryId || 3
    }));
  }
  localStorage.setItem('inventory_data', JSON.stringify(initialData));
  return initialData;
};

export const saveInventory = (data) => {
  localStorage.setItem('inventory_data', JSON.stringify(data));
};
