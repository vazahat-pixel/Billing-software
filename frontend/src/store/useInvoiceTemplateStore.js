import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeTemplateId, INVOICE_TEMPLATE_IDS } from '../components/invoice-templates/templateCatalog';

export { INVOICE_TEMPLATE_IDS };

/**
 * Additive UI preference for invoice templates.
 * Does not alter sales/invoice business data — display preference only.
 */
const useInvoiceTemplateStore = create(
  persist(
    (set, get) => ({
      selectedTemplateId: 'gst-formal',
      pageSize: 'a4',
      zoom: 85,
      copyLabel: 'ORIGINAL',
      forceTemplate: false,
      showFestivalGreeting: false,
      festiveSuggestionDismissed: false,

      setSelectedTemplateId: (id) => {
        const normalized = normalizeTemplateId(id);
        set({ selectedTemplateId: normalized, forceTemplate: true });
      },

      setPageSize: (pageSize) => set({ pageSize }),
      setZoom: (zoom) => set({ zoom: Math.min(150, Math.max(50, Number(zoom) || 100)) }),
      setCopyLabel: (copyLabel) => set({ copyLabel }),
      setShowFestivalGreeting: (v) => set({ showFestivalGreeting: !!v }),
      dismissFestiveSuggestion: () => set({ festiveSuggestionDismissed: true }),
      clearForceTemplate: () => set({ forceTemplate: false }),

      applyFestiveAuto: () =>
        set({ selectedTemplateId: 'festive-edition', forceTemplate: false }),

      hydrateFromSettings: (settings = {}) => {
        const next = {};
        if (settings.invoiceTemplateId) {
          let raw = settings.invoiceTemplateId;
          // Stock / festive defaults → professional GST Formal
          if (raw === 'classic-ledger' || raw === 'festive-edition') raw = 'gst-formal';
          next.selectedTemplateId = normalizeTemplateId(raw);
          next.forceTemplate = true;
        }
        if (typeof settings.showFestivalGreeting === 'boolean') {
          next.showFestivalGreeting = settings.showFestivalGreeting;
        }
        if (Object.keys(next).length) set(next);
      },

      getPreferencePayload: () => {
        const s = get();
        return {
          invoiceTemplateId: s.selectedTemplateId,
          showFestivalGreeting: s.showFestivalGreeting,
        };
      },
    }),
    {
      name: 'invoice-template-prefs',
      version: 4,
      migrate: (persistedState, version) => {
        if (!persistedState) return persistedState;
        let next = { ...persistedState };
        if (version < 2) {
          next = { ...next, selectedTemplateId: 'gst-formal', forceTemplate: true };
        }
        if (version < 3) {
          next = {
            ...next,
            selectedTemplateId:
              next.selectedTemplateId === 'festive-edition'
                ? 'gst-formal'
                : next.selectedTemplateId || 'gst-formal',
            forceTemplate: true,
          };
        }
        if (version < 4) {
          next = { ...next, zoom: 85, pageSize: 'a4' };
        }
        return next;
      },
      partialize: (s) => ({
        selectedTemplateId: s.selectedTemplateId,
        pageSize: s.pageSize,
        zoom: s.zoom,
        copyLabel: s.copyLabel,
        forceTemplate: s.forceTemplate,
        showFestivalGreeting: s.showFestivalGreeting,
      }),
    }
  )
);

export default useInvoiceTemplateStore;
