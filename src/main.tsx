import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Latin subsets only — Inter is used solely by the intro's iMessage bubbles.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
