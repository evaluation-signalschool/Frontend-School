import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { StudentService } from '../../services/student.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  showPassword = false;
  showConfirmPassword = false;

  // โหมดกรอกข้อมูลเพิ่มเติมหลังจากล็อกอินด้วย Google ครั้งแรก
  isGoogleProfileMode = false;
  studentId = 0;
  googleId = '';
  picture = '';

  formData = {
    rank: '',
    fullName: '',
    affiliation: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  courseId: string | null = null;
  batchId: string | null = null;
  courseName: string | null = null;
  batchName: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.courseId = params['courseId'] || null;
      this.batchId = params['batchId'] || null;
      this.courseName = params['courseName'] || null;
      this.batchName = params['batchName'] || null;

      const studentData = this.authService.getStudentData();
      if (params['completeProfile'] === 'true' || (studentData && !studentData.profile_completed)) {
        this.isGoogleProfileMode = true;
        this.studentId = Number(params['studentId'] || studentData?.student_id || 0);
        this.googleId = params['googleId'] || studentData?.google_id || '';
        this.picture = params['picture'] || studentData?.picture || '';
        this.formData.email = params['email'] || studentData?.email || '';
        const nameFromData = studentData ? `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() : '';
        this.formData.fullName = params['name'] || nameFromData || '';
        this.formData.rank = studentData?.rank_name || '';
        this.formData.affiliation = studentData?.affiliation || '';
        this.formData.phone = studentData?.phone || '';
        if (!this.courseName && studentData?.course_name) {
          this.courseName = studentData.course_name;
        }
        if (!this.batchName && studentData?.batch_name) {
          this.batchName = studentData.batch_name;
        }
        if (!this.batchId && studentData?.batch_id) {
          this.batchId = String(studentData.batch_id);
        }
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onCancel(): void {
    if (this.isGoogleProfileMode) {
      Swal.fire({
        title: 'ยกเลิกการกรอกข้อมูล?',
        text: 'หากยกเลิก ข้อมูลจะไม่ถูกบันทึกในระบบ และคุณจะกลับไปที่หน้าเข้าสู่ระบบ',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ใช่, ยกเลิก',
        cancelButtonText: 'กรอกข้อมูลต่อ',
      }).then((result) => {
        if (result.isConfirmed) {
          // หากมี studentId ค้างในระบบที่ profile_completed = 0 ให้ลบทิ้งเพื่อไม่ให้เปลืองพื้นที่
          if (this.studentId && this.studentId > 0) {
            this.authService.cancelStudentGoogleLogin(this.studentId).subscribe({
              next: () => {},
              error: () => {},
            });
          }
          this.authService.logout();
          this.router.navigate(['/student/login']);
        }
      });
    } else {
      this.router.navigate(['/student/login']);
    }
  }

  onBack(): void {
    this.onCancel();
  }

  // --- Real-time Input Controls ---

  // 1. ช่องยศ: ห้ามพิมพ์ตัวเลข (0-9, ๐-๙) และเครื่องหมาย @
  onRankKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length > 1) {
      return;
    }
    if (/[0-9\u0E50-\u0E59@]/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const allowed = /^[a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E.\s-]$/;
    if (!allowed.test(event.key)) {
      event.preventDefault();
    }
  }

  onRankInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value
      .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E.\s-]/g, '')
      .replace(/[0-9\u0E50-\u0E59@]/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
    this.formData.rank = cleaned;
  }

  onRankModelChange(val: string): void {
    const cleaned = (val || '')
      .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E.\s-]/g, '')
      .replace(/[0-9\u0E50-\u0E59@]/g, '');
    if (this.formData.rank !== cleaned) {
      this.formData.rank = cleaned;
    }
  }

  onRankPaste(event: ClipboardEvent): void {
    const paste = event.clipboardData?.getData('text') || '';
    if (/[0-9\u0E50-\u0E59@]/.test(paste)) {
      event.preventDefault();
      const cleaned = paste
        .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E.\s-]/g, '')
        .replace(/[0-9\u0E50-\u0E59@]/g, '');
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const val = input.value;
      const nextVal = val.slice(0, start) + cleaned + val.slice(end);
      input.value = nextVal;
      this.formData.rank = nextVal;
    }
  }

  // 2. ช่องชื่อ-นามสกุล: ห้ามพิมพ์ตัวเลข (0-9, ๐-๙) และสัญลักษณ์ @
  onFullNameKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey || event.key.length > 1) {
      return;
    }
    if (/[0-9\u0E50-\u0E59@]/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const allowed = /^[a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s.'-]$/;
    if (!allowed.test(event.key)) {
      event.preventDefault();
    }
  }

  onFullNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value
      .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s.'-]/g, '')
      .replace(/[0-9\u0E50-\u0E59@]/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
    this.formData.fullName = cleaned;
  }

  onFullNameModelChange(val: string): void {
    const cleaned = (val || '')
      .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s.'-]/g, '')
      .replace(/[0-9\u0E50-\u0E59@]/g, '');
    if (this.formData.fullName !== cleaned) {
      this.formData.fullName = cleaned;
    }
  }

  onFullNamePaste(event: ClipboardEvent): void {
    const paste = event.clipboardData?.getData('text') || '';
    if (/[0-9\u0E50-\u0E59@]/.test(paste)) {
      event.preventDefault();
      const cleaned = paste
        .replace(/[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s.'-]/g, '')
        .replace(/[0-9\u0E50-\u0E59@]/g, '');
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const val = input.value;
      const nextVal = val.slice(0, start) + cleaned + val.slice(end);
      input.value = nextVal;
      this.formData.fullName = nextVal;
    }
  }

  // 3. ช่องรหัสผ่าน: ห้ามกดเว้นวรรค (Spacebar) ทุกกรณี
  preventSpace(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space' || event.keyCode === 32 || event.which === 32) {
      event.preventDefault();
    }
  }

  onPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/\s/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
    this.formData.password = cleaned;
  }

  onPasswordModelChange(val: string): void {
    const cleaned = (val || '').replace(/\s/g, '');
    if (this.formData.password !== cleaned) {
      this.formData.password = cleaned;
    }
  }

  onConfirmPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/\s/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
    this.formData.confirmPassword = cleaned;
  }

  onConfirmPasswordModelChange(val: string): void {
    const cleaned = (val || '').replace(/\s/g, '');
    if (this.formData.confirmPassword !== cleaned) {
      this.formData.confirmPassword = cleaned;
    }
  }

  onPasswordPaste(event: ClipboardEvent, field: 'password' | 'confirmPassword'): void {
    const paste = event.clipboardData?.getData('text') || '';
    if (/\s/.test(paste)) {
      event.preventDefault();
      const cleaned = paste.replace(/\s/g, '');
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const val = input.value;
      const nextVal = val.slice(0, start) + cleaned + val.slice(end);
      input.value = nextVal;
      if (field === 'password') {
        this.formData.password = nextVal;
      } else {
        this.formData.confirmPassword = nextVal;
      }
    }
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
    }
    this.formData.phone = cleaned;
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    // โหมดที่ 1: กรอกข้อมูลส่วนตัวหลังจากการเข้าสู่ระบบผ่าน Google ครั้งแรก
    if (this.isGoogleProfileMode) {
      if (!this.formData.fullName || !this.formData.rank || !this.formData.affiliation || !this.formData.phone) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลไม่ครบถ้วน',
          text: 'กรุณากรอกยศ, ชื่อ-สกุล, หน่วยต้นสังกัด และเบอร์โทรศัพท์ให้ครบถ้วน',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8E73FF'
        });
        return;
      }

      // ตรวจสอบยศ: ห้ามมีตัวเลข หรือเครื่องหมาย @
      if (/[0-9\u0E50-\u0E59]/.test(this.formData.rank) || this.formData.rank.includes('@')) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลยศไม่ถูกต้อง',
          text: 'ช่องยศต้องไม่มีตัวเลขหรือเครื่องหมาย @',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8E73FF'
        });
        return;
      }

      // ตรวจสอบชื่อ-นามสกุล: ห้ามมีตัวเลข หรือเครื่องหมาย @
      if (/[0-9\u0E50-\u0E59]/.test(this.formData.fullName) || this.formData.fullName.includes('@')) {
        Swal.fire({
          icon: 'warning',
          title: 'ข้อมูลชื่อ-สกุลไม่ถูกต้อง',
          text: 'ช่องชื่อ-สกุลต้องไม่มีตัวเลขหรือสัญลักษณ์พิเศษ',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8E73FF'
        });
        return;
      }

      const cleanedPhone = this.formData.phone.replace(/[^0-9]/g, '');
      if (cleanedPhone.length < 9 || cleanedPhone.length > 10) {
        Swal.fire({
          icon: 'warning',
          title: 'เบอร์โทรศัพท์ไม่ถูกต้อง',
          text: 'กรุณาระบุเบอร์โทรศัพท์ 9-10 หลัก',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#8E73FF'
        });
        return;
      }

      const parts = this.formData.fullName.trim().split(/\s+/);
      let firstName = this.formData.fullName.trim();
      let lastName = '';
      if (parts.length >= 2) {
        lastName = parts.pop() || '';
        firstName = parts.join(' ');
      }

      const studentId = this.studentId || this.authService.getStudentData()?.student_id || 0;

      this.authService.completeStudentProfile({
        student_id: Number(studentId),
        batch_id: Number(this.batchId || 0),
        rank_name: this.formData.rank.trim(),
        first_name: firstName,
        last_name: lastName,
        affiliation: this.formData.affiliation.trim(),
        phone: cleanedPhone,
        email: this.formData.email.trim(),
        google_id: this.googleId,
        picture: this.picture,
      }).subscribe({
        next: (res) => {
          if (res.success && res.studentData) {
            const student = res.studentData;
            if (res.token) {
              this.authService.saveToken(res.token);
            }
            if (this.courseName && (!student.course_name || student.course_name === '-')) {
              student.course_name = this.courseName;
            }
            if (this.batchName && (!student.batch_name || student.batch_name === '-')) {
              student.batch_name = this.batchName;
            }
            this.authService.saveStudentData(student);

            Swal.fire({
              icon: 'success',
              title: 'บันทึกข้อมูลเรียบร้อยแล้ว!',
              text: 'ระบบกำลังนำคุณเข้าสู่หน้าหลัก...',
              timer: 1600,
              showConfirmButton: false
            }).then(() => {
              const batchId = student.batch_id || this.batchId;
              const courseName = student.course_name || this.courseName || '';
              const batchName = student.batch_name || this.batchName || '';
              const title = (courseName && batchName) ? `${courseName} ${batchName}` : '';

              this.router.navigate(['/student'], {
                queryParams: {
                  batchId: batchId,
                  title: title,
                  courseName: courseName,
                  batchName: batchName,
                },
              });
            });
          }
        },
        error: (err) => {
          const errMsg = err.error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง';
          Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถบันทึกข้อมูลได้',
            text: errMsg,
            confirmButtonColor: '#8E73FF'
          });
        }
      });
      return;
    }

    // โหมดที่ 2: การลงทะเบียนแบบดั้งเดิม (เผื่อใช้งาน)
    if (!this.formData.fullName || !this.formData.affiliation || !this.formData.phone || !this.formData.email || !this.formData.password || !this.formData.confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วน รวมถึงยืนยันรหัสผ่าน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF' // สีม่วงให้เข้ากับธีม
      });
      return;
    }

    // ตรวจสอบยศ: ห้ามมีตัวเลข หรือเครื่องหมาย @
    if (this.formData.rank && (/[0-9\u0E50-\u0E59]/.test(this.formData.rank) || this.formData.rank.includes('@'))) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลยศไม่ถูกต้อง',
        text: 'ช่องยศต้องไม่มีตัวเลขหรือเครื่องหมาย @',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF'
      });
      return;
    }

    // ตรวจสอบชื่อ-นามสกุล: ห้ามมีตัวเลข หรือเครื่องหมาย @
    if (/[0-9\u0E50-\u0E59]/.test(this.formData.fullName) || this.formData.fullName.includes('@')) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลชื่อ-สกุลไม่ถูกต้อง',
        text: 'ช่องชื่อ-สกุลต้องไม่มีตัวเลขหรือสัญลักษณ์พิเศษ',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF'
      });
      return;
    }

    // ตรวจสอบรหัสผ่าน: ห้ามมีช่องว่าง/เว้นวรรค
    if (/\s/.test(this.formData.password) || /\s/.test(this.formData.confirmPassword)) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านไม่ถูกต้อง',
        text: 'รหัสผ่านต้องไม่มีการเว้นวรรค (ช่องว่าง)',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF'
      });
      return;
    }

    // ตรวจสอบความยาวรหัสผ่าน
    if (this.formData.password.length < 4) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านสั้นเกินไป',
        text: 'กรุณาตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF'
      });
      return;
    }

    // ตรวจสอบว่ารหัสผ่านและยืนยันรหัสผ่านตรงกันหรือไม่
    if (this.formData.password !== this.formData.confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#8E73FF'
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

    // ตรวจสอบว่ามีรุ่น (batchId) หรือไม่
    if (!this.batchId) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบข้อมูลรุ่น/หลักสูตร',
        text: 'กรุณาเลือกรุ่นที่ต้องการลงทะเบียนจากหน้านักเรียนก่อนเข้าสู่ฟอร์มนี้',
        confirmButtonText: 'ไปหน้านักเรียน',
        confirmButtonColor: '#8E73FF'
      }).then(() => {
        this.router.navigate(['/student']);
      });
      return;
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
