/** @deprecated Use CompanySettingsModal with initialTab="users" */
import CompanySettingsModal from '../settings/CompanySettingsModal';

const UserRightsModal = ({ isOpen, onClose }) => (
  <CompanySettingsModal isOpen={isOpen} onClose={onClose} initialTab="users" />
);

export default UserRightsModal;
