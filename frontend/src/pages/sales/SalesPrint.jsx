import React from 'react';
import useStore from '../../store/useStore';
import InvoicePDFViewer from '../../components/InvoicePDFViewer';

const SalesPrint = ({ invoiceId, invoice: invoiceProp, onClose }) => {
  const { sales, parties, items } = useStore();
  const invoice =
    invoiceProp ||
    sales.find((s) => s.id === invoiceId || s._id === invoiceId);

  if (!invoice) return null;

  return (
    <InvoicePDFViewer
      type="sale"
      invoice={invoice}
      parties={parties}
      items={items}
      onClose={onClose}
    />
  );
};

export default SalesPrint;
