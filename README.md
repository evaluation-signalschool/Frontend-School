# Web School Evaluation: ระบบประเมินผลและจัดการคะแนนนักเรียน (Frontend)

เว็บแอปพลิเคชันส่วนหน้า (Frontend) สำหรับระบบประเมินผลการเรียน, จัดการคะแนน, ออกรายงานผลการเรียน (Transcript), ออกเกียรติบัตร (Certificate) และระบบบริหารจัดการของผู้ดูแลระบบ (Admin Dashboard) พัฒนาด้วย **Angular 21 (Standalone Components)** และ Deploy บน **Firebase Hosting**

---

## สารบัญ

1. [ภาพรวมระบบและฟีเจอร์หลัก](#ภาพรวมระบบและฟีเจอร์หลัก)
2. [เทคโนโลยีและเครื่องมือ (Tech Stack)](#เทคโนโลยีและเครื่องมือ-tech-stack)
3. [สิ่งที่ต้องเตรียมล่วงหน้า (Prerequisites)](#สิ่งที่ต้องเตรียมล่วงหน้า-prerequisites)
4. [การติดตั้งและรันโปรเจกต์ (Installation & Development)](#การติดตั้งและรันโปรเจกต์)
5. [การกำหนดค่า Environment](#การกำหนดค่า-environment)
6. [โครงสร้างโปรเจกต์ (Folder Structure)](#โครงสร้างโปรเจกต์-folder-structure)
7. [การจัดการสิทธิ์และ Token (Guards & Interceptors)](#การจัดการสิทธิ์และ-token-guards--interceptors)
8. [การ Build และ Deploy (Firebase Hosting)](#การ-build-และ-deploy-firebase-hosting)
9. [ข้อควรระวังและแนวทางพัฒนาต่อ (Handover Notes)](#ข้อควรระวังและแนวทางพัฒนาต่อ-handover-notes)

---

## ภาพรวมระบบและฟีเจอร์หลัก

- **ระบบนักเรียน (Student Portal)**:
  - เข้าสู่ระบบด้วย Google Sign-In
  - ดูคะแนน
  - ยื่นคำร้องขอแก้ไขข้อมูลส่วนตัว (พร้อมแนบเอกสาร/รูปภาพ)
  - ตอบแบบประเมินรายวิชาและแบบประเมินหลักสูตร
- **ระบบผู้ดูแลระบบ (Admin Dashboard)**:
  - จัดการรายชื่อนักเรียน (เพิ่มรายคน / คัดลอกจาก excel วาง)
  - จัดการหลักสูตร, รุ่น, และรายวิชา
  - บันทึกคะแนน, คำนวณเกรดอัตโนมัติ, จัดอันดับนักเรียน (Student Ranking)
  - อนุมัติคำร้องขอแก้ไขข้อมูลส่วนตัวของนักเรียน
  - ออกเอกสารทางการ: ใบรับรองผลการศึกษา (Transcript) และเกียรติบัตร (Certificate) อยู่ระหว่างการพัฒนา
  - สรุปสถิติภาพรวมและการวิเคราะห์ผลการฝึกอบรม (Chart.js / Excel Export)
  - จัดการสิทธิ์แอดมิน (Admin Users) และตรวจสอบประวัติการใช้งาน (Admin Logs)
- **ระบบอาจารย์และคณะกรรมการ (Teacher & Committee Portal)**:
  - ตอบแบบประเมิน

---

## 🛠️ เทคโนโลยีและเครื่องมือ (Tech Stack)

| ส่วนประกอบ                  | เทคโนโลยี / Library                | หน้าที่                                            |
| --------------------------- | ---------------------------------- | -------------------------------------------------- |
| **Framework**               | Angular 21 (Standalone Components) | โครงสร้างสถาปัตยกรรม SPA หลัก                      |
| **Language**                | TypeScript (~5.9.2)                | ภาษาหลักในการพัฒนา                                 |
| **UI Components**           | Angular Material, Angular CDK      | ส่วนประกอบ UI (Dialog, Table, Form Controls)       |
| **Data Visualization**      | Chart.js                           | แสดงกราฟสถิติคะแนนและผลประเมิน                     |
| **Notifications & Dialogs** | SweetAlert2                        | แสดง Alert และ Modal ยืนยันการทำรายการ             |
| **Export Tools**            | ExcelJS, FileSaver                 | ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)                 |
| **Hosting & CI/CD**         | Firebase Hosting, GitHub Actions   | เผยแพร่เว็บอัตโนมัติเมื่อ Merge เข้า branch `main` |

---

## 📋 สิ่งที่ต้องเตรียมล่วงหน้า (Prerequisites)

- **Node.js**: เวอร์ชัน 20.x ขึ้นไป
- **NPM**: v10.9+
- **Angular CLI**: ติดตั้งผ่านคำสั่ง `npm install -g @angular/cli` (ถ้าต้องการใช้คำสั่ง `ng` ในเทอร์มินัล)

---

## 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์ (Installation & Development)

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. รันในโหมด Development Server

```bash
npm start
# หรือคำสั่ง Angular CLI:
ng serve
```

เมื่อรันสำเร็จ สามารถเปิดเว็บได้ที่: `http://localhost:4200` (ระบบจะ Reload อัตโนมัติเมื่อมีการบันทึกไฟล์)

### 3. รัน Unit Test (ใช้ Vitest)

```bash
npm test
```

---

## ⚙️ การกำหนดค่า Environment

การตั้งค่า Base URL ของ API และ Client ID อยู่ที่โฟลเดอร์ `src/environments/`:

- **`src/environments/environment.development.ts`** (โหมด Dev):
  ```typescript
  export const environment = {
    production: false,
    apiUrl: 'https://backend-school-7x2e.onrender.com/api', // หรือเปลี่ยนเป็น 'http://localhost:3000/api' เมื่อรัน Backend ในเครื่อง
    googleClientId: '778648808832-bm9jtmm6ace6prq8v9nfesk96knt2l0q.apps.googleusercontent.com',
  };
  ```
- **`src/environments/environment.ts`** (โหมด Production บน Firebase):
  ```typescript
  export const environment = {
    production: true,
    apiUrl: 'https://backend-school-7x2e.onrender.com/api',
    googleClientId: '778648808832-bm9jtmm6ace6prq8v9nfesk96knt2l0q.apps.googleusercontent.com',
  };
  ```

---

## โครงสร้างโปรเจกต์ (Folder Structure)

```text
Evaluation/
├── .github/workflows/          # GitHub Actions สำหรับ CI/CD (Deploy ขึ้น Firebase Hosting อัตโนมัติ)
├── docs/                       # เอกสารคู่มือผู้ดูแลระบบ (Admin Manual)
├── public/                     # Static Assets (รูปภาพ, ไอคอน, โลโก้)
├── src/
│   ├── app/
│   │   ├── components/         # Shared Components ที่ใช้ซ้ำในหลายหน้า
│   │   ├── guards/             # Route Guard ตรวจสอบสิทธิ์การเข้าถึงหน้าเว็บ (admin.guard.ts)
│   │   ├── header/             # Header / Navbar เมนูด้านบนของระบบ
│   │   ├── home/               # หน้าแรก (Landing Page)
│   │   ├── interceptors/       # HTTP Interceptors สำหรับแนบ Token กับ Request (auth.interceptor.ts)
│   │   ├── main/               # Layout หลักและหน้าแดชบอร์ดตามสิทธิ์ผู้ใช้ (Admin, Student, Teacher, Committee)
│   │   ├── pages/              # โฟลเดอร์รวมหน้าจอการทำงานทั้งหมดของระบบ (28 หน้า)
│   │   ├── services/           # Service สำหรับยิง HTTP Request เชื่อมต่อกับ Backend API
│   │   ├── app.config.ts       # กำหนด Provider และการตั้งค่าพื้นฐานของ Angular
│   │   └── app.routes.ts       # กำหนด Routing เส้นทาง URL ของหน้าเว็บทั้งหมด
│   └── environments/           # กำหนด Base API URL (Development และ Production)
├── angular.json                # ไฟล์ตั้งค่า Angular Workspace
├── firebase.json               # การตั้งค่า Firebase Hosting (กำหนด SPA Rewrite ไปที่ index.html)
└── package.json                # รายการ Dependencies และ Scripts ของโปรเจกต์
```

---

### รายละเอียดโฟลเดอร์ใน `src/app/`

- **`components/`**: สำหรับเก็บ component ย่อยที่ถูกเรียกใช้ซ้ำในหลายๆ จุด เช่น Dialog ย่อย, ปุ่ม หรือการ์ดแสดงผล
- **`guards/`**: มี `admin.guard.ts` สำหรับป้องกันการเข้าถึง route ฝั่งแอดมิน (`/admin/*`) หากผู้ใช้ยังไม่ได้ล็อกอิน หรือไม่มีสิทธิ์ จะถูก redirect กลับไปที่หน้า `/admin/login`
- **`interceptors/`**: มี `auth.interceptor.ts` ทำหน้าที่ตรวจสอบ URL และ path ที่กำลังใช้งาน หากเป็นส่วนของแอดมินจะดึง `admin_token` หรือหากเป็นส่วนของนักเรียนจะดึง `student_token` มาแนบใน Header `Authorization: Bearer <token>` ให้อัตโนมัติทุก request
- **`header/`**: แสดงแถบเมนูด้านบน ชื่อผู้ใช้งานที่กำลังล็อกอินอยู่ และปุ่มออกจากระบบ
- **`home/`**: หน้า Landing Page หน้าแรกสุดเมื่อเปิดเว็บ มีปุ่มนำทางเข้าสู่ระบบของนักเรียน/แอดมิน
- **`main/`**: เก็บ layout หลักและ sidebar เมนูแยกตามกลุ่มผู้ใช้:
  - `admin/`: แดชบอร์ดและ layout พร้อม sidebar สำหรับแอดมิน
  - `student/`: หน้าหลักนักเรียน และหน้าทำแบบประเมิน (`evaluation-fill`)
  - `teacher/`: หน้าหลักสำหรับครูผู้สอน
  - `committee/`: หน้าหลักสำหรับคณะกรรมการประเมิน
  - `from/`: หน้าสร้างและจัดการแบบฟอร์มประเมิน
- **`services/`**: จัดการการเรียกใช้ API ไปยัง Backend ด้วย `HttpClient` แยกตามแต่ละฟังก์ชันงาน

---

### รายละเอียดหน้าจอการทำงานใน `src/app/pages/`

ระบบมีหน้าจอการทำงานที่ใช้งานจริง 26 โฟลเดอร์ แบ่งตามโมดูลการทำงานได้ดังนี้:

#### 1. ระบบยืนยันตัวตน (Authentication)

- **`login/`**: หน้านักเรียนเข้าสู่ระบบด้วย Google Sign-In
- **`register/`**: หน้านักเรียนลงทะเบียนเข้าใช้งานใหม่
- **`admin-login/`**: หน้าเข้าสู่ระบบแยกต่างหากสำหรับผู้ดูแลระบบ

#### 2. ฝั่งนักเรียน (Student Portal)

- **`score/`**: หน้าตรวจสอบคะแนนและเกรดรายบุคคลของนักเรียน
- **`edit-profile/`**: หน้ายื่นคำขอแก้ไขข้อมูลส่วนตัว (แก้ไขชื่อ-นามสกุล หรือเปลี่ยนรูปถ่าย) เพื่อส่งให้แอดมินอนุมัติ
- **`student-grade-dialog/`**: Dialog แสดงรายละเอียดคะแนนย่อยของแต่ละวิชา

#### 3. จัดการนักเรียนและหลักสูตร (Student & Course Management)

- **`addstudent/`**: หน้าจัดการข้อมูลนักเรียน สามารถเพิ่มทีละคน หรือคัดลอกจาก Excel ทั้งรุ่น
- **`add-course-dialog/`**: Dialog สำหรับสร้างและแก้ไขข้อมูลหลักสูตร
- **`unit-selection/`**: หน้าเลือกหน่วย
- **`class-overview/`**: หน้าดูภาพรวมจำนวนและรายชื่อนักเรียนในแต่ละรุ่น
- **`admin-profile-approvals/`**: หน้าตรวจสอบและอนุมัติคำขอแก้ไขข้อมูลของนักเรียน (แอดมินตรวจสอบข้อมูลเดิมเทียบข้อมูลใหม่ก่อนกดยืนยัน)

#### 4. จัดการคะแนนและผลการเรียน (Score & Grading)

- **`score-management/`**: หน้าหลักสำหรับบันทึกคะแนน
- **`score-list/`**: หน้ารายการสรุปคะแนนของนักเรียนทั้งหมดในรายวิชา
- **`score-submission/`**: หน้ายืนยันและส่งคะแนนเข้าสู่ระบบ
- **`student-ranking/`**: หน้ารายงานจัดอันดับนักเรียนตามคะแนนเฉลี่ย (เรียงลำดับผลการเรียน)
- **`training-exam-time/`**: หน้าจัดการรอบเวลาฝึกอบรม, เวลาสอบ และคะแนนความประพฤติ (เต็ม 200)

#### 5. เอกสารและใบรับรอง (Certificates & Transcripts)

- **`transcript/`**: *(อยู่ระหว่างการพัฒนา)* หน้าออกใบแสดงผลการเรียน (Transcript) แสดงเกรดเฉลี่ยทุกวิชา จัด Layout ให้พอดีกับหน้ากระดาษ A4 เพื่อสั่งพิมพ์หรือบันทึกเป็น PDF
- **`certificate/`**: *(อยู่ระหว่างการพัฒนา)* หน้าพิมพ์ใบประกาศนียบัตร / เกียรติบัตรจบการศึกษา พร้อมสั่งพิมพ์

#### 6. แบบประเมินและติดตามผล (Evaluation & Follow-up)

- **`form-view/`**: หน้าแสดงตัวอย่างแบบฟอร์มประเมิน
- **`evaluation-summary/`**: หน้าสรุปผลคะแนนการประเมินภาพรวม
- **`follow-up/`**: หน้าแบบประเมินติดตามผลผู้สำเร็จการศึกษา

#### 7. รายงานผลและสถิติ (Reports & Statistics)

- **`training-summary/`**: หน้ารายงานสรุปผลการอบรมภาพรวม
- **`training-results/`**: หน้ารายงานผลการสอบและสถิติการผ่านเกณฑ์
- **`training-statistics/`**: หน้ารายงานสถิติรูปแบบกราฟ (Chart.js)

#### 8. จัดการระบบ (Admin System)

- **`admin-users/`**: จัดการบัญชีผู้ดูแลระบบ (เพิ่ม, แก้ไข, ลบ แอดมิน)
- **`admin-logs/`**: ระบบตรวจสอบประวัติการทำงาน (Audit Logs) บันทึกการแก้ไขข้อมูลในระบบเพื่อความโปร่งใส

---

### รายการ Services (`src/app/services/`)

| Service                         | หน้าที่และการทำงาน                                                          |
| ------------------------------- | --------------------------------------------------------------------------- |
| `auth.service.ts`               | จัดการ Login, Register, Google Sign-In, Logout และบันทึก Token ลงใน Storage |
| `student.service.ts`            | ดึงข้อมูลนักเรียน, เพิ่ม/แก้ไขข้อมูล, คัดลอก Excel นำเข้าข้อมูล            |
| `score.service.ts`              | บันทึกคะแนน, ดึงเกรด, คำนวณอันดับ Ranking, ข้อมูลสำหรับออก Transcript       |
| `course.service.ts`             | จัดการข้อมูลหลักสูตร ภาคเรียน และรายวิชา                                    |
| `dropdown.service.ts`           | ดึงข้อมูลตัวเลือกสำหรับ Dropdown ต่างๆ (เช่น รุ่น, วิชา)                    |
| `general-evaluation.service.ts` | ดึงแบบประเมิน และบันทึกคำตอบการประเมิน                                      |
| `admin-user.service.ts`         | จัดการข้อมูลบัญชีผู้ดูแลระบบ                                                |
| `admin-layout.service.ts`       | จัดการ State ของ Sidebar และเมนูในหน้า Admin                                |

---

### สรุปเส้นทางหน้าเว็บ (Routes ใน `app.routes.ts`)

| URL Path                   | สิทธิ์เข้าถึง | หน้าที่ของหน้าจอ                                |
| -------------------------- | :-----------: | ----------------------------------------------- |
| `/`                        |     ทุกคน     | หน้าแรกของระบบ (Landing Page)                   |
| `/student/login`           |   นักเรียน    | หน้าเข้าสู่ระบบของนักเรียน (ด้วย Google Sign-In) |
| `/student`                 |   นักเรียน    | หน้าหลักนักเรียน (เลือกดูข้อมูลและทำแบบประเมิน) |
| `/student/score`           |   นักเรียน    | หน้าตรวจสอบผลคะแนนและเกรด                       |
| `/student/edit-profile`    |   นักเรียน    | หน้ายื่นคำขอแก้ไขข้อมูลส่วนตัว                  |
| `/admin/login`             |    แอดมิน     | หน้าเข้าสู่ระบบสำหรับแอดมิน                     |
| `/admin`                   |    แอดมิน     | แดชบอร์ดหลักของแอดมิน                           |
| `/admin/addstudent`        |    แอดมิน     | หน้าจัดการนักเรียน                              |
| `/admin/scoremanagement`   |    แอดมิน     | หน้าบันทึกคะแนนและตัดเกรด                       |
| `/admin/student-ranking`   |    แอดมิน     | หน้ารายงานจัดอันดับนักเรียน                     |
| `/admin/transcript`        |    แอดมิน     | หน้าออกใบรายงานผลการเรียน (Transcript) *(อยู่ระหว่างการพัฒนา)* |
| `/admin/certificate`       |    แอดมิน     | หน้าออกใบประกาศนียบัตรจบการศึกษา *(อยู่ระหว่างการพัฒนา)*       |
| `/admin/profile-approvals` |    แอดมิน     | หน้าอนุมัติคำขอแก้ไขข้อมูลนักเรียน              |
| `/admin/logs`              |    แอดมิน     | หน้าตรวจสอบ Audit Logs การใช้งานระบบ            |
| `/teacher`                 |    อาจารย์    | หน้าจอทำงานสำหรับครูผู้สอน                      |
| `/committee`               |  คณะกรรมการ   | หน้าจอทำงานสำหรับคณะกรรมการประเมิน              |

---

## การ Build และ Deploy (Firebase Hosting)

### 1. Build โปรเจกต์

```bash
npm run build
```

ผลลัพธ์ไฟล์ Production จะถูกสร้างไว้ที่โฟลเดอร์: `dist/evaluation/browser`

### 2. Deploy ผ่าน Firebase CLI ด้วยตนเอง

```bash
# ตรวจสอบการ Login กับ Firebase
npx firebase login

# Deploy ไปยัง Firebase Hosting
npx firebase deploy --only hosting
```

### 3. ระบบ CI/CD อัตโนมัติ (GitHub Actions)

ในไฟล์ `.github/workflows/firebase-hosting-merge.yml` มีการตั้งค่าไว้ว่า:

- เมื่อมีการ **Push หรือ Merge เข้า branch `main`** บน GitHub
- GitHub Actions จะรัน `npm install && npm run build` และ Deploy ขึ้น **Firebase Hosting (`signal-school-a82c8`)** ให้อัตโนมัติ

---

## ข้อควรระวังและแนวทางพัฒนาต่อ (Handover Notes)

1. **การสลับ API เป็น Local**:
   - หากต้องการทดสอบกับ Backend ในเครื่อง ให้แก้ค่า `apiUrl` ใน `src/environments/environment.development.ts` เป็น `http://localhost:3000/api`
2. **การจัดการ Routing บน Firebase**:
   - เนื่องจากเว็บเป็น SPA (Single Page Application) ในไฟล์ `firebase.json` มีการตั้งค่า `"rewrites": [{ "source": "**", "destination": "/index.html" }]` ไว้แล้ว เพื่อไม่ให้เกิดข้อผิดพลาด 404 เมื่อ Refresh หน้าเว็บ
3. **การพิมพ์เอกสาร (Transcript & Certificate)**:
   - หน้ารายงานผลการเรียนและใบประกาศนียบัตร ใช้ CSS สำหรับการพิมพ์ (`@media print`) หากต้องการปรับแต่งขนาดกระดาษหรือระยะขอบ ให้ปรับแก้ที่ไฟล์ `.scss` ของหน้านั้นๆ
