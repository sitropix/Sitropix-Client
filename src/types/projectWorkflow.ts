export type ProjectWorkflowStatus =
  | "awaiting_brief"
  | "awaiting_assets"
  | "ready_to_start"
  | "in_progress"
  | "awaiting_customer_reply"
  | "in_review"
  | "revisions_requested"
  | "approved"
  | "live"
  | "on_hold";

export interface AssignedDesignerRef {
  id: string;
  name: string;
  email: string;
}

export interface ProjectNextAction {
  kind:
    | "fill_brief"
    | "upload_assets"
    | "wait"
    | "reply_chat"
    | "approve_design"
    | "approve_launch"
    | "live";
  title: string;
  body: string;
  cta: string | null;
  href: string | null;
}

export interface ProjectWorkflowSnapshot {
  workflowStatus: ProjectWorkflowStatus;
  workflowLabel: string;
  workflowChangedAt: string | null;
  progressPercent: number;
  phaseProgressOverride: number;
  assignedDesigner: AssignedDesignerRef | null;
  lastCustomerActivityAt: string | null;
  lastDesignerActivityAt: string | null;
  designerHeartbeatAt: string | null;
  designerActivelyWorking: boolean;
  stagingUrl: string | null;
  liveUrl: string | null;
  approvedDesignAt: string | null;
  approvedLaunchAt: string | null;
  brandVoiceShort: string;
  notifyOnDesignerReply: boolean;
  notifyOnPhaseChange: boolean;
  pendingCheckoutSessionId: string | null;
  pendingCheckoutSessionAt: string | null;
  shareLinkEnabled: boolean;
  shareLinkExpiresAt: string | null;
  customerUnreadCount?: number;
  lastChatAt?: string | null;
  nextAction?: ProjectNextAction | null;
}

export interface ProjectChatMessage {
  id: string;
  body: string;
  isStaff: boolean;
  authorId: string | null;
  authorName: string | null;
  authorRole: string | null;
  createdAt: string;
}

export interface ProjectActivityEvent {
  id: string;
  action: string;
  actorRole: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectTicketSummary {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFinanceInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  invoicePdfUrl: string | null;
}

export interface ProjectFinancePayload {
  project: { id: string; name: string };
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pausedAt: string | null;
    canceledAt: string | null;
    includedCreditsPerPeriod: number;
    includedCreditsUsedThisPeriod: number;
    purchasedCreditsBalance: number;
  } | null;
  plan: {
    id: string;
    code: string;
    name: string;
    currency: string;
    priceMonthlyCents: number;
    priceYearlyCents: number;
  } | null;
  invoices: ProjectFinanceInvoice[];
}

export interface ProjectMultiSummaryBuckets {
  total: number;
  awaitingPayment: number;
  awaitingYourAction: number;
  inProgress: number;
  live: number;
  onHold: number;
}

export interface ProjectMultiSummaryItem {
  id: string;
  name: string;
  workflowStatus: ProjectWorkflowStatus;
  unreadCount: number;
  liveUrl: string | null;
  pendingPayment: boolean;
}

export interface ProjectMultiSummary {
  buckets: ProjectMultiSummaryBuckets;
  projects: ProjectMultiSummaryItem[];
}

export interface ProjectShareLinkInfo {
  token: string;
  url: string;
  expiresAt: string | null;
}

export interface ProjectPublicShareView {
  schemaVersion: "1";
  name: string;
  description: string;
  customerName: string | null;
  workflowStatus: ProjectWorkflowStatus;
  progressPercent: number | null;
  stagingUrl: string | null;
  liveUrl: string | null;
  assignedDesignerName: string | null;
  lastUpdateAt: string | null;
  recentActivity: Array<{ action: string; at: string | null }>;
  poweredBy: string;
}

export interface StaffUserRef {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DesignerQueueRow {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  workflowStatus: ProjectWorkflowStatus;
  workflowLabel: string;
  workflowChangedAt: string | null;
  lastCustomerActivityAt: string | null;
  lastDesignerActivityAt: string | null;
  assignedDesigner: { id: string; name: string } | null;
  unreadFromCustomer: number;
  planName: string | null;
  subscriptionStatus: string;
}

export interface AdminProjectBoardBuckets {
  buckets: Record<ProjectWorkflowStatus, Array<{
    id: string;
    name: string;
    ownerName: string | null;
    designerName: string | null;
    workflowChangedAt: string | null;
  }>>;
  labels: Record<ProjectWorkflowStatus, string>;
}

export interface AdminProjectOverview {
  totals: {
    totalProjects: number;
    awaitingAssignment: number;
    awaitingCustomer: number;
    inReview: number;
    live: number;
    onHold: number;
  };
  stuckProjects: Array<{
    id: string;
    name: string;
    ownerName: string | null;
    designerName: string | null;
    workflowStatus: ProjectWorkflowStatus;
    workflowChangedAt: string | null;
    daysStuck: number;
  }>;
}
