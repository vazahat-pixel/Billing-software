const ALL_SECTIONS = ['Master', 'Transaction', 'Records', 'Reports', 'Ledger', 'Utilities', 'Admin', 'Company'];

export const getPermissions = (companyRole = 'owner') => {
  const role = companyRole || 'owner';

  const sectionAccess = {
    owner: ALL_SECTIONS,
    admin: ALL_SECTIONS.filter(s => s !== 'Company'),
    accountant: ['Master', 'Records', 'Reports', 'Ledger'],
    sales: ['Transaction', 'Records'],
    viewer: ['Records', 'Reports', 'Ledger']
  };

  const canSave = !['viewer', 'accountant'].includes(role);
  const canManageUsers = ['owner', 'admin'].includes(role);
  const readOnlyMasters = ['viewer', 'accountant'].includes(role);

  return {
    role,
    canSave,
    canManageUsers,
    readOnly: role === 'viewer',
    readOnlyMasters,
    sections: sectionAccess[role] || ALL_SECTIONS,
    canAccessSection: (section) => (sectionAccess[role] || ALL_SECTIONS).includes(section)
  };
};
