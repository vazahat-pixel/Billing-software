import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSection } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import { notifyWarning, notifyError } from '../../utils/notify';
import { Package, Layers, Ruler, Hash, Coins, Tag, Scissors } from 'lucide-react';

const ItemModal = ({ isOpen, onClose, initialData = null, onSuccess }) => {
  const { addItem, hsnCodes } = useStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    itemName: '',
    designNo: '',
    designName: '',
    fabricQuality: '',
    hsnCode: '5208',
    gstRate: '5',
    unit: 'MTRS',
    purchaseRate: '',
    saleRate: '',
    minStock: 0,
    barcode: ''
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    } else {
       setFormData({
        itemName: '',
        designNo: '',
        designName: '',
        fabricQuality: '',
        hsnCode: '5208',
        gstRate: '5',
        unit: 'MTRS',
        purchaseRate: '',
        saleRate: '',
        minStock: 0,
        barcode: ''
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemName || !formData.designNo) {
      notifyWarning('Quality and Design No are mandatory');
      return;
    }

    setLoading(true);
    try {
      const result = await addItem(formData);
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      notifyError(err, 'Error saving item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Design Master" : "New Design Master (Ref: #10)"} className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <ERPSection title="Quality Information" icon={Package} className="grid grid-cols-2 gap-4">
           <FormField label="Item Name / Quality">
              <ERPInput value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} placeholder="e.g. Cotton Silk 60/60" />
           </FormField>
           <FormField label="Fabric Quality">
              <ERPInput value={formData.fabricQuality} onChange={(e) => setFormData({...formData, fabricQuality: e.target.value})} placeholder="e.g. 100% Cotton" />
           </FormField>
        </ERPSection>

        <ERPSection title="Design Details" icon={Layers} className="grid grid-cols-3 gap-4">
           <FormField label="Design No" icon={Hash}>
              <ERPInput value={formData.designNo} onChange={(e) => setFormData({...formData, designNo: e.target.value})} placeholder="D-101" />
           </FormField>
           <FormField label="Design Name" icon={Tag}>
              <ERPInput value={formData.designName} onChange={(e) => setFormData({...formData, designName: e.target.value})} placeholder="Butti Work" />
           </FormField>
           <FormField label="Default Unit">
              <ERPSelect 
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                options={[{value: 'MTRS', label: 'Meters (Mts)'}, {value: 'PCS', label: 'Pieces (Pcs)'}, {value: 'KGS', label: 'Kilograms (Kgs)'}]}
              />
           </FormField>
        </ERPSection>

        <div className="grid grid-cols-2 gap-4">
           <ERPSection title="Taxation" icon={Coins} className="grid grid-cols-2 gap-2">
              <FormField label="HSN Code">
                 <ERPSelect 
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({...formData, hsnCode: e.target.value})}
                    options={hsnCodes.map(h => ({ value: h.code, label: h.code }))}
                 />
              </FormField>
              <FormField label="GST Rate">
                 <ERPSelect 
                    value={formData.gstRate}
                    onChange={(e) => setFormData({...formData, gstRate: e.target.value})}
                    options={[{value: '5', label: '5%'}, {value: '12', label: '12%'}, {value: '18', label: '18%'}]}
                 />
              </FormField>
           </ERPSection>

           <ERPSection title="Standard Rates" icon={Scissors} className="grid grid-cols-2 gap-2">
              <FormField label="Pur. Rate">
                 <ERPInput type="number" value={formData.purchaseRate} onChange={(e) => setFormData({...formData, purchaseRate: e.target.value})} placeholder="0.00" />
              </FormField>
              <FormField label="Sale Rate">
                 <ERPInput type="number" value={formData.saleRate} onChange={(e) => setFormData({...formData, saleRate: e.target.value})} placeholder="0.00" />
              </FormField>
           </ERPSection>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
           <ERPButton variant="secondary" className="px-8" onClick={onClose}>Cancel</ERPButton>
           <ERPButton type="submit" className="flex-1">Save (F10)</ERPButton>
        </div>
      </form>
    </Modal>
  );
};

export default ItemModal;
