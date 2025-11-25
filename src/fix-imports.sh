#!/bin/bash

# Script to fix all versioned imports in shadcn/ui components

echo "🔧 Fixing all versioned package imports..."
echo ""

# Fix @radix-ui imports (remove version suffixes)
echo "Fixing @radix-ui imports..."
find components/ui -name "*.tsx" -type f -exec sed -i.bak 's/@radix-ui\/react-\([a-z-]*\)@[0-9.]*/@radix-ui\/react-\1/g' {} +

# Fix lucide-react imports
echo "Fixing lucide-react imports..."
find components/ui -name "*.tsx" -type f -exec sed -i.bak 's/lucide-react@[0-9.]*/lucide-react/g' {} +

# Fix class-variance-authority imports
echo "Fixing class-variance-authority imports..."
find components/ui -name "*.tsx" -type f -exec sed -i.bak 's/class-variance-authority@[0-9.]*/class-variance-authority/g' {} +

# Fix react-hook-form imports
echo "Fixing react-hook-form imports..."
find components/ui -name "*.tsx" -type f -exec sed -i.bak 's/react-hook-form@[0-9.]*/react-hook-form/g' {} +

# Remove backup files
echo "Cleaning up backup files..."
find components/ui -name "*.bak" -type f -delete

echo ""
echo "✅ Done! All imports fixed."
echo ""
echo "Run these commands to complete the fix:"
echo ""
echo "  rm -rf node_modules package-lock.json"
echo "  npm install"
echo "  npm run dev"
echo ""
