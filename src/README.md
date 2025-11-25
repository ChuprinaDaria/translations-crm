# CRM Platform

A modern, full-featured web-based CRM platform with three main functional blocks: Комерційна Пропозиція (КП), Продажі, and Сервіс.

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (version 16.x or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**

### Installation

1. **Clone or download the project**
   ```bash
   # If using git
   git clone <your-repository-url>
   cd <project-folder>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   or if you prefer yarn:
   ```bash
   yarn install
   ```
   
   **Important:** If you encounter any TypeScript errors about missing type declarations, ensure all dependencies are properly installed. The project includes a complete `package.json` with all required dependencies.

3. **Start the development server**
   ```bash
   npm run dev
   ```
   or with yarn:
   ```bash
   yarn dev
   ```

4. **Open your browser**
   
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

## 🏗️ Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool and dev server
- **shadcn/ui** - UI component library
- **Lucide React** - Icons

## 📦 Key Dependencies

The project uses the following main dependencies (all included in `package.json`):

### UI Components & Libraries
- **@radix-ui/*** - Accessible UI primitives (accordion, dialog, dropdown, etc.)
- **lucide-react** (0.487.0) - Icon library
- **sonner** (2.0.3) - Toast notifications
- **vaul** (1.1.2) - Drawer component
- **cmdk** (1.1.1) - Command palette

### Forms & Validation
- **react-hook-form** (7.55.0) - Form management
- **zod** (3.24.1) - Schema validation

### Date & Time
- **react-day-picker** (8.10.1) - Date picker
- **date-fns** (4.1.0) - Date utilities

### Charts & Visualization
- **recharts** (2.15.2) - Chart library

### Carousel
- **embla-carousel-react** (8.6.0) - Carousel component

### Utilities
- **class-variance-authority** (0.7.1) - CVA for component variants
- **clsx** (2.1.1) - Conditional classnames
- **tailwind-merge** (2.7.0) - Merge Tailwind classes
- **next-themes** (0.4.6) - Theme management

All dependencies will be automatically installed when you run `npm install`.

## 📁 Project Structure

```
├── App.tsx                    # Main application component with routing
├── components/
│   ├── Dashboard.tsx          # Dashboard overview with KPIs
│   ├── Header.tsx             # Top navigation header
│   ├── Sidebar.tsx            # Collapsible sidebar navigation
│   ├── MenuManagement.tsx     # Menu/dish management interface
│   ├── CreateKP.tsx           # КП creation interface
│   ├── KPTemplates.tsx        # КП template management
│   ├── KPArchive.tsx          # КП archive with filtering
│   ├── KPICard.tsx            # Reusable KPI card component
│   ├── InfoTooltip.tsx        # Tooltip component
│   └── ui/                    # shadcn/ui components
├── styles/
│   └── globals.css            # Global styles and Tailwind config
└── guidelines/
    └── Guidelines.md          # Design system guidelines
```

## 🎨 Design System

- **Accent Color:** #FF5A00
- **Background:** White (#FFFFFF)
- **Spacing:** 16px/24px grid system
- **Layout:** 12-column responsive grid
- **Sidebar Width:** ~260px (collapsible)

## 👥 Role-Based Access Control

The platform supports multiple user roles with specific permissions:

- **КП Manager** - Manages commercial proposals
- **Sales Manager** - Handles sales operations
- **Service Manager** - Oversees service operations
- **Sales Lead** - Leads sales team
- **Service Lead** - Leads service team

## ✨ Key Features

### 1. Dashboard Overview
- KPI cards with real-time metrics
- Quick actions and navigation
- Role-based content visibility

### 2. Menu Management
- Add/edit/delete dishes
- Upload dish photos
- Manage descriptions, portions (grams), and prices
- Dynamic tag system (categories, dietary preferences)

### 3. КП Creation
- Select dishes from menu
- Auto-generate proposals from templates
- Customizable proposal details
- Preview before sending

### 4. КП Templates
- Create and manage reusable templates
- Template categories and versioning
- Quick template application

### 5. КП Archive
- View all historical proposals
- Advanced filtering (date, status, client, manager)
- Export capabilities
- Status tracking

## 📱 Responsive Design

The platform is fully responsive and works seamlessly on:
- 🖥️ Desktop (1024px and above)
- 📱 Tablet (768px - 1023px)
- 📱 Mobile (below 768px)

## 🔧 Available Scripts

### Development
```bash
npm run dev          # Start development server
```

### Build
```bash
npm run build        # Build for production
```

### Preview
```bash
npm run preview      # Preview production build locally
```

### Type Check
```bash
npm run type-check   # Run TypeScript type checking
```

## 🛠️ Development Tips

1. **Hot Reload**: The dev server supports hot module replacement - changes will reflect immediately
2. **TypeScript**: The project uses TypeScript for type safety - check types with `npm run type-check`
3. **Tailwind**: Custom styles are in `styles/globals.css` - avoid inline font sizing classes
4. **Components**: All UI components follow the shadcn/ui pattern - reusable and accessible

## 📝 Environment Variables

Currently, the project runs without environment variables. If you need to add API endpoints or configuration:

1. Create a `.env` file in the root directory
2. Add your variables with `VITE_` prefix:
   ```
   VITE_API_URL=your_api_url
   VITE_API_KEY=your_api_key
   ```
3. Access in code: `import.meta.env.VITE_API_URL`

## 🚨 Troubleshooting

### TypeScript JSX errors
If you encounter "JSX element implicitly has type 'any'" errors:
```bash
# Install React and type definitions
npm install react react-dom
npm install -D @types/react @types/react-dom

# Install Radix UI dependencies
npm install @radix-ui/react-alert-dialog
```

**Important:** Also ensure your `tsconfig.json` is configured with:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### Port already in use
If port 5173 is busy, Vite will automatically try the next available port. Check the terminal for the actual port.

### Dependencies not installing
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Build errors
```bash
# Clear build cache
rm -rf dist
npm run build
```

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

This is a private project. For internal team members:
1. Create a feature branch from `main`
2. Make your changes
3. Submit a pull request with clear description
4. Wait for code review approval

## 📞 Support

For questions or issues, contact the development team.

---

**Built with ❤️ by your development team**

## 📚 Documentation

**[📑 Complete Documentation Index](./DOCUMENTATION_INDEX.md)** - Find any guide quickly

### Quick Links:
- **[🔴 FIX TYPE ERRORS](./FIX_ALL_ERRORS.md)** - Fix "Cannot find module" errors ⚡
- **[🚨 QUICK FIX - Empty Page](./QUICK_FIX.md)** - FASTEST solution for blank page ⚡
- **[👋 Start Here](./START_HERE.md)** - New user? Begin here!
- **[Getting Started Guide](./GETTING_STARTED.md)** - Installation and setup instructions
- **[Diagnostic Guide](./DIAGNOSTIC.md)** - Step-by-step problem diagnosis
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Solutions for common issues
- **[Custom Components Documentation](./CUSTOM_COMPONENTS.md)** - Complete UI component library reference
- **[Verification Checklist](./VERIFICATION.md)** - Code quality and readiness status