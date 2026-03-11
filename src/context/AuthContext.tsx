import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Department } from '../types';
import { supabase } from '../lib/supabase';

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
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Listen for Supabase auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const loggedInUser: User = {
            id: profile.id,
            email: profile.email,
            department: profile.department as Department,
            role: profile.role as any,
          };
          setUser(loggedInUser);
          localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
        }
      } else {
        setUser(null);
        localStorage.removeItem('zankli_user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string) => {
    if (!password) throw new Error('Password is required');

    // 1. Try to log in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // 2. If login fails, check if they are a legacy MOCK_USER that needs to be migrated
    if (error) {
      const mockUser = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (mockUser) {
        // Auto-migrate: Sign them up to Supabase in the background
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              department: mockUser.department,
              role: mockUser.role,
            },
          },
        });

        // If they are already registered but login failed, it might be a password mismatch
        // or the profile trigger failed. Let's just log them in locally for now if they match MOCK_USERS
        if (signUpError && (signUpError.message.includes('already registered') || signUpError.message.includes('rate limit') || signUpError.status === 429)) {
           console.warn('Auto-migration warning:', signUpError.message);
           const loggedInUser: User = {
            id: mockUser.id,
            email: mockUser.email,
            department: mockUser.department as Department,
            role: mockUser.role as any,
          };
          setUser(loggedInUser);
          localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
          return;
        }

        if (signUpError) {
          throw new Error(`Migration failed: ${signUpError.message}`);
        }
        
        // Wait briefly for the auth state change to pick up the profile
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Manually set the user so the UI updates immediately
        const loggedInUser: User = {
          id: signUpData.user?.id || mockUser.id,
          email: mockUser.email,
          department: mockUser.department as Department,
          role: mockUser.role as any,
        };
        setUser(loggedInUser);
        localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
        return;
      }
      
      throw error;
    }

    // If standard login succeeds, manually fetch profile to resolve promise immediately
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        const loggedInUser: User = {
          id: profile.id,
          email: profile.email,
          department: profile.department as Department,
          role: profile.role as any,
        };
        setUser(loggedInUser);
        localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
      } else {
         // Fallback if profile trigger failed
         const mockUser = MOCK_USERS.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (mockUser) {
           const loggedInUser: User = {
            id: data.user.id,
            email: mockUser.email,
            department: mockUser.department as Department,
            role: mockUser.role as any,
          };
          setUser(loggedInUser);
          localStorage.setItem('zankli_user', JSON.stringify(loggedInUser));
        }
      }
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('zankli_user');
  };

  const verifyPassword = (password: string) => {
    // For legacy verification (like in signatures), we still check the mock users
    // since Supabase doesn't allow extracting passwords.
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
