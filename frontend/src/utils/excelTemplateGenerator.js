import * as XLSX from 'xlsx';

/**
 * Generates and downloads a pre-formatted, standard Excel template for bulk import
 * into the Billing Software (Parties, Items, and Opening Stock).
 */
export function downloadMasterTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Parties Master Sheet
  const partiesData = [
    {
      'Party Name *': 'Shree Ganesh Textiles',
      'Type (Customer/Supplier/Both)': 'Customer',
      'GSTIN': '24AAACG1234A1Z5',
      'PAN': 'AAACG1234A',
      'Mobile': '9825012345',
      'Email': 'ganesh@textiles.com',
      'Address': 'Ring Road, Surat',
      'City': 'Surat',
      'State': 'Gujarat',
      'Opening Balance': 150000,
      'Dr/Cr': 'Dr',
      'Credit Limit': 500000,
    },
    {
      'Party Name *': 'Modern Mills Pvt Ltd',
      'Type (Customer/Supplier/Both)': 'Supplier',
      'GSTIN': '27AACCM5678B1Z2',
      'PAN': 'AACCM5678B',
      'Mobile': '9890123456',
      'Email': 'modern@mills.com',
      'Address': 'MIDC Textile Park, Ichalkaranji',
      'City': 'Ichalkaranji',
      'State': 'Maharashtra',
      'Opening Balance': 85000,
      'Dr/Cr': 'Cr',
      'Credit Limit': 1000000,
    },
  ];
  const partiesWs = XLSX.utils.json_to_sheet(partiesData);
  partiesWs['!cols'] = [
    { wch: 30 }, // Party Name
    { wch: 26 }, // Type
    { wch: 18 }, // GSTIN
    { wch: 14 }, // PAN
    { wch: 15 }, // Mobile
    { wch: 24 }, // Email
    { wch: 32 }, // Address
    { wch: 16 }, // City
    { wch: 16 }, // State
    { wch: 16 }, // Opening Balance
    { wch: 10 }, // Dr/Cr
    { wch: 14 }, // Credit Limit
  ];
  XLSX.utils.book_append_sheet(wb, partiesWs, 'Parties');

  // 2. Items Master Sheet
  const itemsData = [
    {
      'Item Name *': 'Cotton 60x60 Cambric Print',
      'Item Code': 'CAM-6060',
      'Category (Grey/Finished/Yarn/Others)': 'Finished',
      'HSN Code': '5208',
      'GST Rate (%)': 5,
      'Unit (MTRS/PCS)': 'MTRS',
      'Purchase Rate': 42.50,
      'Sales Rate': 56.00,
      'Opening Stock (Mtrs)': 1200.00,
      'Opening Pieces': 12,
      'Opening Rate': 42.50,
    },
    {
      'Item Name *': 'Pure Rayon 14KG Plain Grey',
      'Item Code': 'RAY-14KG',
      'Category (Grey/Finished/Yarn/Others)': 'Grey',
      'HSN Code': '5407',
      'GST Rate (%)': 5,
      'Unit (MTRS/PCS)': 'MTRS',
      'Purchase Rate': 35.00,
      'Sales Rate': 40.00,
      'Opening Stock (Mtrs)': 2500.00,
      'Opening Pieces': 25,
      'Opening Rate': 35.00,
    },
  ];
  const itemsWs = XLSX.utils.json_to_sheet(itemsData);
  itemsWs['!cols'] = [
    { wch: 32 }, // Item Name
    { wch: 14 }, // Item Code
    { wch: 32 }, // Category
    { wch: 12 }, // HSN Code
    { wch: 14 }, // GST Rate
    { wch: 16 }, // Unit
    { wch: 15 }, // Purchase Rate
    { wch: 14 }, // Sales Rate
    { wch: 20 }, // Opening Stock
    { wch: 16 }, // Opening Pieces
    { wch: 14 }, // Opening Rate
  ];
  XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');

  // 3. Opening Stock Lots Sheet
  const stockData = [
    {
      'Item Name *': 'Cotton 60x60 Cambric Print',
      'Lot No': 'LOT-2026-001',
      'Warehouse': 'Main Godown',
      'Meters *': 600.00,
      'Pieces': 6,
      'Rate': 42.50,
    },
    {
      'Item Name *': 'Cotton 60x60 Cambric Print',
      'Lot No': 'LOT-2026-002',
      'Warehouse': 'Main Godown',
      'Meters *': 600.00,
      'Pieces': 6,
      'Rate': 42.50,
    },
    {
      'Item Name *': 'Pure Rayon 14KG Plain Grey',
      'Lot No': 'GREY-RAY-901',
      'Warehouse': 'Grey Godown',
      'Meters *': 2500.00,
      'Pieces': 25,
      'Rate': 35.00,
    },
  ];
  const stockWs = XLSX.utils.json_to_sheet(stockData);
  stockWs['!cols'] = [
    { wch: 32 }, // Item Name
    { wch: 18 }, // Lot No
    { wch: 20 }, // Warehouse
    { wch: 15 }, // Meters
    { wch: 12 }, // Pieces
    { wch: 12 }, // Rate
  ];
  XLSX.utils.book_append_sheet(wb, stockWs, 'Opening Stock Lots');

  // 4. Instructions Sheet
  const instructions = [
    { 'Instructions & Field Guide': '1. Do not modify the sheet names (Parties, Items, Opening Stock Lots).' },
    { 'Instructions & Field Guide': '2. Fields with * are mandatory. Others can be left blank if not available.' },
    { 'Instructions & Field Guide': '3. Category should be one of: Grey, Finished, Yarn, Others (Default is Finished).' },
    { 'Instructions & Field Guide': '4. Party Type should be one of: Customer, Supplier, Both, Broker, Job Worker, Transport.' },
    { 'Instructions & Field Guide': '5. Unit should be MTRS or PCS (Default is MTRS).' },
    { 'Instructions & Field Guide': '6. Opening Balance Dr/Cr: Use Dr if customer owes you, Cr if you owe supplier.' },
    { 'Instructions & Field Guide': '7. You can also import existing Excel/CSV files exported from Tally/Busy/Vyapar using our Smart Column Auto-Mapper.' },
  ];
  const instructionsWs = XLSX.utils.json_to_sheet(instructions);
  instructionsWs['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  XLSX.writeFile(wb, 'Billing_Master_Import_Template.xlsx');
}
