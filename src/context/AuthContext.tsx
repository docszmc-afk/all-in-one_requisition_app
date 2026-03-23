import React, { createContext, useContext, useState } from 'react';
import { User, Department } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  verifyPassword: (password: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const MOCK_USERS = [
  { id: '1', email: 'labzankli@gmail.com', password: 'labreq1', department: 'Laboratory', role: 'Creator' },
  { id: '2', email: 'storezankli@gmail.com', password: 'storereq2', department: 'Pharmacy', role: 'Both' },
  { id: '3', email: 'zanklia90@gmail.com', password: 'zankli360', department: 'Facility', role: 'Creator' },
  { id: '4', email: 'samuel@zankli.com', password: 'ceejay', department: 'Facility', role: 'Creator' },
  { id: '5', email: 'joydaniels@zankli.com', password: 'Joy123', department: 'Facility', role: 'Creator' },
  { id: '6', email: 'toyinpeter@zankli.com', password: 'tpeter123', department: 'Facility', role: 'Creator' },
  { id: '7', email: 'faithsb@zankli.com', password: 'Sugar080', department: 'Facility', role: 'Creator' },
  { id: '8', email: 'acct.zankli@gmail.com', password: 'ayozank', department: 'Accounts', role: 'Approver' },
  { id: '9', email: 'auditorzankli@gmail.com', password: 'zankliaudit1', department: 'Audit', role: 'Approver' },
  { id: '10', email: 'auditor2zankli@gmail.com', password: 'uche2audit', department: 'Audit', role: 'Approver' },
  { id: '11', email: 'billingdepartmentzankli@gmail.com', password: 'kaysp101', department: 'Billing', role: 'Both' },
  { id: '12', email: 'chairmanzankli@gmail.com', password: 'funky101', department: 'Chairman', role: 'Approver' },
  { id: '13', email: 'docs.zmc@gmail.com', password: 'topsy360', department: 'Doctors', role: 'Both' },
  { id: '14', email: 'frontdeskdepartmentzankli@gmail.com', password: 'zankfrontdesk', department: 'Front Desk', role: 'Both' },
  { id: '15', email: 'hofzankli@gmail.com', password: 'vince1234', department: 'HOF', role: 'Approver' },
  { id: '16', email: 'mdzankli@gmail.com', password: 'mdzank101', department: 'MD', role: 'Approver' },
  { id: '17', email: 'zanklihr@gmail.com', password: 'henryhr101', department: 'HR', role: 'Both' },
  { id: '18', email: 'zankliinternalmedicine@gmail.com', password: 'zanklinternalmed', department: 'Internal Medicine', role: 'Both' },
  { id: '19', email: 'zanklilab@gmail.com', password: 'onyizanklab', department: 'Laboratory', role: 'Both' },
  { id: '20', email: 'zanklinursing@gmail.com', password: 'antomatron', department: 'Nursing', role: 'Both' },
  { id: '21', email: 'zanklipaediatrics@gmail.com', password: 'aminpaed1', department: 'Paediatrics', role: 'Both' },
  { id: '22', email: 'zanklipharmacy@gmail.com', password: 'naffpharm2', department: 'Pharmacy', role: 'Both' },
  { id: '23', email: 'zankliradiology@gmail.com', password: 'amah102x', department: 'Radiology', role: 'Both' },
  { id: '24', email: 'ben@zankli.com', password: 'beak1012', department: 'IT Support', role: 'Both' },
  { id: '25', email: 'emekao@zankli.com', password: 'mekuslalalol', department: 'IT Support', role: 'Both' },
  { id: '26', email: 'mathew@zankli.com', password: 'ademat232', department: 'IT Support', role: 'Both' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('zankli_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  });

  const login = async (email: string, password?: string) => {
    const mockUser = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (mockUser) {
      const loggedInUser: User = {
        id: mockUser.id,
        email: mockUser.email,
        department: mockUser.department as Department,
        role: mockUser.role as any,
      };
      setUser(loggedInUser);
      localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
    } else {
      throw new Error('Invalid email or password');
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('zankli_user');
  };

  const verifyPassword = (password: string) => {
    if (!user) return false;
    const foundUser = MOCK_USERS.find(u => u.email === user.email);
    return foundUser?.password === password;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, verifyPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
