# Scholar ERP — School Management System

A premium, production-ready School ERP Management System built with React, TypeScript, and Supabase. Features a beautiful modern SaaS UI with dark/light mode, role-based access control, and comprehensive modules for managing every aspect of a school.

## Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (design system)
- React Router DOM (routing)
- TanStack Query (server state)
- Redux Toolkit (UI state)
- React Hook Form + Zod (validation)
- Framer Motion (animations)
- Recharts (charts)
- Lucide React (icons)

**Backend (Supabase)**
- PostgreSQL database with Row Level Security (RLS)
- Supabase Auth (email/password)
- Real-time APIs via Supabase JS client
- Role-based access control (7 roles)

## Features

### Authentication
- Login / Signup / Forgot Password / Reset Password
- JWT-based session management with refresh tokens
- Remember Me
- Protected routes with role-based authorization
- 7 roles: Super Admin, Admin, Principal, Accountant, Receptionist, Teacher, Student

### Dashboard
- Stat cards: Total Students, Staff, Teachers, Admissions, Today's Admissions, Fee Collection, Pending Fees, Monthly Revenue
- Charts: Admissions Trend, Fee Collection, Student Growth, Payment Analytics
- Recent Activities, Admissions, and Payments

### Student Management
- 10-step Admission Wizard (Student Type → Personal → Guardian → Address → Academic → Fee Plan → Discount → Review → Payment → Success)
- Student list with search, filter, pagination
- Student profile with fee summary, guardian, address, academic info, payment history
- CSV export

### Staff Management
- CRUD for all staff types (Teacher, Principal, Accountant, Receptionist, Librarian, Driver, Security)
- Search, filter by role, pagination
- CSV export

### Fee Management
- Fee plans with components and installments
- Collect fees (full/partial/installment)
- Receipt generation with print support
- Payment history
- CSV export

### Attendance
- Student and Staff attendance
- Mark present/absent/late/half-day
- Mark all present
- CSV export

### Academic Management
- Academic Sessions (with current session flag)
- Classes
- Sections
- Subjects

### Program Management
- Full CRUD with search
- Program code, duration, description

### Timetable
- Weekly schedule grid
- Class/section selection
- Print support

### Reports
- Admission, Fee Collection, Staff, and Student reports
- Charts (bar, line, pie)
- CSV export

### Permissions
- Role-based access control matrix
- Visual permission grid

### Settings
- Institute profile
- Theme settings (light/dark)
- SMTP configuration
- Backup & restore

### Profile
- Update personal info
- Change password

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database

The app uses Supabase (PostgreSQL) with the following tables:
- `profiles` — user profiles with roles
- `academic_sessions` — school year sessions
- `classes`, `sections`, `subjects` — academic structure
- `programs` — academic programs
- `students` — student records
- `staff` — staff records
- `fee_plans` — fee structures
- `payments` — fee payments with receipts
- `attendance` — daily attendance
- `activities` — audit log
- `notifications` — in-app notifications
- `settings` — institute settings (singleton)

All tables have RLS enabled with role-appropriate policies.

## Deployment

### Vercel
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Render
1. Connect GitHub repo
2. Build command: `npm run build`
3. Start command: `npm run preview`
4. Add environment variables

### Docker
```bash
docker build -t scholar-erp .
docker run -p 3000:3000 scholar-erp
```

## License

MIT
