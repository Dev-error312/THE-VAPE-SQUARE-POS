# SwiftPOS — Production-Ready Point of Sale System

A complete, full-stack POS system built with React + TypeScript + Supabase.

---

## 🚀 Quick Start

### 1. Clone / Extract the Project

```bash
# Extract the ZIP, then:
cd pos-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Go to your Supabase project: https://oqczobpuiitmdmqhmhug.supabase.co
2. Open the **SQL Editor**
3. Paste and run the contents of `supabase-schema.sql`
4. Go to **Settings → API** to get your anon key

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://oqczobpuiitmdmqhmhug.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### 5. Run the App

```bash
npm run dev
```

Open http://localhost:5173

### 6. Create Your Account

- Click **Sign up** on the login page
- Create your admin account
- Start using the POS!

---

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── AuthPage.tsx          # Login + Signup page
│   ├── dashboard/
│   │   └── DashboardPage.tsx     # Stats, charts, alerts
│   ├── inventory/
│   │   ├── InventoryPage.tsx     # Product list + management
│   │   ├── ProductForm.tsx       # Add/edit product modal
│   │   └── RestockForm.tsx       # Batch restock modal
│   ├── pos/
│   │   ├── POSPage.tsx           # Main POS layout
│   │   ├── ProductGrid.tsx       # Clickable product grid
│   │   ├── CartPanel.tsx         # Cart + discount + tax
│   │   └── CheckoutModal.tsx     # Payment + invoice
│   ├── reports/
│   │   ├── ReportsPage.tsx       # Sales history + charts
│   │   └── SaleDetailModal.tsx   # Per-sale detail + print
│   └── shared/
│       ├── Layout.tsx            # Sidebar + nav wrapper
│       ├── Modal.tsx             # Reusable modal
│       ├── ConfirmDialog.tsx     # Confirm action dialog
│       ├── LoadingSpinner.tsx    # Loading states
│       └── ProtectedRoute.tsx   # Auth guard
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── productsApi.ts            # Products + batches API
│   └── salesApi.ts               # Sales + dashboard API
├── store/
│   ├── authStore.ts              # Auth state (Zustand)
│   └── cartStore.ts              # Cart state (Zustand)
├── types/
│   └── index.ts                  # TypeScript interfaces
├── utils/
│   └── index.ts                  # Formatters + helpers
├── App.tsx                       # Router + providers
├── main.tsx                      # Entry point
└── index.css                     # Tailwind + global styles
```

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `users` | User profiles linked to Supabase Auth |
| `products` | Product catalog with pricing |
| `inventory_batches` | Each restock as a separate batch (FIFO) |
| `sales` | Sale transactions with discount/tax |
| `sale_items` | Line items per sale with cost price |
| `payments` | Payment records per sale |

### Key Design Decisions

**FIFO Batch Tracking**: Every restock creates a new `inventory_batches` record. When selling, the system deducts from the oldest batch first (FIFO). This gives accurate profit calculation per sale.

**Cost Price Snapshot**: Each `sale_item` stores the actual `cost_price` from the batch at time of sale, so historical profit reports are always accurate even if costs change later.

---

## ✨ Features

### 🧾 Point of Sale
- Clickable product grid with search + category filter
- Cart management (add, remove, adjust quantity)
- Order-level discounts (percentage or fixed amount)
- Tax rate configuration
- Multiple payment methods: Cash, Card, Mobile, Credit
- Cash change calculation with quick-amount buttons
- Customer info capture
- Invoice generation with print support

### 📦 Inventory Management
- Add new products with SKU, category, unit, pricing
- Edit existing products
- Archive (soft delete) products
- **Restock with batch tracking** — each restock is a separate batch
- Stock status indicators (In Stock / Low Stock / Out of Stock)
- Summary cards for quick overview

### 📊 Dashboard
- Today's revenue, profit, and sales count
- Monthly revenue and sales count
- 7-day revenue + profit area chart
- Low stock alerts
- Recent sales table

### 📁 Reports
- Date range filtering (Today / This Week / This Month / Custom)
- Daily revenue + profit bar chart
- Per-transaction profit calculation
- Sales history table with search
- Per-sale detail modal with printable invoice

### 🔐 Authentication
- Email/password signup and login
- Session persistence (auto-login on refresh)
- Protected routes
- Sign out

---

## 🌐 Deployment

### Vercel (Recommended)

```bash
npm run build
# Deploy the dist/ folder to Vercel
```

Or connect your GitHub repo to Vercel and set environment variables in the Vercel dashboard.

### Netlify

```bash
npm run build
# Deploy dist/ to Netlify
```

Set these environment variables in Netlify:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL + Auth) |
| Charts | Recharts |
| Icons | Lucide React |
| Toasts | React Hot Toast |

---

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

**Never commit your `.env` file. Only `.env.example` is committed.**
