import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Student } from './main/student/student';
import { Login } from './pages/login/login';
import { Score } from './pages/score/score';
import { Teacher } from './main/teacher/teacher';
import { Admin } from './main/admin/admin';
import { ScoreManagement } from './pages/score-management/score-management';
import { From } from './main/from/from';
import { ScoreList } from './pages/score-list/score-list';
import { ClassOverview } from './pages/class-overview/class-overview';
import { AdminLogin } from './pages/admin-login/admin-login';
import { Addstudent } from './pages/addstudent/addstudent';
import { TrainingSummary } from './pages/training-summary/training-summary';
import { Register } from './pages/register/register';
import { ScoreSubmission } from './pages/score-submission/score-submission';
import { EvaluationSummaryComponent } from './pages/evaluation-summary/evaluation-summary';
import { FollowUpComponent } from './pages/follow-up/follow-up';
import { Committee } from './main/committee/committee';

import { AddCourse } from './pages/add-course-dialog/add-course-dialog';
import { FormView } from './pages/form-view/form-view';

import { EvaluationFillComponent } from './main/student/evaluation-fill/evaluation-fill.component';

import { Certificate } from './pages/certificate/certificate';
import { EditProfile } from './pages/edit-profile/edit-profile';
import { AdminProfileApprovals } from './pages/admin-profile-approvals/admin-profile-approvals';
import { NewsManagement } from './main/admin/news-management/news-management';
import { StudentRanking } from './pages/student-ranking/student-ranking';
import { AdminUsersComponent } from './pages/admin-users/admin-users.component';
import { AdminLogsComponent } from './pages/admin-logs/admin-logs.component';

export const routes: Routes = [
  // หน้าแรก
  { path: '', component: Home },

  // ส่วนของนักเรียน
  {
    path: 'student',
    children: [
      { path: '', component: Student }, // เข้าด้วย /student
      { path: 'login', component: Login }, // เข้าด้วย /student/login
      { path: 'fill-form', component: EvaluationFillComponent }, // เข้าด้วย /student/fill-form
      { path: 'score', component: Score }, // เข้าด้วย /student/score
    ],
  },
  // สรุปผลและสถิติการฝึกอบรม
  {
    path: 'training-results',
    children: [
      { path: '', component: TrainingSummary },
      { path: 'training-statistics', component: TrainingSummary },
      { path: 'training-summary', component: TrainingSummary },
    ],
  },

  // ส่วนของครู
  {
    path: 'teacher',
    children: [
      { path: '', component: Teacher },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // ส่วนของคณะกำกับหลักสูตร
  {
    path: 'committee',
    children: [
      { path: '', component: Committee },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // ส่วนของแบบประเมินติดตามผู้สำเร็จฯ
  {
    path: 'follow-up',
    children: [
      { path: '', component: FollowUpComponent },
      { path: 'fill-form', component: EvaluationFillComponent },
    ],
  },

  // ส่วนของแอดมิน
  {
    path: 'admin',
    children: [
      { path: '', component: Admin }, // เข้าด้วย /admin
      { path: 'login', component: AdminLogin }, // เข้าด้วย /admin/login
      { path: 'scoremanagement', component: ScoreManagement },
      { path: 'ScoreList', component: ScoreList },
      { path: 'form', component: From },
      { path: 'classoverview', component: ClassOverview },
      { path: 'addstudent', component: Addstudent },
      { path: 'addcourse', component: AddCourse },
      {path:'score-submission',component: ScoreSubmission},
      { path: 'form-view', component: FormView },
      { path: 'certificate', component: Certificate },
      { path: 'profile-approvals', component: AdminProfileApprovals },
      { path: 'news-management', component: NewsManagement },
      { path: 'training-summary', component: TrainingSummary },
      { path: 'ranking', component: StudentRanking },
      { path: 'student-ranking', component: StudentRanking },
      { path: 'users', component: AdminUsersComponent },
      { path: 'logs', component: AdminLogsComponent },
    ],
  },

  { path: 'register', component: Register },

  {path:'edit-profile',component: EditProfile},


  // ส่วนของคะแนน (ทั่วไป)
  { path: 'score', component: Score },
  { path: 'score-submission', component: ScoreSubmission },

  // หน้าใหม่ที่เพิ่มเข้ามา
  { path: 'evaluation-summary', component: EvaluationSummaryComponent },

  // กรณีพิมพ์ URL ผิดให้เด้งกลับหน้าแรก
  { path: '**', redirectTo: '' },
];
