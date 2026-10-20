import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { CourseService } from '../../services/course.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    FormsModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, AfterViewInit {
  isLoading: boolean = false;
  errorMessage: string = '';
  batchId: number = 0;

  loginTitle: string = '';
  loginCourseName: string = '';
  loginBatchName: string = '';

  // รายการรุ่นสำหรับกรณีที่ไม่ได้ส่ง batchId มาทาง URL
  availableBatches: any[] = [];
  selectedBatch: any = null;

  // สถานะว่า Google GIS Render แล้วหรือไม่ (เพื่อไม่ให้แสดงปุ่มซ้ำซ้อน)
  gisRendered: boolean = false;



  constructor(
    private authService: AuthService,
    private courseService: CourseService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['batchId']) {
        this.batchId = Number(params['batchId']);
      }
      if (params['title']) {
        this.loginTitle = params['title'];
      }
      if (params['courseName']) {
        this.loginCourseName = params['courseName'];
      }
      if (params['batchName']) {
        this.loginBatchName = params['batchName'];
      }

      if (!this.batchId) {
        this.loadAvailableBatches();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  /**
   * โหลดรายการรุ่นที่มีในระบบ เผื่อกรณีที่นักเรียนเข้าหน้านี้โดยตรงโดยไม่ได้เลือกรุ่นจากเมนู
   */
  loadAvailableBatches(): void {
    this.courseService.getAllBatches().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.availableBatches = res.data.filter((b: any) => b.batch_name);
          if (this.availableBatches.length > 0 && !this.batchId) {
            this.onSelectBatch(this.availableBatches[0]);
          }
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Error loading batches:', err),
    });
  }

  onSelectBatch(batch: any): void {
    if (!batch) return;
    this.batchId = Number(batch.id);
    this.loginBatchName = batch.batch_name;
    this.loginCourseName = batch.course_name || '';
    this.loginTitle = `${this.loginCourseName} ${this.loginBatchName}`.trim();
    this.cdr.detectChanges();
  }

  /**
   * เริ่มต้น Google Identity Services (GIS)
   */
  initGoogleSignIn(): void {
    const clientId = environment.googleClientId;
    if (!clientId) {
      console.warn('Google Client ID not configured in environment');
      return;
    }

    const checkGoogleInterval = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts?.id) {
        clearInterval(checkGoogleInterval);
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: any) => this.onGoogleCredentialResponse(response),
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          const btnContainer = document.getElementById('googleGisBtn');
          if (btnContainer) {
            btnContainer.innerHTML = '';
            google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'continue_with',
              logo_alignment: 'left',
              width: 280,
            });
            this.gisRendered = true;
            this.cdr.detectChanges();
          }
        } catch (e) {
          console.error('Failed to initialize Google Sign-In:', e);
        }
      }
    }, 200);

    // หยุดเช็คหลังจาก 5 วินาที
    setTimeout(() => clearInterval(checkGoogleInterval), 5000);
  }

  /**
   * เมื่อคลิกปุ่ม Google แบบ Custom ที่เราออกแบบให้สวยงาม
   */
  triggerGoogleSignIn(): void {
    if (!this.batchId) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือกรุ่น',
        text: 'กรุณาเลือกรุ่น/หลักสูตรที่ต้องการเข้าสู่ระบบก่อนดำเนินการ',
        confirmButtonColor: '#7e22ce',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    if (typeof google !== 'undefined' && google.accounts?.id) {
      try {
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // ถ้า Google One Tap ไม่เปิด (เช่น โดนบล็อก หรือไม่มี active session) ให้ลองเปิด prompt ใหม่
            console.log('Google prompt not displayed/skipped');
          }
        });
      } catch (err) {
        console.warn('Google prompt error:', err);
      }
    } else {
      Swal.fire({
        icon: 'info',
        title: 'กำลังเชื่อมต่อ Google...',
        text: 'หากปุ่ม Google ยังไม่แสดง กรุณารอสักครู่หรือใช้โหมดทดสอบ',
        confirmButtonColor: '#7e22ce',
      });
    }
  }

  /**
   * ได้รับ Credential จาก Google Identity Services
   */
  onGoogleCredentialResponse(response: any): void {
    if (!response || !response.credential) {
      this.errorMessage = 'ไม่ได้รับข้อมูลยืนยันตัวตนจาก Google';
      return;
    }

    let email = '';
    let name = '';
    let googleId = '';
    let picture = '';

    try {
      const parts = response.credential.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1]))));
        email = payload.email || '';
        name = payload.name || '';
        googleId = payload.sub || '';
        picture = payload.picture || '';
      }
    } catch (e) {
      console.warn('Could not parse Google ID token client-side:', e);
    }

    this.executeGoogleLogin({
      credential: response.credential,
      email,
      name,
      google_id: googleId,
      picture,
    });
  }

  /**
   * ส่งข้อมูลล็อกอิน Google ไปยังเซิร์ฟเวอร์
   */
  executeGoogleLogin(userData: {
    credential?: string;
    email: string;
    name: string;
    google_id?: string;
    picture?: string;
  }): void {
    if (!this.batchId) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือกรุ่น',
        text: 'กรุณาเลือกรุ่น/หลักสูตรที่ต้องการเข้าสู่ระบบก่อนดำเนินการ',
        confirmButtonColor: '#7e22ce',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const payload = {
      credential: userData.credential,
      batch_id: this.batchId,
      google_id: userData.google_id,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
    };

    this.authService.studentGoogleLogin(payload).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (res.success) {
            // เติมข้อมูลหลักสูตรและรุ่นถ้าขาด
            if (res.studentData) {
              if (this.loginCourseName && (!res.studentData.course_name || res.studentData.course_name === '-')) {
                res.studentData.course_name = this.loginCourseName;
              }
              if (this.loginBatchName && (!res.studentData.batch_name || res.studentData.batch_name === '-')) {
                res.studentData.batch_name = this.loginBatchName;
              }
            }

            if (res.isProfileComplete && res.token && res.studentData) {
              const student = res.studentData;
              // หากกรอกข้อมูลครบถ้วนแล้ว ให้บันทึก Token และข้อมูล แล้วนำทางเข้าสู่หน้านักเรียน (หน้าหลัก)
              this.authService.saveToken(res.token);
              this.authService.saveStudentData(student);

              Swal.fire({
                icon: 'success',
                title: 'เข้าสู่ระบบสำเร็จ!',
                text: `ยินดีต้อนรับ ${student.rank_name || ''}${student.first_name} ${student.last_name || ''}`,
                timer: 1600,
                showConfirmButton: false,
              }).then(() => {
                const batchId = student.batch_id || this.batchId;
                const courseName = student.course_name || this.loginCourseName || '';
                const batchName = student.batch_name || this.loginBatchName || '';
                const title = (courseName && batchName) ? `${courseName} ${batchName}` : (this.loginTitle || '');

                this.router.navigate(['/student'], {
                  queryParams: {
                    batchId: batchId,
                    title: title,
                    courseName: courseName,
                    batchName: batchName,
                  },
                });
              });
            } else {
              // สำหรับการเข้าสู่ระบบครั้งแรก หรือข้อมูลยังไม่ครบ ให้นำทางไปยังหน้ากรอกข้อมูล
              // อย่าเพิ่งถือว่าล็อกอินเสร็จสมบูรณ์ และอย่าเพิ่งบันทึก Token
              this.authService.logout();

              const studentData = res.studentData;
              const email = studentData?.email || userData.email || '';
              const fullName = studentData
                ? `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim()
                : userData.name;
              const googleId = studentData?.google_id || userData.google_id || '';
              const picture = studentData?.picture || userData.picture || '';
              const studentId = studentData?.student_id || 0;

              // บันทึก studentData ชั่วคราวเพื่อให้หน้า register นำไปแสดงผล
              if (studentData) {
                this.authService.saveStudentData(studentData);
              }

              Swal.fire({
                icon: 'info',
                title: 'เข้าสู่ระบบด้วย Google สำเร็จ',
                text: 'กรุณากรอกข้อมูลส่วนตัวเพื่อเริ่มใช้งาน (ระบบจะบันทึกข้อมูลเมื่อกดยืนยันในหน้านี้)',
                confirmButtonColor: '#7e22ce',
                confirmButtonText: 'กรอกข้อมูลส่วนตัว',
              }).then(() => {
                this.router.navigate(['/student/register'], {
                  queryParams: {
                    completeProfile: 'true',
                    batchId: this.batchId,
                    courseName: this.loginCourseName,
                    batchName: this.loginBatchName,
                    email: email,
                    name: fullName,
                    googleId: googleId,
                    picture: picture,
                    studentId: studentId,
                  },
                });
              });
            }
          } else {
            this.errorMessage = res.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ';
            Swal.fire({
              icon: 'error',
              title: 'เข้าสู่ระบบไม่สำเร็จ',
              text: this.errorMessage,
              confirmButtonColor: '#7e22ce',
            });
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          const msg =
            err.error?.message ||
            'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
          this.errorMessage = msg;
          console.error('Google login error:', err);
          Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            text: msg,
            confirmButtonColor: '#7e22ce',
          });
          this.cdr.detectChanges();
        });
      },
    });
  }
}

