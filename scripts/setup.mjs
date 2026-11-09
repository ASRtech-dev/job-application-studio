#!/usr/bin/env node

/**
 * Setup & Initialization Script for Job Application Studio
 * - Seeds data/master-cv.json and data/applications.json from example templates if not present.
 * - Ensures required directories exist (data, public/uploads, public/documents, exports).
 * - Installs Playwright Chromium browser required for PDF export.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Initializing Job Application Studio environment...\n');

// 1. Ensure directories exist
const requiredDirs = [
  path.join(rootDir, 'data'),
  path.join(rootDir, 'exports'),
  path.join(rootDir, 'public', 'uploads'),
  path.join(rootDir, 'public', 'documents'),
];

for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${path.relative(rootDir, dir)}`);
  }
}

// 2. Seed data files if missing
const seedFiles = [
  {
    example: path.join(rootDir, 'data', 'master-cv.example.json'),
    target: path.join(rootDir, 'data', 'master-cv.json'),
    label: 'Master CV profile',
  },
  {
    example: path.join(rootDir, 'data', 'applications.example.json'),
    target: path.join(rootDir, 'data', 'applications.json'),
    label: 'Sample applications',
  },
];

for (const item of seedFiles) {
  if (!fs.existsSync(item.target)) {
    if (fs.existsSync(item.example)) {
      fs.copyFileSync(item.example, item.target);
      console.log(`✨ Seeded ${item.label} (${path.relative(rootDir, item.target)}) from template.`);
    } else {
      console.warn(`⚠️ Warning: Template not found at ${item.example}`);
    }
  } else {
    console.log(`ℹ️ Existing data file preserved: ${path.relative(rootDir, item.target)}`);
  }
}

// 3. Install Playwright Chromium for local PDF rendering
console.log('\n🌐 Installing Playwright Chromium browser for high-fidelity PDF exports...');
try {
  execSync('npx playwright install chromium', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Playwright Chromium installed successfully.\n');
} catch (err) {
  console.warn('⚠️ Warning: Failed to install Playwright Chromium automatically.');
  console.warn('   You can install it later with: npx playwright install chromium');
}

console.log('🎉 Setup complete! You can now start the studio with:');
console.log('   npm run dev\n');
console.log('   Then open http://localhost:3000 in your browser.\n');
