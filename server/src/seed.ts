import 'dotenv/config';
import { ROLES } from './config/constants';
import { connectDatabase, disconnectDatabase } from './config/database';
import { User } from './models/User';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    await connectDatabase();

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@resort360.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
    const adminName = process.env.SEED_ADMIN_NAME ?? 'Super Admin';

    // Check if admin already exists
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log(`⚠️  Admin user already exists: ${adminEmail}`);
      console.log('   To reset, manually delete the user from MongoDB.');
      await disconnectDatabase();
      process.exit(0);
    }

    // Create SUPER_ADMIN
    // NOTE: Pass plain password as passwordHash — the pre-save hook will hash it.
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash: adminPassword,
      role: ROLES.SUPER_ADMIN,
      department: 'Management',
      isActive: true,
    });

    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('👤 Admin account created:');
    console.log(`   Name:  ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('');
    console.log('🔑 Login credentials:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('⚠️  Change the admin password after first login!');

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

seed();
