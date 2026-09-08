import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Location, CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { StudentService } from '../../services/student.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [MatIconModule, CommonModule, ReactiveFormsModule],
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
    private fb: FormBuilder,
    private authService: AuthService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef
  ) {
    this.editForm = this.fb.group({
      docType: [''],
      rank: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      confirmPassword: ['']
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
        console.error("Error checking status", err);
        this.isLoading = false;
        this.cdr.detectChanges();
        
        // Show warning if API fails (e.g. backend not deployed)
        Swal.fire({
          icon: 'error',
          title: 'ข้อผิดพลาดการเชื่อมต่อ',
          text: 'ไม่สามารถโหลดข้อมูลสถานะการแก้ไขโปรไฟล์ได้ (API อาจจะยังไม่ได้อัปเดต หรือ เซิร์ฟเวอร์มีปัญหา)'
        });
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
  
  openConfirmModal(): void {
    if (this.editForm.invalid) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอก ยศ ชื่อ และนามสกุล ให้ครบถ้วน', 'warning');
      return;
    }
    
    const originalRank = this.studentData.rank_name || '';
    const newRank = this.editForm.value.rank;
    if (originalRank !== newRank && !this.selectedFile) {
      Swal.fire('ข้อมูลไม่ครบถ้วน', 'เนื่องจากคุณมีการเปลี่ยนยศ กรุณาแนบไฟล์เอกสารหลักฐานด้วยครับ', 'warning');
      return;
    }

    this.showConfirmModal = true;
  }
  
  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.editForm.patchValue({ confirmPassword: '' });
  }

  submitForm(): void {
    if (this.editForm.invalid) return;
    
    const originalRank = this.studentData.rank_name || '';
    const newRank = this.editForm.value.rank;
    if (originalRank !== newRank && !this.selectedFile) {
       return;
    }
    
    // In a real app we'd verify the password here. For this demo we'll assume it's correct if provided.
    // Assuming backend endpoint /student-login verifies, but we can skip strong auth for this edit unless required.
    // The user's backend doesn't currently require password for this, but we'll send the request anyway.
    
    this.isSubmitting = true;
    
    const formData = new FormData();
    formData.append('student_id', this.studentData.student_id.toString());
    formData.append('new_rank', this.editForm.value.rank);
    formData.append('new_first_name', this.editForm.value.firstName);
    formData.append('new_last_name', this.editForm.value.lastName);
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
