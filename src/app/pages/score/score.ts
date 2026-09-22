import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService, StudentData } from '../../services/auth.service';
import { ScoreService, SubjectDetail, GroupSummary } from '../../services/score.service';
import { timeout, TimeoutError } from 'rxjs';

@Component({
  selector: 'app-score',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './score.html',
  styleUrl: './score.scss',
})
export class Score implements OnInit {
  studentData: StudentData | null = null;
  subjectDetails: SubjectDetail[] = [];
  groupSummaries: GroupSummary[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';

  // ลบตัวแปรจัดกลุ่มออก เนื่องจากเราจะแสดงรายวิชาทั้งหมดในตารางเดียว

  constructor(
    private authService: AuthService,
    private scoreService: ScoreService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/student/login']);
      return;
    }

    this.studentData = this.authService.getStudentData();

    if (this.studentData) {
      this.loadScores(this.studentData.student_id, this.studentData.batch_id);
    }
  }

  loadScores(studentId: number, batchId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.scoreService
      .getStudentScores(studentId, batchId)
      .pipe(
        timeout(30000), // หมดเวลา 30 วินาที
      )
      .subscribe({
        next: (res) => {
          this.subjectDetails = res.subject_details || [];
          this.groupSummaries = res.group_summaries || [];
          // ไม่ต้องจัดกลุ่มแล้ว
          this.isLoading = false;
          setTimeout(() => this.cdr.detectChanges());
        },
        error: (err) => {
          this.isLoading = false;
          if (err instanceof TimeoutError) {
            this.errorMessage = 'เซิร์ฟเวอร์ใช้เวลานานเกินไป (Server cold start) กรุณากด ลองใหม่';
          } else {
            this.errorMessage = 'ไม่สามารถดึงข้อมูลคะแนนได้ กรุณาลองใหม่อีกครั้ง';
          }
          console.error('ดึงข้อมูลคะแนนไม่สำเร็จ:', err);
          setTimeout(() => this.cdr.detectChanges());
        },
      });
  }

  goToEvaluation(subjectId: number) {
    this.router.navigate(['/student/fill-form'], { 
      queryParams: { 
        subjectId: subjectId,
        batchId: this.studentData?.batch_id,
        batchName: this.studentData?.batch_name,
        courseTitle: this.studentData?.course_name,
        type: 'instructor' 
      } 
    });
  }

  goBack(): void {
    const batchId = this.studentData?.batch_id || '';
    const courseName = this.studentData?.course_name || '';
    const batchName = this.studentData?.batch_name || '';
    const title = (courseName && batchName) ? `${courseName} ${batchName}` : '';
    
    this.router.navigate(['/student'], { 
      queryParams: { 
        batchId: batchId, 
        title: title,
        courseName: courseName,
        batchName: batchName
      } 
    });
  }

  onLogout(): void {
    const batchId = this.studentData?.batch_id || '';
    const courseName = this.studentData?.course_name || '';
    const batchName = this.studentData?.batch_name || '';
    const title = (courseName && batchName) ? `${courseName} ${batchName}` : '';
    
    this.authService.logout();
    this.router.navigate(['/student/login'], { 
      queryParams: { 
        batchId: batchId, 
        title: title,
        courseName: courseName,
        batchName: batchName
      } 
    });
  }
}
