import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { StudentService } from '../../services/student.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [MatIconModule, CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
})
export class EditProfile implements OnInit {
  editForm: FormGroup;
  selectedFile: File | null = null;
  fileName: string = '';
  
  hasSubmittedRequest: boolean = false;
  requestStatus: string = '';
  studentData: any = null;
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  
  showConfirmModal: boolean = false;

  constructor(
    private location: Location,
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef
  ) {
    this.editForm = this.fb.group({
      docType: [''],
      rank: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required]
    });
  }


  ngOnInit(): void {
    this.studentData = this.authService.getStudentData();
    if (!this.studentData) {
      this.location.back();
      return;
    }
    
    // Set initial values
    this.editForm.patchValue({
      rank: this.studentData.rank_name || '',
      firstName: this.studentData.first_name || '',
      lastName: this.studentData.last_name || ''
    });
    
    this.checkStatus();
  }
  
  checkStatus(): void {
    this.isLoading = true;
    this.studentService.getProfileEditStatus(this.studentData.student_id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.hasRequest) {
          this.requestStatus = res.request.status; // 'pending', 'approved', 'rejected'
          if (this.requestStatus === 'pending' || this.requestStatus === 'approved') {
            this.hasSubmittedRequest = true;
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn("Could not check edit status:", err);
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (err.status === 401 || err.status === 403) {
          Swal.fire({
            icon: 'warning',
            title: 'เซสชันหมดอายุ',
            text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อความปลอดภัย',
            confirmButtonText: 'เข้าสู่ระบบ',
            confirmButtonColor: '#5c41e2'
          }).then(() => {
            this.authService.logout();
            this.router.navigate(['/']);
          });
        }
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Check file size (5MB = 5 * 1024 * 1024)
      if (file.size > 5242880) {
        Swal.fire('ขนาดไฟล์เกินกำหนด', 'กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 5MB', 'error');
        event.target.value = null;
        return;
      }
      this.selectedFile = file;
      this.fileName = file.name;
    }
  }
  
  setDocType(type: string): void {
    this.editForm.patchValue({ docType: type });
  }
  
  validateForm(): boolean {
    const rank = (this.editForm.value.rank || '').trim();
    const firstName = (this.editForm.value.firstName || '').trim();
    const lastName = (this.editForm.value.lastName || '').trim();

    // 1. ตรวจสอบการเว้นว่างช่องชื่อ-นามสกุล / ยศ
    if (!rank) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกยศ / คำนำหน้า',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    if (!firstName || !lastName) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อ-นามสกุล',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    // 2. ตรวจสอบตัวเลข (ห้ามมีตัวเลขทั้งใน ยศ, ชื่อ, นามสกุล)
    const numberRegex = /[0-9\u0E50-\u0E59]/;
    if (numberRegex.test(rank)) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'ยศต้องเป็นตัวอักษรเท่านั้น ห้ามใส่ตัวเลข',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    if (numberRegex.test(firstName) || numberRegex.test(lastName)) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'ชื่อ-นามสกุลต้องเป็นตัวอักษรเท่านั้น ห้ามใส่ตัวเลข',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    // 3. ตรวจสอบอักขระพิเศษ (ห้ามมีสัญลักษณ์พิเศษ)
    // สำหรับยศ: อนุญาตเฉพาะตัวอักษรไทย-อังกฤษ จุด ช่องว่าง วงเล็บ และขีด เช่น ร้อยตำรวจเอก (ร.ต.อ.)
    const rankSpecialCharRegex = /[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s.()\-]/;
    if (rankSpecialCharRegex.test(rank)) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'ยศต้องไม่มีอักขระพิเศษ',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    // สำหรับชื่อ-นามสกุล: อนุญาตเฉพาะตัวอักษรไทย-อังกฤษ และช่องว่าง
    const nameSpecialCharRegex = /[^a-zA-Z\u0E01-\u0E3A\u0E40-\u0E4E\s]/;
    if (nameSpecialCharRegex.test(firstName) || nameSpecialCharRegex.test(lastName)) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'ชื่อ-นามสกุลต้องไม่มีอักขระพิเศษ',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    // 4. ตรวจสอบการแนบไฟล์กรณีเปลี่ยนยศ
    const originalRank = (this.studentData?.rank_name || '').trim();
    const docType = this.editForm.value.docType;
    const isRankChanged = (rank !== originalRank || docType === 'change-rank');

    if (isRankChanged && !this.selectedFile) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณาแนบไฟล์เอกสารยืนยันการเลื่อนยศ',
        confirmButtonText: 'ตกลง'
      });
      return false;
    }

    return true;
  }

  openConfirmModal(): void {
    if (!this.validateForm()) {
      return;
    }
    this.showConfirmModal = true;
  }
  
  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }

  submitForm(): void {
    if (!this.validateForm()) {
      return;
    }
    
    this.isSubmitting = true;
    
    const formData = new FormData();
    formData.append('student_id', this.studentData.student_id.toString());
    formData.append('new_rank', (this.editForm.value.rank || '').trim());
    formData.append('new_first_name', (this.editForm.value.firstName || '').trim());
    formData.append('new_last_name', (this.editForm.value.lastName || '').trim());
    
    if (this.selectedFile) {
      formData.append('document', this.selectedFile);
    }
    
    this.studentService.submitProfileEditRequest(formData).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.showConfirmModal = false;
        this.hasSubmittedRequest = true;
        this.requestStatus = 'pending';
        this.cdr.detectChanges();
        Swal.fire('สำเร็จ', 'ส่งคำร้องขอแก้ไขข้อมูลเรียบร้อยแล้ว รอผู้ดูแลระบบตรวจสอบ', 'success');
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showConfirmModal = false;
        this.cdr.detectChanges();
        Swal.fire('เกิดข้อผิดพลาด', err.error?.message || 'ไม่สามารถส่งคำร้องได้', 'error');
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
