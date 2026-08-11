import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
window.Buffer = Buffer;
window.global = window;

// Fix for GramJS multiple buffer instances issue
const originalIsBuffer = Buffer.isBuffer;
Buffer.isBuffer = function(obj) {
  if (obj == null) return false;
  if (originalIsBuffer && originalIsBuffer(obj)) return true;
  if (obj._isBuffer === true) return true;
  if (obj instanceof Uint8Array) return true;
  if (obj.buffer instanceof ArrayBuffer && obj.byteLength !== undefined) return true;
  return false;
};

import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
