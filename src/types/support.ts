export type TicketStatus = "open" | "in_progress" | "hold" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type SupportTicketCategory = "general" | "edit" | "addon";

export interface TicketEditTypeRef {
  id: string;
  code: string;
  label: string;
}

export interface TicketAddonRef {
  id: string;
  code: string;
  label: string;
}

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
  editType?: TicketEditTypeRef | null;
  category?: SupportTicketCategory;
  subscriptionAddonId?: string | null;
  addon?: TicketAddonRef | null;
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

export type AdminTicketCategoryScope = "general" | "non_general";

export interface AdminSupportTicketListItem {
  id: string;
  subject: string;
  status: TicketStatus;
  priority?: TicketPriority;
  department: string;
  category?: SupportTicketCategory;
  userPlan?: string;
  projectId?: string | null;
  projectName?: string | null;
  editTypeId?: string | null;
  editType?: TicketEditTypeRef | null;
  subscriptionAddonId?: string | null;
  addon?: TicketAddonRef | null;
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

export interface AddonTicketOption {
  id: string;
  code: string;
  label: string;
  desc: string;
  billingKind: string;
  recurringType: string;
  addonBillingCycle: string;
  subscriptionBillingCycle: string;
  hasSetupFee: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
  ineligibleMessage: string | null;
  isUtilized: boolean;
  currentCycleStart: string | null;
  currentCycleEnd: string | null;
  isBundled: boolean;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  departmentId?: string;
  priority?: TicketPriority;
  ticketCategory?: SupportTicketCategory;
  /** Optional — must be a project you own. */
  projectId?: string | null;
  /** When set with projectId, reserves website edit credits for this edit type. */
  editTypeId?: string | null;
  /** Required when ticketCategory is addon. */
  subscriptionAddonId?: string | null;
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
