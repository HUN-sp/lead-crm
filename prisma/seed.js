const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = [
    {
      name: 'Aman Gupta',
      email: 'aman@example.com',
      phone: '+91-9876543210',
      source: 'website',
      status: 'NEW',
    },
    {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+91-9876543211',
      source: 'referral',
      status: 'CONTACTED',
    },
    {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      source: 'campaign',
      status: 'QUALIFIED',
    },
    {
      name: 'Sneha Patel',
      email: 'sneha@example.com',
      phone: '+91-9876543213',
      source: 'website',
      status: 'CONVERTED',
    },
    {
      name: 'Arjun Singh',
      email: 'arjun@example.com',
      source: 'referral',
      status: 'LOST',
    },
  ];

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { email: lead.email },
      update: {},
      create: lead,
    });
  }

  console.log('✅ Seed data created successfully');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
