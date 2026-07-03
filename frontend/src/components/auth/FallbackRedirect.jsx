import { Navigate } from 'react-router-dom';
import { isOffline } from '../../utils/offlineHelpers';

/** Unknown routes: offline → login, online → portal */
const FallbackRedirect = () => (
  <Navigate to={isOffline() ? '/login' : '/portal'} replace />
);

export default FallbackRedirect;
