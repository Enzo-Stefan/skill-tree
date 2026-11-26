import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './index.css'
import './nav.css'
import './tree.css'
import './motion.css'
import App from './App.tsx'

// /#admin loads the admin page as its own chunk, so players never download it. Anyone who is not an admin
// gets the normal app.
const AdminEntry = lazy(() => import('./admin/AdminEntry.tsx'))
const wantsAdmin = window.location.hash === '#admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {wantsAdmin ? (
      <Suspense fallback={null}>
        <AdminEntry>
          <App />
        </AdminEntry>
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
