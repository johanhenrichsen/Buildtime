// Run with: node prisma/seed.js
// Or via Railway: railway run node prisma/seed.js
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEVICE_KEY = 'BUILDTIME-KIOSK-KEY-2024';

const PERMISSIONS = [
  'checkin_kiosk',
  'view_own_dtr',
  'approve_ot_leave_crew',
  'approve_ot_leave_all',
  'edit_attendance',
  'manage_workers_site',
  'manage_workers_all',
  'run_payroll',
  'view_labor_cost_site',
  'view_labor_cost_all',
  'system_config',
];

async function main() {
  console.log('Seeding database...');

  for (const name of PERMISSIONS) {
    await prisma.permission.upsert({ where: { name }, create: { name }, update: {} });
  }
  console.log('Permissions created.');

  // Default role for regular construction workers (no admin permissions needed)
  await prisma.role.upsert({
    where: { name: 'worker' },
    create: { name: 'worker' },
    update: {},
  });
  console.log('Role "worker" created (no permissions — for field workers).');

  const role = await prisma.role.upsert({
    where: { name: 'super_admin' },
    create: { name: 'super_admin' },
    update: {},
  });

  const permissions = await prisma.permission.findMany({ where: { name: { in: PERMISSIONS } } });
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  console.log('Role "super_admin" created with all permissions.');

  const passwordHash = await bcrypt.hash('BuildTime2024!', 12);
  await prisma.worker.upsert({
    where: { employeeNo: 'ADMIN-001' },
    create: {
      employeeNo: 'ADMIN-001',
      name: 'System Admin',
      email: 'admin@buildtime.ph',
      passwordHash,
      roleId: role.id,
      employmentType: 'regular',
      dailyRate: '0',
      hireDate: new Date('2024-01-01'),
      status: 'active',
    },
    update: {},
  });
  console.log('Admin worker created:');
  console.log('  Email:    admin@buildtime.ph');
  console.log('  Password: BuildTime2024!');

  const existing = await prisma.site.findFirst({ where: { name: 'Main Site' } });
  const site = existing ?? await prisma.site.create({ data: { name: 'Main Site', status: 'active' } });
  console.log(`Site: ${site.name} (${site.id})`);

  const existingKiosk = await prisma.kiosk.findUnique({ where: { deviceKey: DEVICE_KEY } });
  if (!existingKiosk) {
    await prisma.kiosk.create({ data: { siteId: site.id, deviceKey: DEVICE_KEY } });
  }
  console.log('Kiosk provisioned.');
  console.log('');
  console.log('=== SET THIS ENV VAR IN VERCEL (kiosk project) ===');
  console.log(`VITE_KIOSK_DEVICE_KEY=${DEVICE_KEY}`);
  console.log('==================================================');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
