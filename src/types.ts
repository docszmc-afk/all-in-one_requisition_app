declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type Department = 
  | 'Audit' 
  | 'Accounts' 
  | 'Laboratory' 
  | 'Pharmacy' 
  | 'Facility'
  | 'Billing'
  | 'Chairman'
  | 'Doctors'
  | 'Front Desk'
  | 'HOF'
  | 'MD'
  | 'HR'
  | 'Internal Medicine'
  | 'Nursing'
  | 'Paediatrics'
  | 'Radiology'
  | 'IT Support';

export interface User {
  id: string;
  email: string;
  department: Department;
  role: 'Creator' | 'Approver' | 'Both';
}

export type RequestStatus = 'Pending Audit' | 'Pending Accounts' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent Back';

export interface ApprovalRecord {
  approverId: string;
  status: 'Approved' | 'Rejected' | 'Sent Back';
  signature: string;
  notes?: string;
  date: string;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  approverIds: string[];
  creatorId: string;
}

export type UrgencyLevel = 'Low' | 'Normal' | 'High' | 'Critical';

export type RequestType = 
  | 'General'
  | 'Lab Purchase Order'
  | 'Histology Payment'
  | 'Equipment Request'
  | 'Pharmacy Purchase Order'
  | 'Emergency Drug Purchase (1 month)'
  | 'Emergency Drug Purchase (1 week)'
  | 'Daily Purchase'
  | 'Diesel Request'
  | 'Product Procurement'
  | 'Leave Request'
  | 'Store Requisition'
  | 'Issue From Store'
  | 'IT Procurement';

export interface Vendor {
  id: string;
  name: string;
  category: 'Lab/Store' | 'Facility' | 'Both';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  inStock: number;
  unitCost: number;
}

export interface ProcurementItem {
  id: string;
  name: string;
  quantity: number;
  estimatedCost: number; // Used as Unit Price or general cost
  description?: string;
  unit?: string;
  stockLevel?: string;
  supplier?: string;
  inventoryItemId?: string; // Link to inventory if selected from store
  isManual?: boolean; // For store requisition manual inputs
  availability?: 'In Stock' | 'Out of Stock' | 'Partial';
  recommendedPrice?: number;
  audit1RecommendedPrice?: number;
  audit1DifferenceReason?: string;
  audit2RecommendedPrice?: number;
  audit2DifferenceReason?: string;
  flagged?: boolean;
  flagReason?: string;
  aiMarketPrice?: string;
  isBought?: boolean;
  isInspected?: boolean;
  inspectedBy?: string;
  inspectedAt?: string;
}

export interface HistologyDetails {
  date: string;
  patientName: string;
  hospNo: string;
  labNo: string;
  outsourceService: string;
  outsourceBill: number;
  zmcCharges: number;
  receiptHmo: string;
  retainership: string;
  // Audit fields
  audit1RecommendedPrice?: number;
  audit1DifferenceReason?: string;
  audit2RecommendedPrice?: number;
  audit2DifferenceReason?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface PaymentDetails {
  date: string;
  payee: string;
  amount: number;
  purpose: string;
}

export interface DieselDetails {
  dateOfRequisition: string;
  issuerName: string;
  volumeLiters: number;
  dieselRemainingLiters: number;
  costPerLiter: number;
  vendorId: string; // 'manual' or actual ID
  manualVendorName?: string;
}

export interface ProductProcurementDetails {
  dateOfRequisition: string;
  issuerName: string;
  department: Department;
  vendorId?: string;
  manualVendorName?: string;
}

export interface LeaveDetails {
  dateOfRequisition: string;
  issuerName: string;
  applicantName: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  leaveBalance?: number;
  purpose: string;
}

export interface StoreRequisitionDetails {
  dateOfRequisition: string;
  issuerName: string;
}

export interface IssueFromStoreDetails {
  dateOfRequisition: string;
  issuerName: string;
  departmentToIssueTo: Department;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  data: string; // Base64 encoded string
}

export interface EmailMessage {
  id: string;
  senderId: string;
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  replyToId?: string;
  readBy: string[];
  archivedBy: string[];
  deletedBy: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Todo' | 'In Progress' | 'Review' | 'Done';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeIds: string[];
  creatorId: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface ProcurementRequest {
  id: string;
  title: string;
  description: string;
  department: Department;
  createdBy: string;
  createdAt: string;
  items: ProcurementItem[];
  totalAmount: number;
  recommendedAmount?: number;
  status: RequestStatus | 'Draft';
  auditNotes?: string;
  auditSignature?: string;
  accountsNotes?: string;
  accountsSignature?: string;
  requestType?: RequestType;
  urgencyLevel?: UrgencyLevel;
  histologyDetails?: HistologyDetails; // Kept for backward compatibility
  histologyDetailsList?: HistologyDetails[];
  paymentDetails?: PaymentDetails;
  dieselDetails?: DieselDetails;
  productProcurementDetails?: ProductProcurementDetails;
  leaveDetails?: LeaveDetails;
  storeRequisitionDetails?: StoreRequisitionDetails;
  issueFromStoreDetails?: IssueFromStoreDetails;
  creatorSignature?: string;
  workflow?: string[]; // Array of user IDs
  currentApproverIndex?: number;
  approvals?: ApprovalRecord[];
  attachments?: Attachment[];
  isDraft?: boolean;
  parentRequestId?: string;
  splitSupplier?: string;
  voidedApprovers?: { approverId: string; reason: string; date: string }[];
  paymentStatus?: 'Pending' | 'Paid';
  paymentInvoice?: Attachment;
  paymentDate?: string;
  accountNumberRequested?: boolean;
  isBought?: boolean;
  isInspected?: boolean;
  inspectedBy?: string;
  inspectedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  text: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  createdBy: string; // User ID or Email
  assignedTo?: string; // User ID of IT admin
  status: 'Open' | 'In Progress' | 'Resolved' | 'Unfixable';
  priority: UrgencyLevel;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
  resolution?: string;
}
