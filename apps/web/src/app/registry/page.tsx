import { Navigate } from 'react-router-dom'

export default function RegistryRedirectPage() {
  return <Navigate to="/admin?tab=registry" replace />
}
