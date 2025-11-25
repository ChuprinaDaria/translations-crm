# 🚨 FIX ALL TYPE ERRORS

## The Problem

Your shadcn/ui components have **versioned imports** like:
```typescript
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog@1.1.6";
```

This is **WRONG**. It should be:
```typescript
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
```

---

## ⚡ QUICK FIX (Choose ONE method)

### Method 1: Use Node.js Script (RECOMMENDED - Works on all platforms)

```bash
# 1. Run the fix script
node fix-imports.js

# 2. Clean reinstall
rm -rf node_modules package-lock.json
npm install

# 3. Start dev server
npm run dev
```

**Windows users:**
```bash
# 1. Run the fix script
node fix-imports.js

# 2. Clean reinstall
rmdir /s /q node_modules
del package-lock.json
npm install

# 3. Start dev server
npm run dev
```

---

### Method 2: Use Shell Script (Mac/Linux only)

```bash
# 1. Make script executable
chmod +x fix-imports.sh

# 2. Run it
bash fix-imports.sh

# 3. Follow the instructions it prints
```

---

### Method 3: Use Batch Script (Windows only)

```bash
# 1. Double-click fix-imports.bat
# OR run from command prompt:
fix-imports.bat

# 2. Follow the instructions it prints
```

---

### Method 4: Manual Fix (If scripts don't work)

Use Find & Replace in VS Code:

1. **Open VS Code**
2. **Press:** `Ctrl+Shift+H` (Windows/Linux) or `Cmd+Shift+H` (Mac)
3. **Enable regex:** Click the `.*` button
4. **Do these replacements ONE AT A TIME:**

#### Replace 1: Fix @radix-ui imports
- **Find:** `@radix-ui/react-([a-z-]+)@[\d.]+`
- **Replace:** `@radix-ui/react-$1`
- **Files to include:** `components/ui/*.tsx`
- Click **Replace All**

#### Replace 2: Fix lucide-react imports
- **Find:** `lucide-react@[\d.]+`
- **Replace:** `lucide-react`
- **Files to include:** `components/ui/*.tsx`
- Click **Replace All**

#### Replace 3: Fix class-variance-authority imports
- **Find:** `class-variance-authority@[\d.]+`
- **Replace:** `class-variance-authority`
- **Files to include:** `components/ui/*.tsx`
- Click **Replace All**

#### Replace 4: Fix react-hook-form imports
- **Find:** `react-hook-form@[\d.]+`
- **Replace:** `react-hook-form`
- **Files to include:** `components/ui/*.tsx`
- Click **Replace All**

5. **Save all files:** `Ctrl+K S` or `Cmd+K S`

6. **Clean reinstall:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## ✅ Verification

After running the fix, check that:

1. **No versioned imports remain:**
```bash
# Run this to check:
grep -r "@.*@[0-9]" components/ui/

# Should return NOTHING
# If it shows results, run the fix again
```

2. **TypeScript is happy:**
```bash
npm run type-check

# Should show no errors about missing types
```

3. **Dev server starts:**
```bash
npm run dev

# Should start without errors
```

---

## 📋 What Each Script Does

### `fix-imports.js` (Node.js)
- ✅ Works on Windows, Mac, and Linux
- ✅ Safe - makes precise changes
- ✅ Shows exactly what it changed
- ✅ **RECOMMENDED**

### `fix-imports.sh` (Bash)
- ✅ Works on Mac and Linux
- ✅ Fast and efficient
- ❌ Doesn't work on Windows (unless using Git Bash/WSL)

### `fix-imports.bat` (Batch)
- ✅ Works on Windows
- ⚠️ Requires PowerShell
- ❌ Doesn't work on Mac/Linux

---

## 🎯 Full Fix Sequence

Here's the COMPLETE fix from start to finish:

```bash
# Step 1: Fix the imports
node fix-imports.js

# Step 2: Verify the fix worked
grep -r "@.*@[0-9]" components/ui/
# (should return nothing)

# Step 3: Delete everything
rm -rf node_modules package-lock.json .vite dist

# Windows users:
# rmdir /s /q node_modules
# rmdir /s /q .vite
# rmdir /s /q dist
# del package-lock.json

# Step 4: Reinstall
npm install

# Step 5: Type check
npm run type-check
# (should show no errors)

# Step 6: Start dev server
npm run dev

# Step 7: Open browser
# http://localhost:5173
```

---

## ❓ Why Did This Happen?

The versioned imports (`@radix-ui/react-alert-dialog@1.1.6`) are **NOT valid** in normal npm imports. 

This syntax might have been:
- Added by an AI assistant incorrectly
- Copy-pasted from documentation that was using a different package manager
- A misunderstanding of how npm imports work

**Correct way:** Package versions go in `package.json`, not in import statements!

---

## 🔍 How to Prevent This

1. **Never use `@version` in import statements**
2. **Specify versions in `package.json` only**
3. **Use standard import syntax:**
   ```typescript
   import { something } from "package-name";
   ```

---

## 🆘 Still Getting Errors?

### Error: "Cannot find module"
```bash
# Make sure you ran npm install
npm install

# Check if the package exists
npm list @radix-ui/react-alert-dialog
```

### Error: "Missing @types/react"
```bash
# Reinstall type definitions
npm install --save-dev @types/react @types/react-dom
```

### Error: TypeScript errors after fix
```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
rm -rf .tsbuildinfo

# Restart TypeScript server in VS Code
# Press: Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### Still broken?
See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## ✨ Success Indicators

You'll know it's fixed when:

- ✅ No red squiggly lines in VS Code
- ✅ `npm run type-check` shows no errors
- ✅ `npm run dev` starts without warnings
- ✅ Browser shows the app (not blank page)
- ✅ Console has no errors

---

**TL;DR:**
```bash
node fix-imports.js
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Done!** 🎉
