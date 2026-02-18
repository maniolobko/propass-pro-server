const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create client user
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('Paris2026', saltRounds);

    const clientUser = await prisma.user.upsert({
      where: { email: 'client@rfid.local' },
      update: {
        password_hash: passwordHash,
        active: true,
      },
      create: {
        username: 'client',
        email: 'client@rfid.local',
        password_hash: passwordHash,
        role: 'CLIENT',
        active: true,
      },
    });

    console.log('✅ Client user created/updated:', {
      id: clientUser.id,
      email: clientUser.email,
      role: clientUser.role,
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
