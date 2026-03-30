/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProcurementProvider } from './context/ProcurementContext';
import { VendorProvider } from './context/VendorContext';
import { InventoryProvider } from './context/InventoryContext';
import { EmailProvider } from './context/EmailContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { NotificationProvider } from './context/NotificationContext';
import { FacilityRequestProvider } from './context/FacilityRequestContext';
import { ITSupportProvider } from './context/ITSupportContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateRequest from './pages/CreateRequest';
import RequestList from './pages/RequestList';
import RequestDetails from './pages/RequestDetails';
import Vendors from './pages/Vendors';
import Inventory from './pages/Inventory';
import Email from './pages/Email';
import Workspace from './pages/Workspace';
import AccountingSuite from './pages/AccountingSuite';
import FacilityRequests from './pages/FacilityRequests';
import ITSupport from './pages/ITSupport';

import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <VendorProvider>
          <InventoryProvider>
            <FacilityRequestProvider>
              <ProcurementProvider>
                <EmailProvider>
                  <ITSupportProvider>
                    <WorkspaceProvider>
                      <BrowserRouter>
                        <Toaster position="top-right" richColors />
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/" element={<Layout />}>
                            <Route index element={<Dashboard />} />
                            <Route path="requests" element={<RequestList />} />
                            <Route path="requests/new" element={<CreateRequest />} />
                            <Route path="requests/edit/:id" element={<CreateRequest />} />
                            <Route path="requests/:id" element={<RequestDetails />} />
                            <Route path="vendors" element={<Vendors />} />
                            <Route path="inventory" element={<Inventory />} />
                            <Route path="email" element={<Email />} />
                            <Route path="workspace" element={<Workspace />} />
                            <Route path="accounting" element={<AccountingSuite />} />
                            <Route path="facility-requests" element={<FacilityRequests />} />
                            <Route path="it-support" element={<ITSupport />} />
                          </Route>
                        </Routes>
                      </BrowserRouter>
                    </WorkspaceProvider>
                  </ITSupportProvider>
                </EmailProvider>
              </ProcurementProvider>
            </FacilityRequestProvider>
          </InventoryProvider>
        </VendorProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
