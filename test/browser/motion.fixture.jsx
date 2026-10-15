import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardPage from '../../src/app/dashboard/page';

createRoot(document.getElementById('root')).render(<StrictMode><DashboardPage /></StrictMode>);
