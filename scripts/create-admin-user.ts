#!/usr/bin/env tsx

/**
 * Create Admin User Script
 * Creates a default admin user for the application
 */

import { config } from 'dotenv';
config();

import { storage } from '../server/storage';
import { hashPassword } from '../server/services/auth';

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    const adminEmail = 'admin@lanemc.com';
    const adminPassword = 'admin123';
    const adminUsername = 'admin';
    
    // Check if admin user already exists
    const existingUser = await storage.getUserByEmail(adminEmail);
    if (existingUser) {
      console.log('✅ Admin user already exists:', adminEmail);
      return;
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);
    
    // Create the admin user
    const adminUser = await storage.createUser({
      username: adminUsername,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin'
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 User ID:', adminUser.id);
    console.log('');
    console.log('🚀 You can now log in to your application!');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
