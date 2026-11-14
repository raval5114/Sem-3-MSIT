import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PwaInstallControl from './components/PwaInstallControl.tsx'
import './polish.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <PwaInstallControl />
    </>
  </StrictMode>,
)
