import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { StudentService } from '../../services/student.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  showPassword = false;

  formData = {
    rank: '',
    fullName: '',
    affiliation: '',
    phone: '',
    email: '',
    password: ''
  };

  courseId: string | null = null;
  batchId: string | null = null;
  courseName: string | null = null;
  batchName: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.courseId = params['courseId'] || null;
      this.batchId = params['batchId'] || null;
      this.courseName = params['courseName'] || null;
      this.batchName = params['batchName'] || null;
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onBack(): void {
    this.router.navigate(['/']); // กลับไปหน้าแรก
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    
    // ตรวจสอบว่ามีข้อมูลว่างหรือไม่
    if (!this.formData.fullName || !this.formData.affiliation || !this.formData.phone || !this.formData.email || !this.formData.password) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF' // สีม่วงให้เข้ากับธีม
      });
      return;
    }

    console.log('Submit clicked for Course:', this.courseName, 'Batch:', this.batchName);
    console.log('Payload:', this.formData);
    
    // แยกชื่อ-สกุล
    const parts = this.formData.fullName.trim().split(/\s+/);
    let firstName = this.formData.fullName;
    let lastName = '';
    if (parts.length >= 2) {
      lastName = parts.pop() || '';
      firstName = parts.join(' ');
    }

    const studentData = {
      batch_id: this.batchId,
      rank_name: this.formData.rank,
      first_name: firstName,
      last_name: lastName,
      password: this.formData.password,
      affiliation: this.formData.affiliation,
      phone: this.formData.phone,
      email: this.formData.email
    };

    this.studentService.addStudent(studentData).subscribe({
      next: (res) => {
        if (res.message) {
          Swal.fire({
            icon: 'success',
            title: 'ลงทะเบียนสำเร็จ!',
            text: 'ระบบได้บันทึกข้อมูลของคุณเรียบร้อยแล้ว',
            confirmButtonText: 'เข้าสู่ระบบ',
            confirmButtonColor: '#8E73FF'
          }).then(() => {
            // ไปหน้าเข้าสู่ระบบ พร้อมส่ง query params
            this.router.navigate(['/student/login'], {
              queryParams: {
                batchId: this.batchId,
                title: `${this.courseName} ${this.batchName}`,
                courseName: this.courseName,
                batchName: this.batchName
              }
            });
          });
        }
      },
      error: (err) => {
        console.error('Register error:', err);
        const errMsg = err.error?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน โปรดลองอีกครั้ง';
        Swal.fire({
          icon: 'error',
          title: 'ลงทะเบียนไม่สำเร็จ',
          text: errMsg,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  onGoogleLogin(): void {
    console.log('Google Login clicked');
  }
}
