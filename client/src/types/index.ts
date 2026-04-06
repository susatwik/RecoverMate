export type InvoiceStatus =
  | 'TO_CONTACT'
  | 'PROMISED'
  | 'DISPUTED'
  | 'PAID'
  | 'CALL_REQUIRED';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  promisedDate?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  pdfUrl?: string;
  lastContactedAt?: string;
  lastReminderDate?: string;
  reminderCount?: number;
  promiseCount?: number;
  paidAt?: string;
  customer: Customer;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  _id: string;
  invoice: string | Invoice;
  customer?: string | Customer;
  sender: 'ai' | 'user';
  text: string;
  messageType: 'reminder' | 'reply' | 'note' | 'rag';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceExtractionResult {
  amount: number | null;
  dueDate: string;
  customerName: string;
  invoiceNumber: string;
}
