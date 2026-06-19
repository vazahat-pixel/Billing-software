const ALL_SECTIONS = [
  'Master',
  'Transaction',
  'Inventory',
  'Reports',
  'Others Reports',
  'Ledger',
  'Utilities',
  'Setup System',
  'Admin',
  'Company',
  'Records'
];

export const getPermissions = (companyRole = 'owner', systemRole = 'user') => {
  if (systemRole === 'super_admin') {
    return {
      role: 'owner',
      canSave: true,
      canManageUsers: true,
      readOnly: false,
      readOnlyMasters: false,
      sections: ALL_SECTIONS,
      canAccessSection: () => true
    };
  }

  const role = companyRole || 'owner';

  const sectionAccess = {
    owner: ALL_SECTIONS,
    admin: ALL_SECTIONS.filter(s => s !== 'Company'),
    accountant: ['Master', 'Transaction', 'Inventory', 'Records', 'Reports', 'Others Reports', 'Ledger'],
    sales: ['Transaction', 'Inventory', 'Records', 'Reports', 'Others Reports'],
    viewer: ['Records', 'Reports', 'Others Reports', 'Ledger']
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
