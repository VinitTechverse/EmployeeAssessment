import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ManagerPage from './pages/ManagerPage.jsx'
import EmployeePortal from './pages/EmployeePortal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<App />} />
        <Route path="/manager"   element={<ManagerPage />} />
        <Route path="/my-review" element={<EmployeePortal />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
