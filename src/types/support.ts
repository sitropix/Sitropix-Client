export type TicketStatus = "open" | "in_progress" | "hold" | "resolved";
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
  projectId?: string | null;
  projectName?: string | null;
  editTypeId?: string | null;
  creditsCharged?: number;
  threadCount?: number;
}

export interface TicketMessageView {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  author: { id: string; name: string; email: string } | null;
  attachments?: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    downloadUrl: string;
  }[];
}

export interface SupportTicketDetail extends SupportTicket {
  messages: TicketMessageView[];
  projectName?: string | null;
  creditsRefunded?: boolean;
  workCompleted?: boolean | null;
}

export interface AdminSupportTicketListItem {
  id: string;
  subject: string;
  status: TicketStatus;
  priority?: TicketPriority;
  department: string;
  userPlan?: string;
  projectId?: string | null;
  projectName?: string | null;
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
  /** Optional — must be a project you own. */
  projectId?: string | null;
  /** Required when projectId is set — website edit type (credit cost). */
  editTypeId?: string | null;
  attachments?: File[];
}

export type EditTypeCategory = "atomic" | "multi_credit";

export interface SupportEditType {
  id: string;
  code: string;
  label: string;
  category: EditTypeCategory;
  creditsMin: number;
  creditsMax: number;
  defaultChargeCredits: number;
}
