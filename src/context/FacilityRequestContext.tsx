import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface FacilityRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  department: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
}

interface FacilityRequestContextType {
  facilityRequests: FacilityRequest[];
  addFacilityRequest: (request: Omit<FacilityRequest, 'id' | 'createdAt' | 'status'>) => void;
  updateFacilityRequestStatus: (id: string, status: 'Pending' | 'Completed') => void;
}

const FacilityRequestContext = createContext<FacilityRequestContextType | undefined>(undefined);

export const FacilityRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [facilityRequests, setFacilityRequests] = useState<FacilityRequest[]>([]);

  useEffect(() => {
    const fetchReqs = async () => {
      const { data } = await supabase.from('facility_requests').select('*');
      if (data) setFacilityRequests(data);
    };
    fetchReqs();
  }, []);

  const addFacilityRequest = async (request: Omit<FacilityRequest, 'id' | 'createdAt' | 'status'>) => {
    const newRequest: FacilityRequest = {
      ...request,
      id: `FR-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setFacilityRequests(prev => [newRequest, ...prev]);
    await supabase.from('facility_requests').insert(newRequest);
  };

  const updateFacilityRequestStatus = async (id: string, status: 'Pending' | 'Completed') => {
    setFacilityRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status } : req
    ));
    await supabase.from('facility_requests').update({ status }).eq('id', id);
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
