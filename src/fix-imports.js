#!/usr/bin/env node

/**
 * Fix all versioned package imports in shadcn/ui components
 * This script removes version suffixes like @1.2.3 from imports
 */

const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'components', 'ui');

// Patterns to fix
const patterns = [
  { regex: /@radix-ui\/react-([a-z-]+)@[\d.]+/g, replacement: '@radix-ui/react-$1' },
  { regex: /lucide-react@[\d.]+/g, replacement: 'lucide-react' },
  { regex: /class-variance-authority@[\d.]+/g, replacement: 'class-variance-authority' },
  { regex: /react-hook-form@[\d.]+/g, replacement: 'react-hook-form' },
  { regex: /sonner@[\d.]+/g, replacement: 'sonner' },
];

console.log('🔧 Fixing all versioned package imports...\n');

let fixedCount = 0;
let fileCount = 0;

try {
  // Check if components/ui directory exists
  if (!fs.existsSync(componentsDir)) {
    console.error('❌ Error: components/ui directory not found!');
    console.error('Make sure you run this script from the project root.');
    process.exit(1);
  }

  // Read all .tsx files in components/ui
  const files = fs.readdirSync(componentsDir).filter(file => file.endsWith('.tsx'));
  
  console.log(`Found ${files.length} component files to process...\n`);

  files.forEach(file => {
    const filePath = path.join(componentsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let changesInFile = 0;

    patterns.forEach(({ regex, replacement }) => {
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, replacement);
        modified = true;
        changesInFile += matches.length;
        fixedCount += matches.length;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ ${file} - Fixed ${changesInFile} import(s)`);
      fileCount++;
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete!`);
  console.log(`   Files modified: ${fileCount}`);
  console.log(`   Imports fixed: ${fixedCount}`);
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log('  1. rm -rf node_modules package-lock.json');
  console.log('  2. npm install');
  console.log('  3. npm run dev\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
