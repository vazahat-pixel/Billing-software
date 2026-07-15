import React, { useRef, useState } from 'react';
import { Upload, Sparkles, Check, X, ClipboardPaste, UserPlus, PackagePlus } from 'lucide-react';
import { purchasesApi, partiesApi, itemsApi } from '../api';
import { extractBillText, fileToDataUrl } from '../utils/billOcr';
import {
  parsePurchaseBillText,
  applyBillDraftToGrid,
  isBillDraftUseful,
  isGarbageName,
} from '../utils/billParseHelpers';
import { toast } from '../store/useToastStore';

/**
 * Upload supplier bill → server OCR/PDF parse → preview → auto-apply into purchase form.
 * Falls back to browser OCR, then paste-text when scan quality is poor.
 */
const BillAutoFill = ({ parties = [], items = [], disabled = false, onApply, onMastersChanged }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState(null);
  const [fileName, setFileName] = useState('');
  const [attachmentMeta, setAttachmentMeta] = useState(null);
  const [applied, setApplied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setDraft(null);
    setStatus('');
    setFileName('');
    setAttachmentMeta(null);
    setApplied(false);
    setPasteText('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const pushToForm = (parsed, meta) => {
    if (!onApply || !isBillDraftUseful(parsed)) return false;
    onApply({
      header: parsed.header,
      gridItems: applyBillDraftToGrid(parsed.items),
      footer: parsed.footer || {},
      attachment: meta,
      meta: parsed.meta,
    });
    setApplied(true);
    return true;
  };

  const finishWithDraft = (parsed, meta, sourceLabel) => {
    setDraft(parsed);
    setStatus('');
    const ok = pushToForm(parsed, meta);
    if (ok) {
      const bits = [];
      if (parsed.header.billNo) bits.push(`Bill# ${parsed.header.billNo}`);
      if (parsed.meta?.supplierName) bits.push(parsed.meta.supplierName);
      if (parsed.items?.length) bits.push(`${parsed.items.length} item(s)`);
      toast.success(`Bill synced${bits.length ? `: ${bits.join(' · ')}` : ''}${sourceLabel ? ` (${sourceLabel})` : ''}`);
    } else {
      toast.success('Bill scanned — review preview then Apply to Form');
    }
  };

  const parseLocally = async (text, masters) => {
    const parsed = parsePurchaseBillText(text, masters || { parties, items });
    if (!isBillDraftUseful(parsed)) {
      throw new Error(
        'Could not detect invoice / items. Paste text from the PDF (Ctrl+A → copy) or upload a clearer file.'
      );
    }
    return parsed;
  };

  /** Prefer backend parse; fall back to browser OCR + local parse. */
  const runParse = async ({ file, text }) => {
    setBusy(true);
    setDraft(null);
    setApplied(false);
    try {
      if (file) setFileName(file.name);
      let parsed = null;
      let sourceLabel = '';

      setStatus('Reading bill on server…');
      try {
        parsed = await purchasesApi.parseBill({ file, text });
        sourceLabel = parsed?.meta?.extractSource || 'server';
      } catch (apiErr) {
        // Soft fallback for offline / old backend
        if (text) {
          setStatus('Parsing pasted text…');
          parsed = await parseLocally(text);
          sourceLabel = 'paste';
        } else if (file) {
          setStatus('Server busy — reading in browser…');
          const localText = await extractBillText(file, setStatus);
          if (!localText || localText.length < 15) {
            throw apiErr;
          }
          parsed = await parseLocally(localText);
          sourceLabel = 'browser';
          if (parsed.meta?.confidence?.ocr === 'poor' || (parsed.meta?.textScore || 0) < 3) {
            setShowPaste(true);
            throw new Error(
              'Photo OCR was unclear (items not readable). Paste invoice text below for 100% fill.'
            );
          }
        } else {
          throw apiErr;
        }
      }

      if (!isBillDraftUseful(parsed)) {
        setShowPaste(true);
        throw new Error(
          'Bill fields incomplete. Paste the invoice text (from PDF) for a perfect fill.'
        );
      }

      let meta = attachmentMeta;
      if (file) {
        const previewUrl = await fileToDataUrl(file).catch(() => null);
        meta = {
          fileName: file.name,
          mimeType: file.type,
          previewUrl,
          extractedAt: new Date().toISOString(),
        };
        setAttachmentMeta(meta);
      }

      finishWithDraft(parsed, meta, sourceLabel);
      if (!(parsed.items || []).length) {
        setShowPaste(true);
        toast.error(
          'Vendor synced but line items missing — Paste Text from PDF (Ctrl+A → Copy) for item rows.'
        );
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to read bill';
      toast.error(msg);
      if (err.draft) setDraft(err.draft);
      setStatus('');
      setShowPaste(true);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runParse({ file });
  };

  const handlePasteParse = async () => {
    const text = pasteText.trim();
    if (text.length < 20) {
      toast.error('Paste more invoice text (bill no, GSTIN, item rows)…');
      return;
    }
    await runParse({ text });
  };

  const handleApply = () => {
    if (!draft || !onApply) return;
    pushToForm(draft, attachmentMeta);
    toast.success('Details filled — recheck & Save to add stock');
  };

  const handleAddVendor = async () => {
    const sug = draft?.meta?.suggestedParty;
    if (!sug?.name || isGarbageName?.(sug.name)) {
      toast.error('No seller name to add — type / select vendor manually');
      return;
    }
    setCreating(true);
    try {
      const created = await partiesApi.create({
        name: sug.name,
        type: 'Supplier',
        group: 'SUNDRY CREDITORS',
        gstin: sug.gstin || '',
        state: 'Gujarat',
        stateCode: '24',
      });
      await onMastersChanged?.();
      const id = created?._id || created?.id;
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              header: {
                ...prev.header,
                party: id,
                gstin: created.gstin || sug.gstin || prev.header.gstin,
                city: created.city || prev.header.city,
                add: created.address || prev.header.add,
              },
              meta: {
                ...prev.meta,
                confidence: { ...prev.meta?.confidence, party: 'matched' },
                suggestedParty: null,
              },
            }
          : prev
      );
      pushToForm(
        {
          ...draft,
          header: {
            ...draft.header,
            party: id,
            gstin: created.gstin || sug.gstin || draft.header.gstin,
          },
          meta: { ...draft.meta, confidence: { ...draft.meta?.confidence, party: 'matched' } },
        },
        attachmentMeta
      );
      toast.success(`Vendor added: ${sug.name}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not add vendor');
    } finally {
      setCreating(false);
    }
  };

  const handleAddItems = async () => {
    const list = draft?.meta?.suggestedItems || [];
    if (!list.length) {
      toast.error('No unmatched items to add');
      return;
    }
    setCreating(true);
    try {
      const createdMap = {};
      for (const sug of list) {
        const created = await itemsApi.create({
          name: sug.itemName || sug.name,
          itemName: sug.itemName || sug.name,
          hsnCode: sug.hsnCode || '',
          gstRate: sug.gstRate || 5,
          purchaseRate: sug.purchaseRate || 0,
          category: sug.category || 'Finished',
          unit: sug.unit || 'KGS',
        });
        createdMap[(sug.itemName || sug.name || '').toUpperCase()] = created;
      }
      await onMastersChanged?.();
      const nextItems = (draft.items || []).map((row) => {
        if (row.itemId) return row;
        const hit = createdMap[String(row.itemName || '').toUpperCase()];
        if (!hit) return row;
        return {
          ...row,
          itemId: hit._id || hit.id,
          unmatched: false,
        };
      });
      const next = {
        ...draft,
        items: nextItems,
        meta: {
          ...draft.meta,
          suggestedItems: [],
          confidence: {
            ...draft.meta?.confidence,
            items: nextItems.every((i) => i.itemId) ? 'matched' : 'partial',
          },
        },
      };
      setDraft(next);
      pushToForm(next, attachmentMeta);
      toast.success(`Added ${list.length} item(s) to master`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Could not add items');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="classic-erp-frame space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-600" />
          <span className="classic-erp-label blue-label font-bold !w-auto">
            Auto Bill Fill — Upload Supplier Bill
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            className="hidden"
            disabled={disabled || busy}
            onChange={handleFile}
          />
          <button
            type="button"
            className="classic-erp-btn btn-blue flex items-center gap-1 text-[11px]"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            title="Upload PDF or photo of purchase bill from supplier"
          >
            <Upload size={12} />
            {busy ? 'Reading…' : 'Upload Bill PDF / Photo'}
          </button>
          <button
            type="button"
            className="classic-erp-btn flex items-center gap-1 text-[11px]"
            disabled={disabled || busy}
            onClick={() => setShowPaste((v) => !v)}
            title="Paste invoice text if OCR fails"
          >
            <ClipboardPaste size={12} />
            Paste Text
          </button>
          {(draft || fileName) && (
            <button type="button" className="classic-erp-btn text-[11px]" onClick={reset} disabled={busy}>
              <X size={12} className="inline" /> Clear
            </button>
          )}
        </div>
      </div>

      {(busy || status) && (
        <p className="text-[11px] text-slate-600 font-medium">{status || 'Working…'}</p>
      )}

      {showPaste && (
        <div className="space-y-1 border border-slate-300 bg-white rounded-sm p-2">
          <p className="text-[11px] text-slate-600">
            For 100% sync: open PDF → Ctrl+A → Copy → paste here (seller name, GSTIN, items with Kgs/Rate).
          </p>
          <textarea
            className="classic-erp-input w-full min-h-[88px] text-[11px] font-mono"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste full invoice text…"
            disabled={busy}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="classic-erp-btn btn-blue text-[11px]"
              disabled={busy || pasteText.trim().length < 20}
              onClick={handlePasteParse}
            >
              Parse Pasted Text
            </button>
          </div>
        </div>
      )}

      {applied && draft && (
        <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
          Form fields auto-filled from supplier bill — recheck Vendor / Items then Save.
        </p>
      )}

      {draft && (
        <div className="border border-slate-300 bg-slate-50 rounded-sm p-2 space-y-2 text-[11px]">
          <div className="font-bold text-slate-700 flex justify-between gap-2">
            <span>Extracted preview</span>
            <span className="font-normal text-slate-500">
              OCR: {draft.meta?.confidence?.ocr || '—'} · Party:{' '}
              {draft.meta?.confidence?.party || '—'} · Items:{' '}
              {draft.meta?.confidence?.items || '—'}
              {draft.meta?.extractSource ? ` · via ${draft.meta.extractSource}` : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-500">Supplier Bill#</span>
              <div className="font-semibold">{draft.header.billNo || '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Date</span>
              <div className="font-semibold">{draft.header.billDate || '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">GSTIN</span>
              <div className="font-semibold">{draft.header.gstin || '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Round off</span>
              <div className="font-semibold">{draft.footer?.roundOff ?? '—'}</div>
            </div>
          </div>
          {draft.meta?.supplierName && (
            <p className="text-slate-600">
              Supplier (seller): <b>{draft.meta.supplierName}</b>
              {draft.meta.supplierGstin ? ` · ${draft.meta.supplierGstin}` : ''}
            </p>
          )}
          {!draft.header.party && (
            <div className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex flex-wrap items-center justify-between gap-2">
              <span>
                Vendor not matched — select / add seller (e.g. HARSHIKA TEX FAB). Do not pick Billed To.
              </span>
              {draft.meta?.suggestedParty?.name && (
                <button
                  type="button"
                  className="classic-erp-btn btn-blue text-[11px] flex items-center gap-1"
                  disabled={creating || busy}
                  onClick={handleAddVendor}
                >
                  <UserPlus size={12} />
                  Add {draft.meta.suggestedParty.name}
                </button>
              )}
            </div>
          )}
          {(draft.items || []).some((r) => !r.itemId) && (
            <div className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex flex-wrap items-center justify-between gap-2">
              <span>Some items need Item master link (qty/rate are filled).</span>
              {(draft.meta?.suggestedItems || []).length > 0 && (
                <button
                  type="button"
                  className="classic-erp-btn btn-blue text-[11px] flex items-center gap-1"
                  disabled={creating || busy}
                  onClick={handleAddItems}
                >
                  <PackagePlus size={12} />
                  Add {draft.meta.suggestedItems.length} item(s)
                </button>
              )}
            </div>
          )}
          <div className="overflow-x-auto max-h-40">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-200 text-left">
                  <th className="px-1 py-0.5">Item</th>
                  <th className="px-1 py-0.5">Pcs</th>
                  <th className="px-1 py-0.5">Kgs/Mts</th>
                  <th className="px-1 py-0.5">Rate</th>
                  <th className="px-1 py-0.5">Amt</th>
                  <th className="px-1 py-0.5">Match</th>
                </tr>
              </thead>
              <tbody>
                {(draft.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-1 py-2 text-slate-500">
                      No line items detected — use Paste Text from PDF for perfect item sync.
                    </td>
                  </tr>
                ) : (
                  draft.items.map((row, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-1 py-0.5">{row.itemName || row.desc}</td>
                      <td className="px-1 py-0.5">{row.pcs}</td>
                      <td className="px-1 py-0.5">{row.mts}</td>
                      <td className="px-1 py-0.5">{row.rate}</td>
                      <td className="px-1 py-0.5">{row.amount}</td>
                      <td className="px-1 py-0.5">{row.itemId ? 'OK' : 'Manual'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!applied && (
            <div className="flex justify-end gap-2">
              <button type="button" className="classic-erp-btn text-[11px]" onClick={reset}>
                Discard
              </button>
              <button
                type="button"
                className="classic-erp-btn btn-blue flex items-center gap-1 text-[11px] font-bold"
                onClick={handleApply}
              >
                <Check size={12} />
                Apply to Form
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BillAutoFill;
