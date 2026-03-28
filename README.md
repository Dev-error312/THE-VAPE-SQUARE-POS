# SwiftPOS — Smart Point of Sale System

SwiftPOS is a modern, full-stack Point of Sale (POS) system designed for fast, accurate, and scalable retail operations. Built using React, TypeScript, and Supabase, it provides real-time inventory tracking, detailed sales insights, and a seamless checkout experience.

---

## 🧾 Overview

SwiftPOS helps businesses manage sales, inventory, and reporting in one unified platform. It is built with performance and usability in mind, making it suitable for retail stores, electronics shops, vape stores, and other small-to-medium businesses.

The system runs entirely online with a cloud-based backend, ensuring your data is always accessible, secure, and synchronized across devices.

---

## ⚙️ How It Works

SwiftPOS follows a structured workflow:

### 1. Inventory Setup
- Add products with pricing, SKU, and category
- Restock products using batch tracking

### 2. Batch-Based Stock Management
- Every restock creates a new inventory batch
- Sales deduct stock using FIFO (First-In-First-Out)
- Ensures accurate cost and profit tracking

### 3. Sales Processing (POS)
- Select products via a grid interface
- Add items to cart and adjust quantities
- Apply discounts and taxes
- Choose payment method and complete checkout

### 4. Automatic Calculations
- Profit is calculated per item using actual batch cost
- Discounts and taxes are applied at order level
- Change is calculated instantly for cash payments

### 5. Reporting & Insights
- Track daily, weekly, and monthly performance
- View profit, revenue, and sales trends
- Analyze individual transactions in detail

---

## 🚀 Key Features

### 🧾 Point of Sale
- Fast and intuitive product selection
- Real-time cart updates
- Discount (percentage or fixed)
- Tax calculation
- Multiple payment methods (Cash, Card, Mobile, Credit)
- Invoice generation and print support

### 📦 Inventory Management
- Product creation and editing
- Category and SKU management
- Batch-based restocking system
- FIFO stock deduction
- Low stock and out-of-stock alerts

### 📊 Dashboard
- Daily and monthly revenue overview
- Profit tracking
- Sales count metrics
- Visual charts for trends
- Recent transaction summary

### 📁 Reports
- Sales history with filters
- Profit per transaction
- Date range analytics
- Printable sale details

### 🔐 Authentication
- Secure user signup/login
- Session persistence
- Protected routes
- Role-based access ready structure

---

## 🧠 Core System Design

### FIFO Inventory System
Each restock creates a separate batch. When a sale occurs, stock is deducted from the oldest batch first. This ensures:
- Accurate cost tracking  
- Real profit calculation  
- No mixing of batch prices  

### Cost Price Snapshot
Every sale item stores the exact cost price at the time of sale. This guarantees:
- Historical accuracy  
- Reliable profit reports  
- No impact from future price changes  

---

## 🛠️ Tech Stack

| Layer        | Technology                    |
|-------------|-----------------------------|
| Frontend     | React + TypeScript          |
| Styling      | Tailwind CSS                |
| State        | Zustand                     |
| Routing      | React Router                |
| Backend      | Supabase (PostgreSQL + Auth)|
| Charts       | Recharts                    |

---

## 🌐 Deployment

SwiftPOS is optimized for modern deployment platforms and can be hosted easily on:

- Vercel  
- Netlify  

It runs as a fast, lightweight web app with real-time backend support.

---

## 🔒 Environment Configuration

The app requires the following environment variables:
