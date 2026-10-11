# 🏫📋 Little Buds Child Care Centre ERP

> **An Enterprise Administrative, Developmental Profiling, and Double-Entry Financial Management Platform for Early Childhood & Activity Centres.**

Little Buds Child Care Centre ERP is a modern, web-based management platform engineered to streamline daily operational workflows, student developmental profiling, session attendance tracking, and end-to-end institutional financial accounting.

---

## 🎯 Overview & Purpose

Managing early childhood development centres requires synchronizing day-to-day childcare workflows with rigorous financial administration. Little Buds bridges these domains by providing:

- Complete student admission profiles, medical and care annotations, and milestone tracking.
- Dynamic attendance logging across specialized developmental and therapy sessions.
- Automated printable invoices and payment vouchers with Indian Rupee number-to-words conversion.
- An institutional-grade accounting engine featuring a standard Chart of Accounts (COA), capital asset registers with depreciation, and real-time Balance Sheets and Profit & Loss statements.

## 🚀 Core Modules & Features

### 📊 1. Executive Operations Dashboard

- **High-Level KPIs:** Real-time visibility into active enrolments, monthly fee collections, pending fee dues, operating expenses, and daily attendance rates.
- **Rapid Action Points:** Single-click navigation to admit children, record payments, log capital purchases, and export financial summaries.
- **Activity & Attendance Feed:** Operational log tracking administrative updates across the facility.

### 👶 2. Student Profile & Developmental Management

- **Comprehensive Records:** Date of birth, admission metadata, and guardian contact profiles.
- **Childcare & Developmental Notes:** Dedicated tracking for developmental focus areas, dietary restrictions, allergies, and milestone goals.
- **Student Statement Cards:** Individual financial ledger history paired with printable progress reports.

### 📅 3. Attendance & Specialized Session Tracking

- **Daily Status Registry:** Mark attendance states such as `Present`, `Absent`, and `Late` for each child.
- **Therapy & Activity Modules:** Track specific developmental disciplines, including:
  - Speech & Communication
  - Motor & Physical Play
  - Social & Behavioral Development
- **Historical Audit:** Interactive date pickers and per-student historical attendance logs.

### 🧾 4. Fee Management & Formatted Invoicing

- **Categorized Billing:** Generate invoices for monthly tuition, specialized activities, registration, and therapy sessions.
- **Flexible Payments:** Support for partial payments and multiple payment modes, including UPI, bank transfer, cash, and cheque.
- **Automated Overdue Tracking:** Identify pending balances and overdue payments.
- **Printable Invoices:** Institution-branded documents with configurable PAN/GST details, automated total calculations, and print-ready layouts.

### 💰 5. Financial Accounting, Assets & Ledgers

- **Double-Entry-Aligned Chart of Accounts (COA):** Standardized accounting heads covering:

  | Account Category | Account Code Range |
  |---|---|
  | Assets | `1000` series |
  | Liabilities | `2000` series |
  | Equity | `3000` series |
  | Revenue | `4000` series |
  | Operating Expenses | `5000` series |

- **Multi-Type Purchase Management:** Differentiate operational expenditure from capital and other asset transactions.
- **Capital Fixed Assets:** Track purchase costs, asset condition, physical room or location, serial numbers, and estimated depreciation.
- **Security Deposits:** Track facility lease and utility deposits as assets, including deposits for KSEB electricity and municipal water.
- **Partner Capital:** Record partner equity contributions.
- **Automated Financial Statements:** Generate financial reports, including:
  - Income & Expenditure Statement / Profit & Loss Statement
  - Balance Sheet
  - Cash Flow Statement with operating, investing, and financing activities

### 🖋️ 6. Official Payment Voucher System

- **Disbursement Generator:** Generate payment vouchers with automatic Indian Rupee number-to-words conversion.
- **Verification Workflow:** Dedicated signature blocks for:
  - Prepared By
  - Checked & Verified
  - Authorized Signatory
  - Receiver's Signature

### 🔒 7. Security, Audit Trails & Role-Based Access

- **Role-Based Access Control (RBAC):** Role-specific access for:
  - Admin
  - Teacher
  - Staff
  - Billing
  - Therapist
- **Audit Trail:** Timestamped action records designed to track creation, modification, and deletion events across student records and financial ledgers.

## 🛠️ Technical Architecture & Stack

### 💻 Frontend Architecture

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS with dynamic runtime theme tokens
- **Icons:** Lucide React
- **Date Utilities:** `date-fns`
- **Document Rendering:** `html2canvas` and iframe-based printing

### ⚙️ Backend & Server Infrastructure

- **Runtime:** Express.js with TypeScript (`server.ts`)
- **Production Compilation:** `esbuild`
- **Production Output:** Standalone Node.js script (`dist/server.cjs`)
- **Health Monitoring:** `/api/health` endpoint for Cloud Run container health checks

### ☁️ Cloud & Database Layer

- **Database:** Google Cloud Firestore with real-time listeners and compound index optimization
- **Authentication:** Firebase Authentication
- **Session Management:** Local session management integrated with Firebase authentication

## ⚡ Getting Started

### 📋 Prerequisites

Ensure the following tools and services are available:

- [Node.js](https://nodejs.org/) — Version `18.0.0` or later, subject to project dependency requirements
- npm or pnpm
- A configured [Firebase](https://firebase.google.com/) / Google Cloud project
- Appropriate Firebase Authentication and Firestore configuration

### 📥 Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/little-buds-erp.git
cd little-buds-erp
```

Replace `YOUR_USERNAME` with your GitHub username or organization name.

#### 2. Install Dependencies

Using npm:

```bash
npm install
```

Or using pnpm:

```bash
pnpm install
```

#### 3. Configure Environment Variables

Create a `.env` file in the root directory of the project.

```env
PORT=3000

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Replace the placeholder values with the corresponding configuration from your Firebase project.

> **Security note:** Variables prefixed with `VITE_` are exposed to client-side code. Never store private credentials, service-account keys, or other secrets in these variables. Use server-side environment variables for sensitive operations.

#### 4. Run the Development Server

```bash
npm run dev
```

Or:

```bash
pnpm dev
```

Open the application in your browser:

[http://localhost:3000](http://localhost:3000)

> **Note:** The development URL depends on your Vite and Express configuration. Use the actual local URL printed in your terminal if it differs.

#### 5. Build for Production

Compile the application:

```bash
npm run build
```

#### 6. Start the Production Server

```bash
npm start
```

Ensure that the `start` script in `package.json` launches the compiled server from `dist/server.cjs`.

## 🛡️ Data Security & Privacy

Little Buds ERP handles sensitive information relating to children, guardians, developmental progress, and financial transactions. The production deployment should include:

- **Access Control:** Enforce role-based authorization on both frontend and backend.
- **Data Protection:** Restrict access to children's personal and developmental records.
- **Secure Authentication:** Validate user identity and authorization before granting access to protected resources.
- **Auditability:** Maintain reliable records of important administrative and financial operations.
- **Credential Safety:** Keep server-side secrets outside version control.
- **Data Backups:** Establish a regular backup and recovery strategy for institutional records.

## 🔮 Project Vision

Our vision is to simplify childcare administration while supporting inclusive developmental care, responsible financial management, and transparent institutional operations.

**Better Care. Smarter Management. Brighter Futures.**

## 📄 License

This project is licensed under the **MIT License**. You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the terms and conditions of the license.

See the [`LICENSE`](LICENSE) file for details.

---

<p align="center">
  <strong>🏫 Little Buds Child Care Centre ERP</strong><br>
  <em>Empowering Inclusive Care Through Technology.</em>
</p>
