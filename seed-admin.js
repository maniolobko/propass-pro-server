#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with admin user...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password_hash: hashedPassword,
      email: 'admin@propass.local',
      role: 'ADMIN',
      active: true,
    },
  });

  console.log('✅ Admin user created:', {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    role: admin.role,
  });

  // Also create a test user
  const hashedTestPassword = await bcrypt.hash('test123', 10);
  const testUser = await prisma.user.create({
    data: {
      username: 'test',
      password_hash: hashedTestPassword,
      email: 'test@propass.local',
      role: 'USER',
      active: true,
    },
  });

  console.log('✅ Test user created:', {
    id: testUser.id,
    username: testUser.username,
    email: testUser.email,
    role: testUser.role,
  });

  // Create a test client
  const client = await prisma.client.create({
    data: {
      name: 'Test Client',
      email: 'client@test.local',
      phone: '+33600000000',
      balance: 0,
      active: true,
    },
  });

  console.log('✅ Test client created:', {
    id: client.id,
    name: client.name,
  });

  console.log('\n🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
