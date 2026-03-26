import React, { createContext, useContext, useState, useEffect } from 'react';
import { Ticket, TicketMessage, UrgencyLevel } from '../types';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { supabase } from '../lib/supabase';

interface ITSupportContextType {
  tickets: Ticket[];
  createTicket: (title: string, description: string, priority: UrgencyLevel) => Promise<string>;
  addMessage: (ticketId: string, text: string) => void;
  updateTicketStatus: (ticketId: string, status: Ticket['status'], resolution?: string) => void;
  assignTicket: (ticketId: string, adminId: string) => void;
}

const ITSupportContext = createContext<ITSupportContextType | undefined>(undefined);

export const ITSupportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const fetchTickets = async () => {
      const { data } = await supabase.from('it_tickets').select('*');
      if (data) setTickets(data);
    };
    fetchTickets();

    const channel = supabase.channel('public:it_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'it_tickets' }, payload => {
        fetchTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const createTicket = async (title: string, description: string, priority: UrgencyLevel) => {
    if (!user) throw new Error('User not authenticated');
    
    const newTicket: Ticket = {
      id: `TKT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      title,
      description,
      createdBy: user.email,
      status: 'Open',
      priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };

    setTickets(prev => [newTicket, ...prev]);
    await supabase.from('it_tickets').insert(newTicket);

    // Notify IT Admins (Mock IDs for now, in real app we'd filter users)
    // ben@zankli.com (24), emekao@zankli.com (25), mathew@zankli.com (26)
    setTimeout(() => {
      ['24', '25', '26'].forEach(adminId => {
        addNotification({
          userId: adminId,
          title: 'New IT Ticket',
          message: `New ticket created by ${user.email}: ${title}`,
          type: 'info',
          link: `/it-support`
        });
      });
    }, 0);

    return newTicket.id;
  };

  const addMessage = async (ticketId: string, text: string) => {
    if (!user) return;

    let updatedTicket: Ticket | undefined;

    setTickets(prev => prev.map(ticket => {
      if (ticket.id === ticketId) {
        const newMessage: TicketMessage = {
          id: Math.random().toString(),
          ticketId,
          senderId: user.id,
          text,
          createdAt: new Date().toISOString()
        };
        
        // Notify the other party
        setTimeout(() => {
          if (user.department === 'IT Support') {
             // Notify ticket creator
             addNotification({
               userId: ticket.createdBy,
               title: 'New Message on Ticket',
               message: `IT Support replied to your ticket "${ticket.title}": ${text.substring(0, 50)}...`,
               type: 'info',
               link: `/it-support`
             });
          } else {
             // Notify assigned admin or all admins
             if (ticket.assignedTo) {
               addNotification({
                 userId: ticket.assignedTo,
                 title: 'New Message on Ticket',
                 message: `User replied to ticket "${ticket.title}": ${text.substring(0, 50)}...`,
                 type: 'info',
                 link: `/it-support`
               });
             } else {
               ['24', '25', '26'].forEach(adminId => {
                  addNotification({
                    userId: adminId,
                    title: 'New Message on Ticket',
                    message: `User replied to ticket "${ticket.title}": ${text.substring(0, 50)}...`,
                    type: 'info',
                    link: `/it-support`
                  });
                });
             }
          }
        }, 0);

        updatedTicket = {
          ...ticket,
          messages: [...ticket.messages, newMessage],
          updatedAt: new Date().toISOString()
        };
        return updatedTicket;
      }
      return ticket;
    }));

    if (updatedTicket) {
      await supabase.from('it_tickets').update({
        messages: updatedTicket.messages,
        updatedAt: updatedTicket.updatedAt
      }).eq('id', ticketId);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: Ticket['status'], resolution?: string) => {
    let updatedTicket: Ticket | undefined;
    
    setTickets(prev => prev.map(ticket => {
      if (ticket.id === ticketId) {
        // Notify creator
        setTimeout(() => {
          addNotification({
            userId: ticket.createdBy,
            title: 'Ticket Updated',
            message: `Your ticket "${ticket.title}" is now ${status}.${resolution ? ` Resolution: ${resolution}` : ''}`,
            type: status === 'Resolved' ? 'success' : status === 'Unfixable' ? 'error' : 'info',
            link: `/it-support`
          });
        }, 0);

        updatedTicket = {
          ...ticket,
          status,
          resolution,
          updatedAt: new Date().toISOString()
        };
        return updatedTicket;
      }
      return ticket;
    }));

    if (updatedTicket) {
      await supabase.from('it_tickets').update({
        status: updatedTicket.status,
        resolution: updatedTicket.resolution,
        updatedAt: updatedTicket.updatedAt
      }).eq('id', ticketId);
    }
  };

  const assignTicket = async (ticketId: string, adminId: string) => {
    let updatedTicket: Ticket | undefined;
    
    setTickets(prev => prev.map(ticket => {
      if (ticket.id === ticketId) {
        // Notify assignee
        setTimeout(() => {
          addNotification({
            userId: adminId,
            title: 'Ticket Assigned',
            message: `You have been assigned to ticket "${ticket.title}"`,
            type: 'info',
            link: `/it-support`
          });
        }, 0);

        updatedTicket = {
          ...ticket,
          assignedTo: adminId,
          updatedAt: new Date().toISOString()
        };
        return updatedTicket;
      }
      return ticket;
    }));

    if (updatedTicket) {
      await supabase.from('it_tickets').update({
        assignedTo: updatedTicket.assignedTo,
        updatedAt: updatedTicket.updatedAt
      }).eq('id', ticketId);
    }
  };

  return (
    <ITSupportContext.Provider value={{ tickets, createTicket, addMessage, updateTicketStatus, assignTicket }}>
      {children}
    </ITSupportContext.Provider>
  );
};

export const useITSupport = () => {
  const context = useContext(ITSupportContext);
  if (context === undefined) {
    throw new Error('useITSupport must be used within an ITSupportProvider');
  }
  return context;
};
