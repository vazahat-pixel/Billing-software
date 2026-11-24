import { Navigate } from 'react-router-dom';

/** Unknown routes go to the ERP login. The admin panel is reached only at /admin/login. */
const FallbackRedirect = () => <Navigate to="/login" replace />;

export default FallbackRedirect;
