import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { salesApi } from '../../api/sales.api';
import InvoicePDFViewer from '../../components/InvoicePDFViewer';

const SalesPrint = ({ invoiceId, invoice: invoiceProp, onClose }) => {
  const { sales, parties, items } = useStore();

  const getInitialInvoice = () => {
    if (invoiceProp) return invoiceProp;
    if (!invoiceId) return null;
    return (sales || []).find((s) => String(s._id || s.id) === String(invoiceId)) || null;
  };

  const [currentInvoice, setCurrentInvoice] = useState(getInitialInvoice);

  useEffect(() => {
    if (invoiceProp) {
      setCurrentInvoice(invoiceProp);
    } else if (invoiceId) {
      const fromStore = (sales || []).find((s) => String(s._id || s.id) === String(invoiceId));
      if (fromStore) setCurrentInvoice(fromStore);
    }

    // Always fetch fresh from backend API so newly saved LR / transport fields are 100% up-to-date
    if (invoiceId) {
      let isMounted = true;
      salesApi.get(invoiceId)
        .then((fresh) => {
          if (isMounted && fresh) {
            setCurrentInvoice((prev) => ({ ...(prev || {}), ...fresh }));
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [invoiceId, invoiceProp, sales]);

  if (!currentInvoice) return null;

  return (
    <InvoicePDFViewer
      type="sale"
      invoice={currentInvoice}
      parties={parties}
      items={items}
      onClose={onClose}
    />
  );
};

export default SalesPrint;

