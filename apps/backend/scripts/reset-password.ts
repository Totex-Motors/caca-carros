import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Uso: npm run user:reset-password -w apps/backend -- <email> <nova-senha>
// Se o usuario nao existir, ele e criado com a senha informada.

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Uso: npm run user:reset-password -w apps/backend -- <email> <nova-senha>');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('A senha deve ter pelo menos 6 caracteres.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash },
    create: { email, password: passwordHash }
  });

  console.log(existing ? `Senha atualizada para ${email}.` : `Usuario ${email} criado com a nova senha.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
