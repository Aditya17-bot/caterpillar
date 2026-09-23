import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import 'material-symbols/outlined.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import './legacy/legacy.css'
import App from './App.tsx'
import { CONVEX_URL } from './services/convex'

const app = <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {CONVEX_URL ? <ConvexProvider client={new ConvexReactClient(CONVEX_URL)}>{app}</ConvexProvider> : app}
  </StrictMode>,
)
