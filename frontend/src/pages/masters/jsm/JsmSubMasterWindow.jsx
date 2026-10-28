import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import JsmFormCanvas from '../../../components/jsm/JsmFormCanvas';
import JsmFindList from '../../../components/jsm/JsmFindList';
import useStore from '../../../store/useStore';
import { erpConfirmDelete } from '../../../utils/confirm';
import { notifyError, notifySuccess, notifyWarning } from '../../../utils/notify';
import LAYOUTS from './jsmMasterLayouts.json';
import { JSM_SUBMASTER_FORMS, recordToValues, valuesToPayload, nextCodeOf, isValidGstin } from './jsmSubMasterForms';
import { stateCodeFromGstin, stateNameFromCode } from '../../../utils/gstStateCodes';

/**
 * Simple masters (Station, Transport, Unit, Type, Item Group, Tax Slab, Book Type, Party Bank,
 * Area, Colour, Size) drawn and run exactly as JSM:
 *  - opens on the last record, boxes greyed, focus on New
 *  - New / Edit open the boxes; Save / Cancel close them again
 *  - Find / Sp.Find open the Help list (Sp.Find matches anywhere in the name)
 *  - Esc: cancels New/Edit, otherwise closes the window
 */
export default function JsmSubMasterWindow({ isOpen, onClose, type, readOnly = false }) {
  const cfg = JSM_SUBMASTER_FORMS[type];
  const layout = LAYOUTS[cfg?.form];
  const { subMasters, fetchSubMasters, addSubMaster, updateSubMaster, deleteSubMaster } = useStore();
  const [mode, setMode] = useState('VIEW'); // VIEW | ADD | EDIT
  const [currentId, setCurrentId] = useState(null);
  const [values, setValues] = useState({});
  const [find, setFind] = useState(null); // null | 'starts' | 'contains'
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);

  const records = useMemo(
    () => subMasters.filter((r) => r.type === type).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
    [subMasters, type],
  );
  const current = records.find((r) => r._id === currentId) || null;

  const focusBox = (name) => setTimeout(() => {
    const el = wrapRef.current?.querySelector(`[data-jsm="${name}"]`);
    el?.focus();
    if (el?.select) el.select();
  }, 30);

  const show = (rec) => {
    setCurrentId(rec?._id || null);
    setValues(rec ? recordToValues(cfg, rec) : {});
    setMode('VIEW');
  };

  useEffect(() => {
    if (!isOpen || !cfg) return;
    setLoaded(false);
    setFind(null);
    Promise.resolve(fetchSubMasters(type)).finally(() => setLoaded(true));
  }, [isOpen, type]);

  // JSM DataBind: show the last record
  useEffect(() => {
    if (!isOpen || !loaded) return;
    show(records[records.length - 1]);
    focusBox('btn_New');
  }, [isOpen, loaded]);

  if (!isOpen || !cfg || !layout) return null;

  const editing = mode !== 'VIEW';
  const firstBox = cfg.name;

  const onChange = (box, val) => {
    setValues((prev) => {
      const next = { ...prev, [box]: val };
      // JSM Mst_Tax_Slab: IGST% = SGST% + CGST%
      if (type === 'ItemTaxSlab' && (box === 'txt_sgst_per' || box === 'txt_cgst_per')) {
        const sum = Number(next.txt_sgst_per || 0) + Number(next.txt_cgst_per || 0);
        next.txt_igst_per = String(Math.round(sum * 1000) / 1000);
      }
      return next;
    });
  };

  const fieldProps = {};
  for (const [box, d] of Object.entries(cfg.decimals || {})) {
    fieldProps[box] = {
      align: cfg.align?.[box],
      onBlur: () => setValues((prev) => {
        const n = Number(prev[box]);
        return Number.isFinite(n) ? { ...prev, [box]: n.toFixed(d) } : prev;
      }),
    };
  }
  for (const [box, options] of Object.entries(cfg.options || {})) fieldProps[box] = { ...(fieldProps[box] || {}), options };
  for (const [radio, [box, val]] of Object.entries(cfg.radios || {})) {
    fieldProps[radio] = {
      checked: String(values[box] || '').toUpperCase() === val.toUpperCase(),
      onCheck: () => onChange(box, val),
    };
  }
  // text JSM puts in this label in Form_Load
  if (type === 'City') fieldProps.lbl_note = { text: 'Note :- Enter Pincode Then Get Distance.' };

  const doNew = () => {
    if (readOnly) return;
    setCurrentId(null);
    setValues(recordToValues(cfg, null));
    setMode('ADD');
    focusBox(firstBox);
  };
  const doEdit = () => {
    if (readOnly || !current) return;
    setMode('EDIT');
    focusBox(firstBox);
  };
  const doCancel = () => {
    show(current || records[records.length - 1]);
    focusBox('btn_New');
  };
  const doSave = async () => {
    const name = String(values[cfg.name] || '').trim();
    if (!name) {
      notifyWarning('Name can not be blank');
      focusBox(firstBox);
      return;
    }
    const dup = records.find((r) => r._id !== currentId && String(r.name || '').trim().toUpperCase() === name.toUpperCase());
    if (dup) {
      notifyWarning(`Duplicate Name : ${name}`);
      focusBox(firstBox);
      return;
    }
    setBusy(true);
    try {
      const payload = valuesToPayload(cfg, type, values, mode === 'EDIT' ? current : null, nextCodeOf(records));
      const saved = mode === 'EDIT' && current
        ? await updateSubMaster(current._id, payload)
        : await addSubMaster(payload);
      notifySuccess(mode === 'EDIT' ? 'Record updated' : 'Record saved');
      setCurrentId(saved?._id || currentId);
      setValues(saved ? recordToValues(cfg, saved) : values);
      setMode('VIEW');
      focusBox('btn_New');
    } catch (err) {
      notifyError(err, 'Failed to save record');
    } finally {
      setBusy(false);
    }
  };
  const doDelete = async () => {
    if (readOnly || !current) return;
    if (!(await erpConfirmDelete(current.name))) return;
    try {
      await deleteSubMaster(current._id);
      notifySuccess('Record deleted');
      const rest = records.filter((r) => r._id !== current._id);
      show(rest[rest.length - 1]);
      focusBox('btn_New');
    } catch (err) {
      notifyError(err, 'Failed to delete record');
    }
  };

  const can = (on) => ({ enabled: on && !busy });
  const buttons = {
    btn_New: { ...can(!editing && !readOnly), onClick: doNew },
    btn_Edit: { ...can(!editing && !!current && !readOnly), onClick: doEdit },
    btn_sv: { ...can(editing), onClick: doSave },
    btn_cn: { ...can(editing), onClick: doCancel },
    btn_Find: { ...can(!editing && records.length > 0), onClick: () => setFind('starts') },
    Btn_Sp_Find: { ...can(!editing && records.length > 0), onClick: () => setFind('contains') },
    btn_Del: { ...can(!editing && !!current && !readOnly), onClick: doDelete },
    btn_Exit: { ...can(!editing), onClick: onClose },
    Btn_Gst_Check: {
      ...can(editing),
      onClick: () => {
        const g = String(values.txt_gstn_no || '').trim().toUpperCase();
        if (!g) { notifyWarning('Enter GSTN No'); focusBox('txt_gstn_no'); return; }
        if (!isValidGstin(g)) { notifyWarning(`Invalid GSTIN : ${g}`); focusBox('txt_gstn_no'); return; }
        const state = stateNameFromCode(stateCodeFromGstin(g));
        setValues((prev) => ({ ...prev, txt_gstn_no: g, TXT_STATE: prev.TXT_STATE || String(state || '').toUpperCase() }));
        notifySuccess('GSTIN is valid. Online name/address fetch is not available here; please type them.');
      },
    },
    Btn_Import: {
      ...can(!editing),
      onClick: () => notifyWarning('Transport import from Excel is not available yet.'),
    },
    Btn_get_distance: {
      ...can(editing),
      onClick: () => notifyWarning('Distance lookup needs the internet map service; please type the distance in K/M.'),
    },
  };

  const onKeyDown = (e) => {
    if (e.key !== 'Escape' || find) return;
    e.preventDefault();
    e.stopPropagation();
    if (editing) doCancel();
    else onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare enableEscape={false} className="!max-w-none !w-auto">
      {/* data-enter-nav="off": JSM moves between boxes itself (tab order), not the app-wide Enter keys */}
      <div ref={wrapRef} className="jsm-window" data-enter-nav="off" onKeyDown={onKeyDown}>
        <div className="jsm-titlebar">
          <span>{layout.title}</span>
          <button type="button" className="jsm-titlebar-close" onClick={() => (editing ? doCancel() : onClose?.())} title="Close">✕</button>
        </div>
        <JsmFormCanvas
          layout={layout}
          values={values}
          onChange={onChange}
          fieldsEnabled={editing}
          buttons={buttons}
          fieldProps={fieldProps}
        />
        {find && (
          <JsmFindList
            layout={LAYOUTS.Help_Lst_Vw4}
            items={records}
            match={find}
            onPick={(rec, edit) => {
              setFind(null);
              show(rec);
              if (edit && !readOnly) { setMode('EDIT'); focusBox(firstBox); } else focusBox('btn_Edit');
            }}
            onNew={() => { setFind(null); doNew(); }}
            onClose={() => { setFind(null); focusBox('btn_Find'); }}
          />
        )}
      </div>
    </Modal>
  );
}
