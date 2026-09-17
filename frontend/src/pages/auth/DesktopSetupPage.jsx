/**
 * Replaced by DesktopActivatePage — provisioning-pack activation.
 * Kept as a redirect so old bookmarks/links to /setup still work.
 */
import { Navigate } from 'react-router-dom';

export default function DesktopSetupPage() {
  return <Navigate to="/activate" replace />;
}
