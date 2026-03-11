import React, { createContext, useContext, useEffect } from 'react';
import { useSupabaseSync } from '../hooks/useSupabaseSync';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

export interface FacilityRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  department: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
  reminderSentAt?: string;
}

interface FacilityRequestContextType {
  facilityRequests: FacilityRequest[];
  addFacilityRequest: (request: Omit<FacilityRequest, 'id' | 'createdAt' | 'status'>) => void;
  updateFacilityRequestStatus: (id: string, status: 'Pending' | 'Completed') => void;
}

const FacilityRequestContext = createContext<FacilityRequestContextType | undefined>(undefined);

export const FacilityRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [facilityRequests, setFacilityRequests, , forceSaveFacilityRequests] = useSupabaseSync<FacilityRequest[]>('facilityRequests', []);
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  // Reminder Logic for Pending Facility Requests
  useEffect(() => {
    if (!user || user.department !== 'Facility') return;
    if (!facilityRequests.length) return;

    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let hasUpdates = false;

    const updatedRequests = facilityRequests.map(req => {
      if (req.status !== 'Pending') return req;

      const createdDate = new Date(req.createdAt);
      const lastReminderStr = req.reminderSentAt || req.createdAt;
      const lastReminderDate = new Date(lastReminderStr);

      // Check if it's been 7 days since creation or last reminder
      if (now.getTime() - createdDate.getTime() >= SEVEN_DAYS_MS && 
          now.getTime() - lastReminderDate.getTime() >= SEVEN_DAYS_MS) {
        
        addNotification({
          userId: user.email,
          title: 'URGENT: Pending Facility Request',
          message: `Reminder: The facility request "${req.title}" has been pending for over a week. Please attend to it immediately.`,
          type: 'error',
          link: '/facility-requests'
        });

        hasUpdates = true;
        return {
          ...req,
          reminderSentAt: now.toISOString()
        };
      }

      return req;
    });

    if (hasUpdates) {
      setFacilityRequests(updatedRequests);
      if (forceSaveFacilityRequests) forceSaveFacilityRequests(updatedRequests);
    }
  }, [facilityRequests, user, addNotification, setFacilityRequests, forceSaveFacilityRequests]);

  const addFacilityRequest = (request: Omit<FacilityRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: FacilityRequest = {
      ...request,
      id: `FR-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    const newRequests = [newRequest, ...facilityRequests];
    setFacilityRequests(newRequests);
    if (forceSaveFacilityRequests) forceSaveFacilityRequests(newRequests);
  };

  const updateFacilityRequestStatus = (id: string, status: 'Pending' | 'Completed') => {
    const newRequests = facilityRequests.map(req => 
      req.id === id ? { ...req, status } : req
    );
    setFacilityRequests(newRequests);
    if (forceSaveFacilityRequests) forceSaveFacilityRequests(newRequests);
  };

  return (
    <FacilityRequestContext.Provider value={{ facilityRequests, addFacilityRequest, updateFacilityRequestStatus }}>
      {children}
    </FacilityRequestContext.Provider>
  );
};

export const useFacilityRequests = () => {
  const context = useContext(FacilityRequestContext);
  if (context === undefined) {
    throw new Error('useFacilityRequests must be used within a FacilityRequestProvider');
  }
  return context;
};
