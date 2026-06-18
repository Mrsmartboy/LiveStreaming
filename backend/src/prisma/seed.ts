import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin account
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mentorstream.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@mentorstream.local',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Create mentor account
  const mentorPassword = await bcrypt.hash('mentor123', 12);
  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@mentorstream.local' },
    update: {},
    create: {
      name: 'John Mentor',
      email: 'mentor@mentorstream.local',
      password: mentorPassword,
      role: 'MENTOR',
    },
  });
  console.log(`✅ Mentor created: ${mentor.email}`);

  // Create 3 student accounts
  const students = [
    { name: 'Alice Student', email: 'alice@mentorstream.local' },
    { name: 'Bob Student', email: 'bob@mentorstream.local' },
    { name: 'Charlie Student', email: 'charlie@mentorstream.local' },
  ];

  for (const s of students) {
    const pw = await bcrypt.hash('student123', 12);
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { name: s.name, email: s.email, password: pw, role: 'STUDENT' },
    });
    console.log(`✅ Student created: ${student.email}`);
  }

  // Create a sample session
  const session = await prisma.session.upsert({
    where: { livekitRoom: 'sample-session-room-001' },
    update: {},
    create: {
      title: 'Introduction to TypeScript',
      description: 'Learn TypeScript fundamentals: types, interfaces, generics, and more.',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      livekitRoom: 'sample-session-room-001',
      status: 'SCHEDULED',
    },
  });
  console.log(`✅ Sample session created: ${session.title}`);

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials:');
  console.log('  Admin:  admin@mentorstream.local / admin123');
  console.log('  Mentor: mentor@mentorstream.local / mentor123');
  console.log('  Student: alice@mentorstream.local / student123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
