import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './index.css'
import './nav.css'
import './tree.css'
import './motion.css'
import './skeleton.css'
import App from './App.tsx'

// /#admin loads the admin page as its own chunk, so players never download it. Anyone who is not an admin
// gets the normal app.
const AdminEntry = lazy(() => import('./admin/AdminEntry.tsx'))
const wantsAdmin = window.location.hash === '#admin'
// Same splash as index.html, so the screen does not go blank while the admin chunk loads.
const splash = (
  <div className="splash" role="status" aria-label="hapi skill">
    <span className="splash-brand" aria-hidden="true">hapi skill</span>
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {wantsAdmin ? (
      <Suspense fallback={splash}>
        <AdminEntry>
          <App />
        </AdminEntry>
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
