import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts ship with the app instead of loading from Google, so visitors' browsers never contact Google.
// Only Latin letters (with accents) are included; add other subsets here if a language needs them.
import '@fontsource/oswald/latin-500.css'
import '@fontsource/oswald/latin-ext-500.css'
import '@fontsource/oswald/latin-600.css'
import '@fontsource/oswald/latin-ext-600.css'
import '@fontsource/oswald/latin-700.css'
import '@fontsource/oswald/latin-ext-700.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-ext-400.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/source-sans-3/latin-ext-600.css'
import '@fontsource/source-sans-3/latin-700.css'
import '@fontsource/source-sans-3/latin-ext-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
