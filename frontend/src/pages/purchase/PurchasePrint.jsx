import React from 'react';
import useStore from '../../store/useStore';
import InvoicePDFViewer from '../../components/InvoicePDFViewer';

const PurchasePrint = ({ invoiceId, invoice: invoiceProp, onClose }) => {
  const { purchases, parties, items } = useStore();
  const invoice =
    invoiceProp ||
    purchases.find((p) => p.id === invoiceId || p._id === invoiceId);

  if (!invoice) return null;

  return (
    <InvoicePDFViewer
      type="purchase"
      invoice={invoice}
      parties={parties}
      items={items}
      onClose={onClose}
    />
  );
};

export default PurchasePrint;
