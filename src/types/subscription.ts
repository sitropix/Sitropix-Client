export type Role = "user" | "admin";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  features: string[];
  isActive: boolean;
  trialDays: number;
  archivedAt?: string | null;
}

export type SubscriptionStatus = "trialing" | "active" | "paused" | "canceled" | "past_due";
export type BillingCycle = "monthly" | "yearly";

export interface UserLite {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  pausedAt: string | null;
  canceledAt: string | null;
  couponId: string | null;
  plan?: Plan;
  user?: UserLite;
  nextBillingDate?: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  paidAt?: string | null;
  failureReason?: string | null;
  invoicePdfUrl?: string | null;
}

/** Effective subscription self-service capabilities (global + optional per-plan override). */
export interface SubscriptionFeatureControls {
  pauseResume: boolean;
  selfCancel: boolean;
}

export interface FeatureFlagRow {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
}

export interface PlanFeatureOverrideRow {
  id: string;
  planId: string;
  key: string;
  enabled: boolean;
  plan?: { id: string; name: string; code: string };
}

export interface FeatureFlagsAdminPayload {
  flags: FeatureFlagRow[];
  overrides: PlanFeatureOverrideRow[];
}

export interface ClientDocumentRow {
  id: string;
  category: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AdminInviteRow {
  id: string;
  email: string;
  planId: string | null;
  plan: { id: string; name: string; code: string } | null;
  message: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: string;
  subscriptions: Array<{
    id: string;
    status: SubscriptionStatus;
    planId: string;
    plan: { name: string; code: string } | null;
  }>;
}

export interface CustomerPortalPayload {
  user: UserLite;
  plans: Plan[];
  subscription: Subscription | null;
  featureControls?: SubscriptionFeatureControls;
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
}

export type EmailProviderId = "console" | "smtp" | "brevo" | "mailgun" | "resend" | "sendgrid";

export interface EmailSettingsPayload {
  configuredInDatabase: boolean;
  provider: string;
  fromEmail: string;
  fromName: string;
  settings: Record<string, unknown>;
  secretMasks: Record<string, string | null | undefined>;
  hint: string | null;
}

export interface AnalyticsSummary {
  mrrCents: number;
  totalRevenueCents: number;
  activeSubscriptions: number;
  churnRate: number;
  failedPayments: number;
}

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogListPayload {
  rows: AuditLogRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogSummary {
  last24hTotal: number;
  last7dTotal: number;
  failedLogins24h: number;
  adminMutations24h: number;
}
