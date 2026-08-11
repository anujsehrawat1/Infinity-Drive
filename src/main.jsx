import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
window.Buffer = Buffer;
window.global = window;

// Fix for GramJS multiple buffer instances issue
const originalIsBuffer = Buffer.isBuffer;
Buffer.isBuffer = function(obj) {
  if (originalIsBuffer(obj)) return true;
  return obj != null && (
    obj._isBuffer === true || 
    (obj.constructor != null && obj.constructor.name === 'Buffer') ||
    typeof obj.readInt8 === 'function'
  );
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
