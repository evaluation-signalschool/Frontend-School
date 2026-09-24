import { Routes } from '@angular/router';

// =========================================================================
// 1. หน้าแรก (Home / Public)
// =========================================================================
import { Home } from './home/home';

// =========================================================================
// 2. ส่วนของนักเรียน (Student Components)
// =========================================================================
import { Student } from './main/student/student';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { Score } from './pages/score/score';
import { EvaluationFillComponent } from './main/student/evaluation-fill/evaluation-fill.component';

// =========================================================================
// 3. ส่วนของผู้ดูแลระบบ (Admin Components)
// =========================================================================
import { Admin } from './main/admin/admin';
import { AdminLogin } from './pages/admin-login/admin-login';
import { AddCourse } from './pages/add-course-dialog/add-course-dialog';
import { Addstudent } from './pages/addstudent/addstudent';
import { AdminProfileApprovals } from './pages/admin-profile-approvals/admin-profile-approvals';
import { ScoreManagement } from './pages/score-management/score-management';
import { ScoreList } from './pages/score-list/score-list';
import { ScoreSubmission } from './pages/score-submission/score-submission';
import { ClassOverview } from './pages/class-overview/class-overview';
import { StudentRanking } from './pages/student-ranking/student-ranking';
import { From } from './main/from/from';
import { FormView } from './pages/form-view/form-view';
import { Certificate } from './pages/certificate/certificate';
import { Transcript } from './pages/transcript/transcript';
import { NewsManagement } from './main/admin/news-management/news-management';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminLogsComponent } from './pages/admin-logs/admin-logs.component';
import { adminGuard } from './guards/admin.guard';

// =========================================================================
// 4. ส่วนของบทบาทอื่น ๆ (Teacher, Committee, Follow-up)
// =========================================================================
import { Teacher } from './main/teacher/teacher';
import { Committee } from './main/committee/committee';
import { FollowUpComponent } from './pages/follow-up/follow-up';

// =========================================================================
// 5. ส่วนสรุปผลและสถิติภาพรวม (Reports & Summaries)
// =========================================================================
import { TrainingResults } from './pages/training-results/training-results';
import { TrainingStatistics } from './pages/training-statistics/training-statistics';
import { TrainingSummary } from './pages/training-summary/training-summary';
import { EvaluationSummaryComponent } from './pages/evaluation-summary/evaluation-summary';

export const routes: Routes = [
  // =======================================================================
  // หน้าแรก (Home / Public)
  // =======================================================================
  { path: '', component: Home },

  // =======================================================================
  // 1. ส่วนของนักเรียน (Student Routes)
  // =======================================================================
  {
    path: 'student',
    children: [
      { path: '', component: Student },                          // เข้าด้วย /student (หน้าหลักนักเรียน เลือกรุ่น/แบบประเมิน)
      { path: 'login', component: Login },                      // เข้าด้วย /student/login (เข้าสู่ระบบนักเรียน)
      { path: 'register', component: Register },                // เข้าด้วย /student/register (ลงทะเบียนนักเรียน)
      { path: 'edit-profile', component: EditProfile },          // เข้าด้วย /student/edit-profile (ขอแก้ไขข้อมูลส่วนตัว)
      { path: 'score', component: Score },                      // เข้าด้วย /student/score (ดูผลคะแนนนักเรียน)
      { path: 'fill-form', component: EvaluationFillComponent }, // เข้าด้วย /student/fill-form (ทำแบบประเมิน)
    ],
  },

  // =======================================================================
  // 2. ส่วนของแอดมิน (Admin Routes)
  // =======================================================================
  {
    path: 'admin',
    children: [
      { path: 'login', component: AdminLogin }, // เข้าด้วย /admin/login (เข้าสู่ระบบแอดมิน)
      {
        path: '',
        canActivate: [adminGuard],
        children: [
          { path: '', component: Admin }, // เข้าด้วย /admin (แดชบอร์ดหลักแอดมิน)

          // จัดการหลักสูตรและข้อมูลนักเรียน
          { path: 'addcourse', component: AddCourse },
          { path: 'addstudent', component: Addstudent },
          { path: 'profile-approvals', component: AdminProfileApprovals },

          // จัดการคะแนนและชั้นเรียน
          { path: 'scoremanagement', component: ScoreManagement },
          { path: 'ScoreList', component: ScoreList },
          { path: 'score-list', component: ScoreList },
          { path: 'score-submission', component: ScoreSubmission },
          { path: 'classoverview', component: ClassOverview },
          { path: 'ranking', component: StudentRanking },
          { path: 'student-ranking', component: StudentRanking },

          // จัดการแบบฟอร์มประเมินและสรุปผล
          { path: 'form', component: From },
          { path: 'form-view', component: FormView },
          { path: 'training-summary', component: TrainingSummary },

          // เอกสารและใบรับรอง (แอดมินเป็นผู้ออก)
          { path: 'certificate', component: Certificate },
          { path: 'transcript', component: Transcript },

          // จัดการระบบและความปลอดภัย
          { path: 'news-management', component: NewsManagement },
          { path: 'users', component: AdminUsersComponent },
          { path: 'logs', component: AdminLogsComponent },
        ],
      },
    ],
  },

  // =======================================================================
  // 3. ส่วนของครู-อาจารย์ (Teacher Routes)
  // =======================================================================
  {
    path: 'teacher',
    children: [
      { path: '', component: Teacher },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // =======================================================================
  // 4. ส่วนของคณะกำกับหลักสูตร (Committee Routes)
  // =======================================================================
  {
    path: 'committee',
    children: [
      { path: '', component: Committee },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // =======================================================================
  // 5. ส่วนของแบบประเมินติดตามผู้สำเร็จฯ (Follow-Up Routes)
  // =======================================================================
  {
    path: 'follow-up',
    children: [
      { path: '', component: FollowUpComponent },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // =======================================================================
  // 6. สรุปผลและสถิติภาพรวม (Reports & Summaries - Public)
  // =======================================================================
  {
    path: 'training-results',
    children: [
      { path: '', component: TrainingResults },
      { path: 'training-statistics', component: TrainingStatistics },
      { path: 'training-summary', component: TrainingSummary },
    ],
  },
  { path: 'evaluation-summary', component: EvaluationSummaryComponent },

  // =======================================================================
  // 7. Aliases & Backward Compatibility Redirects
  // (รองรับลิงก์เดิมที่เคยเรียกตรง เพื่อไม่ให้ระบบเกิด 404)
  // =======================================================================
  // นักเรียน
  { path: 'register', component: Register },
  { path: 'edit-profile', component: EditProfile },
  { path: 'score', component: Score },

  // แอดมิน (Redirect ไปยังเส้นทางภายใต้ /admin)
  { path: 'transcript', redirectTo: 'admin/transcript', pathMatch: 'full' },
  { path: 'score-submission', redirectTo: 'admin/score-submission', pathMatch: 'full' },

  // =======================================================================
  // กรณีพิมพ์ URL ผิดให้เด้งกลับหน้าแรก
  // =======================================================================
  { path: '**', redirectTo: '' },
];
