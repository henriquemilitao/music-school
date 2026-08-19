// prisma/scripts/reset-push-tokens.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { pushToken: null },
  });
  console.log(`${result.count} usuário(s) tiveram o pushToken zerado.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
