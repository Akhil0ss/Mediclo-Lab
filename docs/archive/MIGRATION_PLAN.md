# Mediclo - React + Node.js Migration Plan

## 🎯 Project Structure

```
mediclo/
├── client/                    # React Frontend (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── common/       # Buttons, Modals, Cards
│   │   │   ├── layout/       # Header, Sidebar, Footer
│   │   │   ├── patients/     # Patient components
│   │   │   ├── reports/      # Lab report components
│   │   │   ├── opd/          # OPD/Rx components
│   │   │   └── doctors/      # Doctor management
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Patients.jsx
│   │   │   ├── Samples.jsx
│   │   │   ├── Templates.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── OPD.jsx
│   │   │   ├── Doctors.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/         # API calls
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   ├── patients.js
│   │   │   ├── reports.js
│   │   │   └── opd.js
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Helper functions
│   │   ├── context/          # React Context (Auth, Theme)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── server/                    # Node.js Backend (Express)
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   │   ├── authController.js
│   │   │   ├── patientController.js
│   │   │   ├── reportController.js
│   │   │   ├── opdController.js
│   │   │   └── doctorController.js
│   │   ├── models/           # Prisma models (auto-generated)
│   │   ├── routes/           # API routes
│   │   │   ├── auth.js
│   │   │   ├── patients.js
│   │   │   ├── reports.js
│   │   │   ├── opd.js
│   │   │   └── doctors.js
│   │   ├── middleware/       # Auth, validation, error handling
│   │   │   ├── auth.js
│   │   │   ├── validate.js
│   │   │   └── errorHandler.js
│   │   ├── services/         # Business logic
│   │   │   ├── pdfService.js
│   │   │   ├── emailService.js
│   │   │   └── analyticsService.js
│   │   ├── utils/            # Helper functions
│   │   ├── config/           # Configuration
│   │   │   ├── database.js
│   │   │   └── env.js
│   │   └── server.js         # Express app entry
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── migrations/
│   ├── package.json
│   └── .env
│
├── docker-compose.yml         # Docker setup
├── .gitignore
└── README.md
```

---

## 📊 Database Schema (PostgreSQL + Prisma)

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  passwordHash  String
  role          Role      @default(USER)
  subscription  Subscription?
  branding      Branding?
  patients      Patient[]
  samples       Sample[]
  templates     Template[]
  reports       Report[]
  doctors       Doctor[]
  opdVisits     OPDVisit[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Subscription {
  id          String    @id @default(uuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id])
  plan        String    // 'trial', 'premium'
  startDate   DateTime
  endDate     DateTime
  isPremium   Boolean   @default(false)
  createdAt   DateTime  @default(now())
}

model Branding {
  id          String    @id @default(uuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id])
  labName     String
  tagline     String?
  address     String?
  contact     String?
  email       String?
  website     String?
  logo        String?   // Base64 or URL
  director    String?
  footerNotes String?
  pdfTheme    String    @default("blue")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Patient {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  name        String
  age         Int
  gender      String
  mobile      String
  address     String?
  refDoctor   String?
  testsRequired String[]
  samples     Sample[]
  reports     Report[]
  opdVisits   OPDVisit[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@index([userId, mobile])
}

model Sample {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  sampleNumber  String    @unique
  patientId     String
  patient       Patient   @relation(fields: [patientId], references: [id])
  sampleType    String    // Blood, Urine, etc.
  status        String    // Pending, Processing, Completed
  date          DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([userId, status])
}

model Template {
  id          String    @id @default(uuid())
  userId      String?
  user        User?     @relation(fields: [userId], references: [id])
  name        String
  category    String
  subtests    Json      // Array of subtest objects
  isAdmin     Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@index([userId, category])
}

model Report {
  id                    String    @id @default(uuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id])
  reportId              String    @unique
  patientId             String
  patient               Patient   @relation(fields: [patientId], references: [id])
  patientName           String
  patientAge            Int
  patientGender         String
  patientMobile         String
  patientAddress        String?
  patientRefDoctor      String?
  testDetails           Json      // Array of test objects
  sampleId              String?
  sampleType            String?
  sampleCollectionTime  String?
  fastingStatus         String?
  reportDate            DateTime
  createdAt             DateTime  @default(now())
  
  @@index([userId, reportDate])
}

model Doctor {
  id                  String    @id @default(uuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id])
  name                String
  qualification       String
  specialization      String
  registrationNumber  String
  mobile              String
  email               String?
  signature           String?   // Base64 image
  isDefault           Boolean   @default(false)
  opdVisits           OPDVisit[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@index([userId])
}

model OPDVisit {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  rxId              String    @unique
  patientId         String
  patient           Patient   @relation(fields: [patientId], references: [id])
  patientName       String
  patientAge        Int
  patientGender     String
  patientMobile     String
  doctorId          String
  doctor            Doctor    @relation(fields: [doctorId], references: [id])
  doctorName        String
  doctorQualification String
  visitDate         DateTime
  visitType         String    // New, Follow-up
  vitals            Json      // BP, Pulse, Temp, Weight, Height, SpO2
  chiefComplaints   String
  clinicalHistory   String?
  examination       String?
  diagnosis         String
  medicines         Json      // Array of medicine objects
  investigations    String?
  advice            String?
  followUpDate      DateTime?
  createdAt         DateTime  @default(now())
  
  @@index([userId, visitDate])
}

enum Role {
  USER
  ADMIN
}
```

---

## 🔧 Tech Stack Details

### Frontend (Client)
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Styling**: TailwindCSS (same colors/UI)
- **State**: React Context + Custom Hooks
- **Forms**: React Hook Form + Zod validation
- **HTTP**: Axios
- **Charts**: Chart.js / Recharts
- **Icons**: Font Awesome (same as current)
- **PDF Viewer**: react-pdf

### Backend (Server)
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Auth**: JWT (jsonwebtoken)
- **Validation**: Zod
- **PDF**: PDFKit or Puppeteer
- **Email**: Nodemailer (optional)
- **Logging**: Winston
- **Security**: Helmet, CORS, bcrypt

### DevOps
- **Containerization**: Docker + Docker Compose
- **Frontend Deploy**: Vercel
- **Backend Deploy**: Railway / Render
- **Database**: Railway PostgreSQL / Supabase
- **CI/CD**: GitHub Actions

---

## 🚀 Migration Steps

### Phase 1: Backend Setup (Day 1)
1. ✅ Initialize Node.js project
2. ✅ Setup Prisma + PostgreSQL
3. ✅ Create database schema
4. ✅ Build authentication API
5. ✅ Build CRUD APIs (Patients, Samples, Templates, Reports)
6. ✅ Implement PDF generation service
7. ✅ Add validation & error handling

### Phase 2: Frontend Setup (Day 2)
1. ✅ Initialize React + Vite project
2. ✅ Setup routing & layout
3. ✅ Recreate UI components (same design)
4. ✅ Implement authentication flow
5. ✅ Build patient management
6. ✅ Build sample management
7. ✅ Build template management

### Phase 3: Reports & PDF (Day 3)
1. ✅ Build report generation UI
2. ✅ Integrate with backend PDF service
3. ✅ Implement sample collection details
4. ✅ Add color themes
5. ✅ Test all PDF features

### Phase 4: OPD Module (Day 4)
1. ✅ Build doctors management
2. ✅ Build OPD visit form
3. ✅ Implement Rx prescription PDF
4. ✅ Add vitals tracking
5. ✅ Medicine management

### Phase 5: Analytics & Polish (Day 5)
1. ✅ Build analytics dashboard
2. ✅ Add charts & graphs
3. ✅ Implement branding settings
4. ✅ Final testing
5. ✅ Deployment setup

---

## 📦 Deployment

### Option A: Separate Hosting (Recommended)
```
Frontend → Vercel (Free tier)
Backend  → Railway (Free $5/month credit)
Database → Railway PostgreSQL
```

### Option B: All-in-One
```
Full Stack → Render (Free tier)
Database   → Render PostgreSQL
```

### Docker Deployment
```bash
docker-compose up -d
# Runs frontend, backend, and PostgreSQL locally
```

---

## 🔐 Security Improvements

1. **Server-side validation** - All inputs validated on backend
2. **JWT authentication** - Secure token-based auth
3. **Password hashing** - bcrypt with salt rounds
4. **SQL injection prevention** - Prisma ORM parameterized queries
5. **CORS protection** - Whitelist allowed origins
6. **Rate limiting** - Prevent API abuse
7. **HTTPS only** - Encrypted communication
8. **Environment variables** - Sensitive data in .env

---

## 📈 Scalability Features

1. **Database indexing** - Fast queries on large datasets
2. **Pagination** - Handle 10,000+ records
3. **Caching** - Redis for frequently accessed data (future)
4. **CDN** - Static assets on Cloudflare (future)
5. **Load balancing** - Multiple server instances (future)
6. **Database replication** - Read replicas (future)

---

## 🎨 UI Preservation

All current UI elements will be preserved:
- ✅ Same gradient colors
- ✅ Same card designs
- ✅ Same colorful buttons
- ✅ Same icons (Font Awesome)
- ✅ Same animations
- ✅ Same responsive layout
- ✅ Same PDF styling

---

## 📝 Migration Checklist

- [x] Backup current version (Git tag + folder copy)
- [ ] Initialize backend project
- [ ] Setup database schema
- [ ] Build authentication
- [ ] Build patient APIs
- [ ] Build sample APIs
- [ ] Build template APIs
- [ ] Build report APIs
- [ ] Build doctor APIs
- [ ] Build OPD APIs
- [ ] Initialize frontend project
- [ ] Setup routing
- [ ] Build auth pages
- [ ] Build dashboard
- [ ] Build patient pages
- [ ] Build sample pages
- [ [ ] Build template pages
- [ ] Build report pages
- [ ] Build doctor pages
- [ ] Build OPD pages
- [ ] Build analytics
- [ ] Build settings
- [ ] Test all features
- [ ] Deploy to production

---

## 🔄 Rollback Plan

If anything goes wrong:
```bash
# Restore from Git tag
git checkout v1.0-html-backup

# Or use backup folder
cd ../Mediclo-1-HTML-BACKUP
```

---

## 📞 Support & Maintenance

Post-migration:
- Regular security updates
- Database backups (daily)
- Performance monitoring
- Bug fixes & improvements
- Feature additions as needed
