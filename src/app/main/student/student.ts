import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { RouterLink, ActivatedRoute, Router } from '@angular/router'; // นำเข้า Router สำหรับการเปลี่ยนเส้นทางหน้าเว็บ
import { ScoreService } from '../../services/score.service';
import { SubjectService } from '../../services/subject.service';
import { CourseService } from '../../services/course.service';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

// สร้าง Interface สำหรับ Card เพื่อให้ผูกข้อมูลกับ HTML ได้ง่ายขึ้น
interface CourseCard {
  id: number;
  text: string;
  status: string; // เช่น 'pending', 'completed' ไว้เปลี่ยนสีจุด status-dot
  formUrl?: string;
}

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink ],
  templateUrl: './student.html',
  styleUrl: './student.scss',
})
export class Student implements OnInit, OnDestroy {
  pageTitle: string = 'กำลังโหลดข้อมูล...'; // ตัวแปรสำหรับเก็บชื่อหัวข้อหลักของหน้า
  selectedAssessment: string = '';
  currentBatchId: number | null = null;
  currentCourseName: string = '';
  currentBatchName: string = '';
  isLoggedIn: boolean = false;
  studentData: any = null;
  private evaluationSub: Subscription | null = null;

  // เก็บข้อมูลรายวิชาทั้งหมดที่ดึงมาจาก API
  allCourses: CourseCard[] = [];

  // เก็บข้อมูลรายวิชาที่จะนำไปแสดงผล (หลังจากค้นหาหรือกรองแล้ว)
  filteredCourses: CourseCard[] = [];

  constructor(
    private subjectService: SubjectService,
    private generalEvaluationService: GeneralEvaluationService,
    private scoreService: ScoreService,
    private authService: AuthService,
    private courseService: CourseService,
    private route: ActivatedRoute, 
    private router: Router, // บริการนำทางเส้นทางหน้าเว็บ
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    if (this.evaluationSub) {
      this.evaluationSub.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();

    if (this.isLoggedIn) {
      this.studentData = this.authService.getStudentData();
      if (this.studentData) {
        this.currentBatchId = this.studentData.batch_id;
        this.currentCourseName = this.studentData.course_name || '';
        this.currentBatchName = this.studentData.batch_name || '';
        
        if (this.currentCourseName && this.currentBatchName) {
           this.pageTitle = `${this.currentCourseName} ${this.currentBatchName}`;
        }
        
        if (this.currentBatchId) {
          this.fetchSubjects(this.currentBatchId);
        }
      }
    }

    // ติดตามการเปลี่ยนแปลงของพารามิเตอร์บน URL
    this.route.queryParams.subscribe((params) => {
      const batchId = params['batchId'];
      const title = params['title'];
      const courseName = params['courseName'];
      const batchName = params['batchName'];

      if (this.isLoggedIn && batchId) {
        const studentData = this.authService.getStudentData();
        if (studentData && studentData.batch_id !== Number(batchId)) {
          // หากเปลี่ยนรุ่นใน Header ให้ทำการ Logout ออกอัตโนมัติ
          this.authService.logout();
          this.isLoggedIn = false;
          this.allCourses = [];
          this.filteredCourses = [];
          this.selectedAssessment = '';
        }
      }

      if (!this.isLoggedIn) {
        if (title) this.pageTitle = title;
        if (courseName) this.currentCourseName = courseName;
        if (batchName) this.currentBatchName = batchName;
        if (batchId) this.currentBatchId = Number(batchId);
      } else {
        this.studentData = this.authService.getStudentData();
        if (this.studentData) {
          this.currentBatchId = this.studentData.batch_id;
          this.currentCourseName = this.studentData.course_name || courseName || '';
          this.currentBatchName = this.studentData.batch_name || batchName || '';
          if (title) {
            this.pageTitle = title;
          } else if (this.currentCourseName && this.currentBatchName) {
            this.pageTitle = `${this.currentCourseName} ${this.currentBatchName}`;
          }
          if (this.currentBatchId && this.allCourses.length === 0) {
            this.fetchSubjects(this.currentBatchId);
          }
        }
      }
    });
  }

  fetchSubjects(batchId: number): void {
    // เคลียร์ข้อมูลเก่าออกก่อนทุกครั้งที่ดึงข้อมูลรุ่นใหม่
    this.allCourses = [];
    this.filteredCourses = [];
    this.selectedAssessment = '';

    const studentData = this.authService.getStudentData();
    if (!studentData) return;

    this.scoreService.getStudentScores(studentData.student_id, batchId).subscribe({
      next: (res) => {
        if (res.subject_details) {
          this.allCourses = res.subject_details.map((subject: any) => ({
            id: subject.subject_id || 0,
            text: subject.subject_name || 'ไม่มีชื่อวิชา',
            status: subject.is_evaluated ? 'green' : 'red', // green = ประเมินแล้ว, red = ยังไม่ประเมิน
            formUrl: '',
          }));
        }
      },
      error: (err) => {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลรายวิชา:', err);
      },
    });
  }

  // ทำงานเมื่อผู้ใช้เลือกประเภทแบบประเมินใน Dropdown
  onAssessmentChange(event: any): void {
    this.selectedAssessment = event.target.value;

    // ยกเลิก Request เดิมถ้ามีการกดรัวๆ (Race condition)
    if (this.evaluationSub) {
      this.evaluationSub.unsubscribe();
    }

    // value "1" คือ "ประเมินอาจารย์ผู้สอน"
    if (this.selectedAssessment === '1') {
      // นำข้อมูลวิชาทั้งหมดมาแสดง
      this.filteredCourses = [...this.allCourses];
    } else if (this.selectedAssessment === '2' || this.selectedAssessment === '3') {
      const type = this.selectedAssessment === '2' ? 'director' : 'course';
      const titleText = this.selectedAssessment === '2' ? 'แบบประเมินอาจารย์กำกับหลักสูตร' : 'แบบประเมินหลักสูตร';
      
      // เคลียร์หน้าจอให้เป็นช่องว่างก่อนโหลดข้อมูลใหม่
      this.filteredCourses = [];

      if (this.currentBatchId) {
        this.evaluationSub = this.generalEvaluationService.getGeneralEvaluations(this.currentBatchId, type, 'student').subscribe({
          next: (res) => {
            let url = '';
            if (res.success && res.data && res.data.length > 0) {
              url = res.data[0].form_url;
            }

            // แสดงการ์ด 1 ใบเสมอ เพื่อให้ผู้ใช้เห็นว่ามีหัวข้อนี้ แต่ลิงก์อาจจะว่างเปล่า
            this.filteredCourses = [{
              id: 0,
              text: titleText,
              status: 'pending',
              formUrl: url,
            }];
            this.cdr.detectChanges(); // อัปเดตการแสดงผลหน้าจอทันที
          },
          error: (err) => {
            console.error('เกิดข้อผิดพลาดในการดึงข้อมูลแบบประเมิน:', err);
            // ถ้า Error ก็ยังแสดงการ์ด แต่ไม่มีลิงก์
            this.filteredCourses = [{
              id: 0,
              text: titleText,
              status: 'pending',
              formUrl: '',
            }];
            this.cdr.detectChanges(); // อัปเดตการแสดงผลหน้าจอทันที
          }
        });
      }
    } else {
      // ถ้าเลือกข้ออื่น สามารถเพิ่มเงื่อนไข หรือเคลียร์การ์ดทิ้งก่อนได้
      this.filteredCourses = [];
    }
  }

  // ทำงานเมื่อผู้ใช้พิมพ์ค้นหารายวิชาในช่อง Search
  onSearch(event: any): void {
    const searchTerm = event.target.value.toLowerCase();

    // กรองข้อมูลเฉพาะตอนที่เลือก "ประเมินอาจารย์ผู้สอน" อยู่เท่านั้น
    if (this.selectedAssessment === '1') {
      this.filteredCourses = this.allCourses.filter((course) =>
        course.text.toLowerCase().includes(searchTerm),
      );
    }
  }

  // ทำงานเมื่อกดคลิกที่ Card รายวิชา
  openForm(course: CourseCard): void {
    if (course.status === 'green') {
      Swal.fire({
        icon: 'info',
        title: 'แจ้งเตือน',
        text: 'คุณได้ทำแบบประเมินนี้ไปแล้ว',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    // กำหนดประเภทการประเมินจาก selectedAssessment
    let typeStr = 'instructor';
    if (this.selectedAssessment === '2') typeStr = 'director';
    if (this.selectedAssessment === '3') typeStr = 'course';

    // เปลี่ยนหน้าไปทำแบบประเมินในระบบ
    this.router.navigate(['/student/fill-form'], {
      queryParams: {
        batchId: this.currentBatchId,
        subjectId: course.id,
        type: typeStr,
        courseTitle: course.text,
        batchName: this.currentBatchName // ส่งชื่อรุ่นปัจจุบันไปด้วย
      }
    });
  }

  goToScore(): void {
    this.router.navigate(['/student/score']);
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.allCourses = [];
    this.filteredCourses = [];
    this.selectedAssessment = '';
    this.studentData = null;

    // เด้งไปหน้า Login อัตโนมัติพร้อมส่งข้อมูลรุ่นไปด้วย
    this.router.navigate(['/student/login'], { 
      queryParams: { 
        batchId: this.currentBatchId, 
        title: this.pageTitle,
        courseName: this.currentCourseName,
        batchName: this.currentBatchName
      } 
    });
  }

  goToEditProfile(): void {
    this.router.navigate(['/student/edit-profile']);
  }
}
