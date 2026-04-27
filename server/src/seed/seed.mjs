import { prisma } from "../db/client.mjs";
import { ensureFeatureFlagDefaults } from "../services/featureFlagService.mjs";

export async function seedIfEmpty() {
  const planCount = await prisma.plan.count();
  if (planCount === 0) {
    await prisma.plan.createMany({
      data: [
        {
          code: "starter",
          name: "Starter",
          description: "For early teams validating workflows.",
          priceMonthlyCents: 1900,
          priceYearlyCents: 19000,
          currency: "USD",
          features: ["3 team members", "Email support", "Basic analytics"],
          trialDays: 14,
        },
        {
          code: "growth",
          name: "Growth",
          description: "For scaling teams with heavier support needs.",
          priceMonthlyCents: 5900,
          priceYearlyCents: 59000,
          currency: "USD",
          features: ["15 team members", "Priority support", "Advanced analytics"],
          trialDays: 14,
        },
      ],
    });
  }

  const catCount = await prisma.kBCategory.count();
  if (catCount === 0) {
    const c1 = await prisma.kBCategory.create({
      data: { name: "Getting started", slug: "getting-started", articleCount: 1 },
    });
    const c2 = await prisma.kBCategory.create({
      data: { name: "Billing & plans", slug: "billing", articleCount: 1 },
    });
    await prisma.kBArticle.createMany({
      data: [
        {
          title: "Invite your team in under two minutes",
          excerpt: "Roles, permissions, and best practices for growing workspaces.",
          content: "Team onboarding guide content...",
          categoryId: c1.id,
          readTimeMinutes: 4,
        },
        {
          title: "Understanding usage-based billing",
          excerpt: "How metering works across requests, seats, and add-ons.",
          content: "Billing guide content...",
          categoryId: c2.id,
          readTimeMinutes: 6,
        },
      ],
    });
  }

  await ensureFeatureFlagDefaults();
  const ALL_MODULES = [
    "dashboard",
    "customers",
    "users",
    "plans",
    "invites",
    "features",
    "audit_logs",
    "email",
    "environment",
    "tickets",
  ];
  const MANAGER_MODULES = ["dashboard", "customers", "plans", "invites", "audit_logs", "tickets"];
  const SUPPORT_MODULES = ["tickets", "customers", "dashboard"];
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ["admin", "master_admin", "manager", "support"] } },
    select: { id: true, role: true },
  });
  for (const u of adminUsers) {
    const wanted =
      u.role === "master_admin" || u.role === "admin"
        ? ALL_MODULES
        : u.role === "manager"
          ? MANAGER_MODULES
          : SUPPORT_MODULES;
    await prisma.userModuleAccess.createMany({
      data: wanted.map((moduleKey) => ({ userId: u.id, moduleKey, enabled: true })),
      skipDuplicates: true,
    });
  }
}
