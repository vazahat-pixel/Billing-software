import useConfirmStore from '../store/useConfirmStore';

/**
 * Enterprise confirmation — replaces window.confirm().
 * @returns {Promise<boolean>}
 */
export function erpConfirm(options) {
  if (typeof options === 'string') {
    return useConfirmStore.getState().open({ message: options });
  }
  return useConfirmStore.getState().open(options);
}

export function erpConfirmDelete(entityName = 'this record') {
  return erpConfirm({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete ${entityName}? This action may affect linked transactions.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
  });
}
