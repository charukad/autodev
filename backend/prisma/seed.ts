import { PrismaClient, UserRole, BudgetScope } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminUser = await prisma.user.upsert({
    where: {
      email: "admin@ai-office.local",
    },
    update: {
      name: "AI Office Admin",
      role: UserRole.admin,
    },
    create: {
      email: "admin@ai-office.local",
      name: "AI Office Admin",
      passwordHash: "development-only-placeholder-hash",
      role: UserRole.admin,
    },
  });

  await prisma.budget.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      tokenLimit: 1000000,
      costLimitUsd: 10,
      scopeId: "global",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      scope: BudgetScope.global,
      scopeId: "global",
      tokenLimit: 1000000,
      costLimitUsd: 10,
    },
  });

  const existingSession = await prisma.session.findFirst({
    where: {
      userId: adminUser.id,
      projectPath: "/workspace/example",
    },
  });

  if (!existingSession) {
    await prisma.session.create({
      data: {
        userId: adminUser.id,
        projectPath: "/workspace/example",
        projectName: "Example Workspace",
      },
    });
  }

  console.log("Seeded admin user, global budget, and example session.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
