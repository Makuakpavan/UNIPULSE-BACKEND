import { connectDB, disconnectDB } from '../config/db';
import Institution from '../models/Institution';
import User from '../models/User';
import { env } from '../config/env';
import logger from './logger';

const seedData = async () => {
  await connectDB();
  try {
    const institutions = [
      { name: 'University of Lagos', slug: 'unilag', location: 'Lagos, Nigeria', emailDomain: 'unilag.edu.ng' },
      { name: 'University of Ibadan', slug: 'ui', location: 'Ibadan, Nigeria', emailDomain: 'ui.edu.ng' },
      { name: 'Covenant University', slug: 'cu', location: 'Ota, Nigeria', emailDomain: 'covenantuniversity.edu.ng' },
      { name: 'Obafemi Awolowo University', slug: 'oau', location: 'Ile-Ife, Nigeria', emailDomain: 'oauife.edu.ng' },
    ];

    for (const inst of institutions) {
      await Institution.findOneAndUpdate({ slug: inst.slug }, inst, { upsert: true, new: true });
    }
    logger.info('Institutions seeded');

    const adminExists = await User.findOne({ email: env.adminEmail });
    if (!adminExists) {
      const unilag = await Institution.findOne({ slug: 'unilag' });
      await User.create({
        email: env.adminEmail,
        password: env.adminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        username: 'superadmin',
        role: 'super_admin',
        institution: unilag?._id,
        isEmailVerified: true,
        isVerifiedStudent: true,
      });
      logger.info('Super admin created');
    }

    logger.info('Seed completed');
  } catch (error) {
    logger.error('Seed error:', error);
  } finally {
    await disconnectDB();
  }
};

seedData();
