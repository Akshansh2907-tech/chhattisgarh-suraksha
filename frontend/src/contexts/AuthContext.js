// Re-export AuthContext implementations from the .jsx module to ensure
// Vite's import analysis sees JSX in a .jsx file. Keep this file as a JS
// re-export to preserve imports elsewhere that point to './contexts/AuthContext'.
export { AuthProvider, useAuth } from './AuthContext.jsx';