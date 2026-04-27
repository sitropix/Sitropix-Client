export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority?: TicketPriority;
  createdAt: string;
  updatedAt: string;
  department?: string;
  userPlan?: string;
  threadCount?: number;
}

export interface TicketMessageView {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  author: { id: string; name: string; email: string } | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: TicketMessageView[];
}

export interface AdminSupportTicketListItem {
  id: string;
  subject: string;
  status: TicketStatus;
  priority?: TicketPriority;
  department: string;
  userPlan?: string;
  createdAt: string;
  updatedAt: string;
  threadCount: number;
  user: { id: string; name: string; email: string };
}

export interface KBCategory {
  id: string;
  name: string;
  slug: string;
  articleCount: number;
}

export interface KBArticle {
  id: string;
  title: string;
  excerpt: string;
  categoryId: string;
  updatedAt: string;
  readTimeMinutes: number;
  content?: string;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  departmentId?: string;
  priority?: TicketPriority;
}
