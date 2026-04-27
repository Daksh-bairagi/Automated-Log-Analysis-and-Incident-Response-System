/**
 * ============================================================================
 * MAIN ENTRY POINT — React Application Bootstrap
 * ============================================================================
 * Mounts the root App component into the DOM. Imports the global CSS
 * design system which applies the dark theme, typography, and all
 * component styles.
 * ============================================================================
 */

import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <App />
);
