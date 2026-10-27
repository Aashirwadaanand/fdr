# FDR-Sentinel: AICTE Security Deposit & FDR Management Portal

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-339933.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev)
[![Database](https://img.shields.io/badge/Database-SQLite%20(node%3Asqlite)-003B57.svg)](https://nodejs.org/api/sqlite.html)
[![OpenAPI 3.0](https://img.shields.io/badge/API%20Docs-OpenAPI%203.0-85EA2D.svg)](http://localhost:5000/api/docs)
[![Tests Passing](https://img.shields.io/badge/Tests-25%2F25%20Passing-brightgreen.svg)]()
[![Benchmark](https://img.shields.io/badge/Benchmark-30%2F30%20Caught-brightgreen.svg)]()
[![Scenario Suite](https://img.shields.io/badge/Scenarios-10%2F10%20Passing-brightgreen.svg)]()

> **Prototype Notice:** This portal operates on deterministic synthetic data. Bank verification is simulated via mock adapters. OCR extraction is simulated using pattern matching. Transport and at-rest encryption are deployment/infrastructure concerns.

---

## 📌 Executive Summary

**FDR-Sentinel** is an enterprise-grade regulatory portal engineered for the **AICTE Regulation Bureau**. It provides end-to-end governance over Fixed Deposit Receipts (FDRs) pledged as security deposits by technical and higher educational institutions across India.

The portal enforces a rigorous compliance pipeline: automated OCR certificate intake, an 8-rule compliance engine, a 3-tier trust hierarchy, simulated Core Banking API verification, automated validity tracking with a time-travel demo clock, maker-checker release authorization, and a cryptographically hash-chained, tamper-evident audit trail with SQLite triggers preventing unauthorized modification.

---

## 🛠️ Technology Stack & Architectural Rationale

| Layer | Chosen Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | **Node.js 24 LTS** | High performance, non-blocking asynchronous I/O, native TypeScript support, and zero native-compilation requirements. |
| **Backend Framework** | **Express.js + TypeScript** | Mainstream, highly reliable, battle-tested HTTP layer with strong static typing, typed middleware, and clean modular routing. |
| **Database** | **`node:sqlite` (`DatabaseSync`)** | Built into Node.js 24 standard library. Zero external C++ build tool dependencies (avoids `node-gyp` / MSBuild compiler failure risks). Fully supports ACID transactions, prepared statements, WAL mode, foreign key cascades, and database triggers. |
| **Frontend Framework** | **React 19 + TypeScript + Vite** | Fast compilation, modern hooks architecture, type-safe API consumption, and sub-second Hot Module Replacement. |
| **Design System** | **Vanilla CSS + Modern Tokens** | Deep Navy (`#0A2540`), Gold (`#E89C19`), and Slate palette with glassmorphism, responsive data grids, accessible color-independent status indicators, and zero Tailwind overhead. |
| **Cryptographic Audit** | **SHA-256 Hash Chaining** | Append-only ledger with sequential hash linking `SHA-256(prev_hash + canonical_json)`. Enforced at database level via SQLite triggers `BEFORE UPDATE` and `BEFORE DELETE`. |
| **API Specification** | **OpenAPI 3.0 (Swagger UI)** | Fully documented interactive REST endpoints accessible at `/api/docs`. |

---

## ⚡ Quickstart (One Documented Command)

### Prerequisites
- **Node.js**: v24.0.0 or higher
- **npm**: v10.0.0 or higher

### 1. Clone & Start (Single Command)
```bash
# Clone the repository
git clone https://github.com/aicte-regulation/fdr-sentinel.git
cd fdr-sentinel

# Install all dependencies (root, server, client)
npm run install:all

# Seed database and start the production portal (API + React UI) on Port 5000
npm start
```
The application will launch and be accessible immediately at:
👉 **`http://localhost:5000`**

---

## 🔑 Role-Based Access Control & Default Logins

FDR-Sentinel enforces strict role-based access control and tenant isolation on the server. Unauthorized or cross-institution requests return `403 Forbidden` and are permanently logged to the cryptographic audit trail.

| Role | Email | Password | Allowed Bureau Scope |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@aicte.gov.in` | `Admin@123` | Full system control: Rule toggles, SLA & reminder thresholds, user management, deliberate audit tamper demo, time-travel demo clock controls. |
| **SCRUTINY_OFFICER** | `scrutiny@aicte.gov.in` | `Scrutiny@123` | Scrutiny review, observation recording, bank verification triggering, release request recommendation. |
| **APPROVING_AUTHORITY** | `authority@aicte.gov.in` | `Authority@123` | Final release/discharge/refund approval. Strictly prohibited by Maker-Checker rules from approving requests they recommended or verified. |
| **AUDITOR** | `auditor@aicte.gov.in` | `Auditor@123` | Read-only access across all institutions, instruments, reports, and cryptographic audit log. |
| **INSTITUTION_OFFICER** | `officer@iitdelhi.ac.in` | `Officer@123` | Pledged deposit management for own institution (Indian Institute of Technology Delhi, INST-001). Cannot access records of other institutions. |

*(A 1-click Demo Role Switcher is available in the top navigation bar for seamless evaluation).*

---

## ⚙️ Environment Variables (`.env.example`)

Copy `.env.example` to `.env` if custom runtime overrides are needed:

```bash
# Server Port (Default: 5000)
PORT=5000

# Environment Mode
NODE_ENV=production

# JWT Secret Key (Use a strong secret in production)
JWT_SECRET=aicte-fdr-sentinel-dev-secret-key-change-in-production-123456

# Database File Path
DB_PATH=./fdr_sentinel.db

# File Upload Directory
UPLOAD_DIR=./uploads

# Time-Travel Demo Clock Control
ENABLE_DEMO_CLOCK=true
```

---

## 🧪 Automated Testing & Verification Suite

All tests, benchmarks, and scenario tests execute live against the database:

### 1. Run Complete Test Suite (25 Unit & Integration Tests)
```bash
npm test
```
*Executes 4 comprehensive test suites covering Auth/RBAC/Clock, Rules/Adapters/Lifecycle, Scheduler/Alerts/Escalation, and Release Workflow/Maker-Checker.*

### 2. Run Deterministic Seed Generator
```bash
npm run seed
```
*Generates 40 fictional institutions, 4 fictional banks, 200 synthetic FDRs, exactly 30 deliberate compliance errors (5 of each of the 6 types), and reused document hashes.*

### 3. Run Benchmark Suite (Error Catch Rate & 100-Edit Tamper Test)
```bash
npm run benchmark
```
*Scans all 200 records live against the 8-rule compliance engine and performs 100 randomized audit record edits to benchmark tamper detection.*

### 4. Run Scenario Verification Suite (10 End-to-End Scenarios)
```bash
npm run verify
```
*Executes 5 positive workflow scenarios and 5 negative security/permission scenarios with live pass/fail output.*

---

## 🏛️ System Architecture & Pluggable Interfaces

```
                  ┌────────────────────────────────────────────────────────┐
                  │          FDR-Sentinel Client (React 19 + Vite)         │
                  │   Responsive UI • Role Switcher • Time-Travel Bar      │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTP / JSON (JWT Auth)
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             Express 4.x REST API Engine                                  │
├──────────────────┬──────────────────────┬───────────────────────┬────────────────────────┤
│  Authentication  │     Rule Engine      │    State Machine      │   Release Workflow     │
│  • JWT + bcrypt  │  • 8 Config Rules    │  • 8 Valid States     │  • 4-Point Checklist   │
│  • Rate Limiter  │  • Triage Aids       │  • Role Transitions   │  • Maker-Checker Gate  │
│  • RBAC & Tenant │  • Trigger Values    │  • Audit History      │  • Recommender != Appr │
└─────────┬────────┴──────────┬───────────┴───────────┬───────────┴───────────┬────────────┘
          │                   │                       │                       │
          ▼                   ▼                       ▼                       ▼
┌──────────────────┐ ┌──────────────────┐   ┌──────────────────┐   ┌────────────────────────┐
│ IStorageAdapter  │ │IExtractionAdapter│   │IBankVerification │   │ Cryptographic Ledger   │
│ • LocalDisk      │ │ • Simulated OCR  │   │ • Mock Bank API  │   │ • Append-Only Triggers │
│ • S3 / GCS (Ext) │ │ • Azure Form(Ext)│   │ • Letter Upload  │   │ • SHA-256 Hash Chain   │
│ • SHA-256 Digest │ │ • Side-by-Side   │   │ • Disabled Live  │   │ • Tamper Detection     │
└──────────────────┘ └──────────────────┘   └──────────────────┘   └────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ SQLite Relational Engine  │
                        │ • WAL Mode • Transactions │
                        │ • Foreign Keys • Triggers │
                        └───────────────────────────┘
```

### Pluggable Interfaces
1. **Document Storage (`IStorageAdapter`)**:
   - `LocalDiskStorageAdapter`: Stores certificates with versioning and cryptographic SHA-256 fingerprinting.
   - Ready for cloud adapters (`S3StorageAdapter`, `GCSStorageAdapter`).
2. **Text Extraction (`IExtractionAdapter`)**:
   - `SimulatedOcrExtractionAdapter`: Pattern-matches certificate text and flags discrepancies against form inputs.
   - Clearly labeled as "Simulated OCR" in the UI. Ready for cloud OCR engines.
3. **Bank Verification (`IBankVerificationAdapter`)**:
   - `MockBankVerificationAdapter`: Queries a separate fictional core banking dataset with simulated asynchronous network latency.
   - `BankConfirmationLetterAdapter`: Verifies official bank confirmation letters against FDR reference and amounts.
   - `LiveBankApiAdapter`: Disabled by design ("Requires formal bilateral authorization with scheduled commercial banks").

---

## 📋 Compliance Rule Engine (8 Rules)

Admin configurable on/off via the Admin Settings page (`/admin`):

1. `MISSING_REQUIRED_FIELD`: Flags records with null or blank mandatory fields (bank, branch, amount, maturity).
2. `DUPLICATE_REFERENCE`: Flags duplicate FDR reference numbers across all institutions.
3. `INVALID_DATE_SEQUENCE`: Flags instruments where Issue Date is on or after Maturity Date.
4. `NON_POSITIVE_AMOUNT`: Flags zero or negative deposit amounts.
5. `EXTRACTED_VS_SUBMITTED_MISMATCH`: Flags variance between OCR-extracted certificate values and submitted metadata.
6. `OVERDUE_BUT_ACTIVE`: Flags instruments past maturity date still residing in `ACTIVE` state.
7. `MISSING_SUPPORTING_DOCUMENT`: Flags FDRs submitted without an attached certificate or deposit advice.
8. `REUSED_DOCUMENT_HASH`: Flags duplicate SHA-256 file hashes uploaded across different instruments.

> **Regulatory Notice:** Rule flags are designated as *compliance triage aids*, not fraud verdicts.

---

## 🔄 State Machine & Tri-Level Trust Hierarchy

### Lifecycle States
```
SUBMITTED ──► UNDER_SCRUTINY ──► VERIFIED ──► ACTIVE ──► EXPIRING ──► MATURED ──┬──► RENEWED
                                                                                └──► RELEASED
```

### Tri-Level Trust Status
1. `DECLARED` (Initial state upon submission by institution).
2. `DOCUMENT_EXTRACTED` (OCR extraction executed and confirmed).
3. `BANK_CONFIRMED` (Attained *only* upon successful verification via a bank verification adapter).

---

## 🔒 Tamper-Evident Audit Trail & Cryptographic Chain

Every administrative, lifecycle, verification, and rule action records an immutable audit entry:
```
Hash(n) = SHA-256( Hash(n-1) + CanonicalJSON(Sequence, Actor, Action, EntityType, EntityId, Payload) )
```

### Database-Level Tamper Prevention
SQLite database triggers enforce append-only immutability:
- `audit_no_update`: `BEFORE UPDATE ON audit_entries BEGIN SELECT RAISE(ABORT, 'Audit log is append-only: updates are forbidden.'); END;`
- `audit_no_delete`: `BEFORE DELETE ON audit_entries BEGIN SELECT RAISE(ABORT, 'Audit log is append-only: deletions are forbidden.'); END;`

### Interactive Tamper Demo
- **Verify Integrity**: Scans all sequential SHA-256 links from sequence #1 to latest.
- **Tamper Demo**: Simulates direct database corruption on a record's payload. The verifier detects the exact broken sequence number and hash mismatch in red.
- **Restore Record**: Restores canonical payload and confirms chain validity.

---

## 🚀 Free-Tier Cloud Deployment Guide

### Deploying with Docker
```bash
# Build Docker image
docker build -t fdr-sentinel .

# Run container on port 5000
docker run -d -p 5000:5000 --name fdr-sentinel -v fdr-data:/app/data fdr-sentinel
```

### Deploying to Render / Railway / Fly.io (Free Tier)
1. **Repository**: Push code to GitHub.
2. **Build Command**: `npm run install:all && npm run build`
3. **Start Command**: `npm start`
4. **Environment Variables**:
   - `PORT=5000`
   - `NODE_ENV=production`
   - `JWT_SECRET=<your-random-32-char-secret>`
   - `DB_PATH=/tmp/fdr_sentinel.db` (or attach a persistent volume)
   - `UPLOAD_DIR=/tmp/uploads`
5. **Health Check**: `GET /api/health`

---

## 📄 License & Attribution

Developed for the **All India Council for Technical Education (AICTE)** Regulation Bureau.
All financial institutions, certificates, registration numbers, and applicant names are purely synthetic.
