import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import Swal from 'sweetalert2';
import { lastValueFrom } from 'rxjs';

interface CourseBatch {
  id: number;
  name: string;
  status: 'active' | 'ended';
  isVisible: boolean;
}

@Component({
  selector: 'app-add-course',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './add-course-dialog.html',
  styleUrl: './add-course-dialog.scss',
})
export class AddCourse implements OnInit {
  
  // Data lists from DB
  courses: any[] = [];
  batches: any[] = [];
  groups: any[] = [];
  
  // Form states
  showCoursesTable: boolean = false;
  showGroupsTable: boolean = false;
  showSubjectsTable: boolean = false;
  courseForm = { course_name: '', curriculum_year: null };
  
  // Cascading states for Batch Form
  selectedCourseNameForBatch: string = '';
  batchForm = { course_id: '', batch_name: '', start_date: '', end_date: '' };
  
  // Cascading states for Group Form
  selectedCourseNameForGroup: string = '';
  selectedCourseIdForGroup: string = '';
  selectedBatchForGroup: string = '';
  groupsList: { group_name: string, credits: number | null }[] = [{ group_name: '', credits: null }];
  
  // Cascading states for Subject Form
  selectedCourseNameForSubject: string = '';
  selectedCourseIdForSubject: string = '';
  selectedBatchForSubject: string = '';
  subjectForm = { group_id: '' };
  subjectsList: { subject_name: string, is_su: boolean }[] = [{ subject_name: '', is_su: false }];
  subjectsInGroup: any[] = [];
  isLoadingSubjects: boolean = false;

  constructor(
    private location: Location, 
    private courseService: CourseService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData() {
    this.courseService.getAllCourses().subscribe({
      next: (res) => { 
        if(res.success) {
          this.courses = res.data;
          this.cdr.detectChanges(); // บังคับอัปเดต UI ทันที
        }
      },
      error: (err) => console.error(err)
    });
    this.courseService.getAllBatches().subscribe({
      next: (res) => { 
        if(res.success) {
          this.batches = res.data;
          this.cdr.detectChanges(); // บังคับให้ UI อัปเดตทันที
        }
      },
      error: (err) => console.error(err)
    });
    this.courseService.getAllSubjectGroups().subscribe({
      next: (res) => { 
        if(res.success) {
          this.groups = res.data; 
          this.cdr.detectChanges(); // บังคับให้ UI อัปเดตทันที
        }
      },
      error: (err) => console.error(err)
    });
  }

  // Helpers for Course Names
  getUniqueCourseNames(): string[] {
    const names = this.courses.map(c => c.course_name);
    return Array.from(new Set(names));
  }

  getCoursesByName(name: string): any[] {
    if (!name) return [];
    return this.courses.filter(c => c.course_name === name);
  }

  // Get batches for the selected course name (for the manage batches table)
  getBatchesForSelectedCourseName(): any[] {
    if (!this.selectedCourseNameForBatch) return [];
    const matchingCourses = this.getCoursesByName(this.selectedCourseNameForBatch);
    const courseIds = matchingCourses.map(c => c.id);
    
    return this.batches
      .filter(b => courseIds.includes(b.course_id))
      .map(b => {
        const course = matchingCourses.find(c => c.id === b.course_id);
        return {
          ...b,
          curriculum_year: course ? course.curriculum_year : '-'
        };
      });
  }

  onToggleRegistration(batch: any, event: Event): void {
    const input = event.target as HTMLInputElement;

    // Call API to toggle registration
    batch.is_registration_open = input.checked;
    this.courseService.toggleRegistration(batch.id, input.checked).subscribe({
      next: (res) => {
        if (!res.success) {
          batch.is_registration_open = !input.checked;
          input.checked = batch.is_registration_open;
          alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะเปิดรับสมัคร');
        } else {
          this.loadAllData();
          Swal.fire({
            icon: 'success',
            title: 'อัปเดตสถานะรับสมัครสำเร็จ',
            text: 'เปิด/ปิดรับสมัครเรียบร้อยแล้ว',
            timer: 2000,
            showConfirmButton: false
          });
        }
      },
      error: (err) => {
        batch.is_registration_open = !input.checked;
        input.checked = batch.is_registration_open;
        alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      }
    });
  }

  // TrackBy function to prevent *ngFor from recreating DOM elements continuously
  trackByBatchId(index: number, batch: any): any {
    return batch.id;
  }

  // Filter methods for cascading dropdowns
  getBatchesForCourse(courseId: string) {
    if (!courseId) return [];
    return this.batches.filter((b: any) => b.course_id.toString() === courseId.toString());
  }

  getGroupsForBatch(batchId: string) {
    if (!batchId) return [];
    return this.groups.filter((g: any) => g.batch_id.toString() === batchId.toString());
  }

  toThaiDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    let thaiYear = d.getFullYear();
    // ถ้าปีน้อยกว่า 2500 แปลว่าเป็น ค.ศ. ให้บวก 543
    if (thaiYear < 2500) {
      thaiYear += 543;
    }
    return `${day}/${month}/${thaiYear}`;
  }

  onClose(): void {
    this.location.back();
  }

  onSubmitCourse() {
    this.courseService.addCourse(this.courseForm).subscribe({
      next: (res) => {
        Swal.fire('สำเร็จ!', 'เพิ่มหลักสูตรเรียบร้อยแล้ว', 'success');
        this.courseForm = { course_name: '', curriculum_year: null };
        this.loadAllData(); // reload
      },
      error: (err) => {
        Swal.fire('เกิดข้อผิดพลาด!', 'ไม่สามารถเพิ่มหลักสูตรได้', 'error');
        console.error(err);
      }
    });
  }

  onSubmitBatch() {
    const normalizeName = (name: string) => name.replace(/รุ่นที่|รุ่น|ที่|\s/g, '').toLowerCase();

    const isDuplicate = this.batches.some(
      (b: any) => b.course_id == this.batchForm.course_id && 
                  normalizeName(b.batch_name) === normalizeName(this.batchForm.batch_name)
    );

    if (isDuplicate) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลซ้ำ!',
        text: 'มีชื่อรุ่นนี้ในหลักสูตรที่เลือกแล้ว กรุณาใช้ชื่ออื่น',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ff9800'
      });
      return;
    }

    this.courseService.addBatch(this.batchForm).subscribe({
      next: (res) => {
        Swal.fire('สำเร็จ!', 'เพิ่มรุ่นเรียบร้อยแล้ว', 'success');
        this.batchForm = { course_id: '', batch_name: '', start_date: '', end_date: '' };
        this.selectedCourseNameForBatch = '';
        this.loadAllData();
      },
      error: (err) => {
        Swal.fire('เกิดข้อผิดพลาด!', 'ไม่สามารถเพิ่มรุ่นได้', 'error');
        console.error(err);
      }
    });
  }

  addGroupField() {
    // Smart auto-increment
    const lastGroup = this.groupsList[this.groupsList.length - 1];
    let newName = '';
    let newCredits = lastGroup.credits;

    if (lastGroup.group_name) {
      // Find numbers at the end of the string
      const match = lastGroup.group_name.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const num = parseInt(numStr, 10);
        const nextNum = num + 1;
        // Pad with leading zeros if original had them
        const nextNumStr = nextNum.toString().padStart(numStr.length, '0');
        newName = prefix + nextNumStr;
      }
    }

    this.groupsList.push({ group_name: newName, credits: newCredits });
  }

  removeGroupField(index: number) {
    if (this.groupsList.length > 1) {
      this.groupsList.splice(index, 1);
    }
  }

  async onSubmitSubjectGroup() {
    if (!this.selectedBatchForGroup) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกรุ่น', 'warning');
      return;
    }

    const validGroups = this.groupsList.filter(g => g.group_name.trim() !== '');
    if (validGroups.length === 0) {
      Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อกลุ่มวิชาอย่างน้อย 1 กลุ่ม', 'warning');
      return;
    }

    // Pattern Validation: ต้องขึ้นต้นด้วย M, MN, S, P ตามด้วยตัวเลขเท่านั้น
    const pattern = /^(M|MN|S|P)\d+$/i;
    for (const g of validGroups) {
      const gName = g.group_name.trim().toUpperCase();
      if (!pattern.test(gName)) {
        Swal.fire(
          'รูปแบบชื่อกลุ่มวิชาไม่ถูกต้อง', 
          `กลุ่มวิชา "<b>${g.group_name}</b>" ไม่ตรงตามรูปแบบที่กำหนด<br><br><span style="font-size: 14px; color: #666;">ต้องขึ้นต้นด้วยตัวอักษร <b>M, MN, S, หรือ P</b> และตามด้วยตัวเลขเท่านั้น<br>ตัวอย่างเช่น: M01, MN02, S05, P10</span>`, 
          'warning'
        );
        return;
      }
      // อัปเดตให้เป็นตัวพิมพ์ใหญ่ทั้งหมดเพื่อความสม่ำเสมอในฐานข้อมูล
      g.group_name = gName;
      
      // ป้องกันหน่วยกิตติดลบ
      if (g.credits !== null && g.credits < 0) {
        Swal.fire('แจ้งเตือน', `หน่วยกิตของกลุ่มวิชา "${g.group_name}" ต้องไม่ติดลบ (ต่ำสุดคือ 0)`, 'warning');
        return;
      }
    }

    try {
      const promises = validGroups.map(g => 
        lastValueFrom(this.courseService.addSubjectGroup({
          batch_id: this.selectedBatchForGroup,
          group_name: g.group_name,
          credits: g.credits
        }))
      );

      await Promise.all(promises);

      Swal.fire('สำเร็จ!', `เพิ่มกลุ่มวิชาทั้งหมด ${validGroups.length} กลุ่ม เรียบร้อยแล้ว`, 'success');
      this.groupsList = [{ group_name: '', credits: null }];
      // Do not clear the selected course/batch so the user can see the updated table
      this.loadAllData();
      
    } catch (err: any) {
      const msg = err?.error?.message || 'ไม่สามารถเพิ่มกลุ่มวิชาได้บางส่วน';
      Swal.fire('เกิดข้อผิดพลาด!', msg, 'error');
      console.error(err);
    }
  }

  addSubjectField() {
    this.subjectsList.push({ subject_name: '', is_su: false });
  }

  removeSubjectField(index: number) {
    if (this.subjectsList.length > 1) {
      this.subjectsList.splice(index, 1);
    }
  }

  async onSubmitSubject() {
    if (!this.subjectForm.group_id) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกกลุ่มวิชา', 'warning');
      return;
    }

    const validSubjects = this.subjectsList.filter(s => s.subject_name.trim() !== '');
    if (validSubjects.length === 0) {
      Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อรายวิชาอย่างน้อย 1 วิชา', 'warning');
      return;
    }

    try {
      // ยิง API วนลูปทีละวิชา หรือพร้อมกัน
      const promises = validSubjects.map(s => 
        lastValueFrom(this.courseService.addSubject({
          group_id: this.subjectForm.group_id,
          subject_name: s.subject_name,
          is_su: s.is_su,
        }))
      );

      await Promise.all(promises);

      Swal.fire('สำเร็จ!', `เพิ่มรายวิชาทั้งหมด ${validSubjects.length} วิชา เรียบร้อยแล้ว`, 'success');
      this.subjectsList = [{ subject_name: '', is_su: false }];
      // Do not clear the selected course/batch/group so the user can see the updated table
      this.onGroupChange(); // Reload the table
      
    } catch (err: any) {
      const msg = err?.error?.message || 'ไม่สามารถเพิ่มรายวิชาได้บางส่วน';
      Swal.fire('เกิดข้อผิดพลาด!', msg, 'error');
      console.error(err);
    }
  }

  // คำนวณจำนวนรุ่นที่เปิดใช้งานอยู่
  getActiveBatchCount(): number {
    return this.getBatchesForSelectedCourseName().filter(b => b.is_active).length;
  }

  // ฟังก์ชันเช็กสวิตช์ Toggle (ล็อกไม่ให้เปิดเกิน 3 รุ่น)
  onToggleBatch(batch: any, event: Event): void {
    const input = event.target as HTMLInputElement;

    // ถ้ากำลังจะ "เปิด" สวิตช์เพิ่ม และตอนนี้เปิดครบ 3 รุ่นแล้ว
    if (input.checked && this.getActiveBatchCount() >= 3) {
      alert('⚠️ สามารถแสดงผลหน้าเว็บได้สูงสุดเพียง 3 รุ่นเท่านั้น');
      // ย้อนกลับค่าเดิมทันที
      input.checked = false;
      return;
    }

    // Call API to toggle
    batch.is_active = input.checked;
    this.courseService.toggleBatchActive(batch.id, input.checked).subscribe({
      next: (res) => {
        if (!res.success) {
          batch.is_active = !input.checked;
          input.checked = batch.is_active;
          alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
        } else {
          // แจ้งให้ parent component โหลดข้อมูล courses ใหม่ เพื่อให้อัพเดทใน header ด้วย (ถ้ามี event emitter)
          // หรือโหลด batches ใหม่
          this.loadAllData();
          Swal.fire({
            icon: 'success',
            title: 'อัปเดตสถานะการแสดงผลสำเร็จ',
            text: 'การเปลี่ยนแปลงจะแสดงที่แถบเมนูด้านบนหลังจากโหลดหน้าใหม่',
            timer: 2000,
            showConfirmButton: false
          });
        }
      },
      error: (err) => {
        batch.is_active = !input.checked;
        input.checked = batch.is_active;
        console.error(err);
        alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
      }
    });
  }

  getGroupLabel(g: any): string {
    const nameUpper = (g.group_name || '').toUpperCase();
    let type = '';
    if (nameUpper.startsWith('MN')) type = 'วิชารอง';
    else if (nameUpper.startsWith('M')) type = 'วิชาหลัก';
    else if (nameUpper.startsWith('S')) type = 'วิชาประกอบ';
    else if (nameUpper.startsWith('P')) type = 'ภาคปฏิบัติ';
    
    let label = g.group_name;
    if (type) {
      label += ` (${type})`;
    }
    if (g.credits) {
      label += ` - ${g.credits} หน่วยกิต`;
    }
    return label;
  }

  getGroupBadgeClass(groupName: string): string {
    const nameUpper = (groupName || '').toUpperCase();
    if (nameUpper.startsWith('MN')) return 'badge badge-red';
    if (nameUpper.startsWith('M')) return 'badge badge-yellow';
    if (nameUpper.startsWith('S')) return 'badge badge-blue';
    if (nameUpper.startsWith('P')) return 'badge badge-white';
    return 'badge';
  }

  getGroupColor(groupName: string): string {
    const nameUpper = (groupName || '').toUpperCase();
    if (nameUpper.startsWith('MN')) return '#d32f2f'; // Red
    if (nameUpper.startsWith('M')) return '#f57f17'; // Yellow/Orange
    if (nameUpper.startsWith('S')) return '#1976d2'; // Blue
    if (nameUpper.startsWith('P')) return '#616161'; // Gray
    return '#333333';
  }

  // ==========================================
  // จัดการรุ่น (Edit / Delete)
  // ==========================================
  editBatch(batch: any) {
    const startDate = batch.start_date ? batch.start_date.split('T')[0] : '';
    const endDate = batch.end_date ? batch.end_date.split('T')[0] : '';

    Swal.fire({
      title: 'แก้ไขข้อมูลรุ่น',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left; margin-top: 10px;">
          <label style="font-size: 14px; color: #555;">ปีการศึกษา</label>
          <input class="swal2-input" value="${batch.curriculum_year || '-'}" style="margin: 0; width: 100%; box-sizing: border-box; background-color: #f5f5f5;" disabled>
          
          <label style="font-size: 14px; color: #555; margin-top: 8px;">ชื่อรุ่น</label>
          <input id="swal-batch-name" class="swal2-input" placeholder="ชื่อรุ่น" value="${batch.batch_name || ''}" style="margin: 0; width: 100%; box-sizing: border-box;">
          
          <label style="font-size: 14px; color: #555; margin-top: 8px;">วันที่เริ่มต้น</label>
          <input type="date" id="swal-start-date" class="swal2-input" value="${startDate}" style="margin: 0; width: 100%; box-sizing: border-box;">
          
          <label style="font-size: 14px; color: #555; margin-top: 8px;">วันที่สิ้นสุด</label>
          <input type="date" id="swal-end-date" class="swal2-input" value="${endDate}" style="margin: 0; width: 100%; box-sizing: border-box;">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#673ab7',
      preConfirm: () => {
        const name = (document.getElementById('swal-batch-name') as HTMLInputElement).value;
        const start = (document.getElementById('swal-start-date') as HTMLInputElement).value;
        const end = (document.getElementById('swal-end-date') as HTMLInputElement).value;
        
        if (!name.trim()) {
          Swal.showValidationMessage('กรุณากรอกชื่อรุ่น');
          return false;
        }
        return { batch_name: name, start_date: start, end_date: end };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.courseService.updateBatch(batch.id, result.value).subscribe({
          next: (res) => {
            if (res.success) {
              Swal.fire({
                icon: 'success',
                title: 'สำเร็จ!',
                text: 'แก้ไขข้อมูลรุ่นเรียบร้อยแล้ว',
                timer: 1500,
                showConfirmButton: false
              });
              this.loadAllData();
            } else {
              Swal.fire('ข้อผิดพลาด', res.message, 'error');
            }
          },
          error: (err) => {
            console.error('Error updating batch:', err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
          }
        });
      }
    });
  }

  deleteBatch(batch: any) {
    const adminData = this.authService.getAdminData();
    if (!adminData || !adminData.email) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
      return;
    }

    Swal.fire({
      title: '⚠️ ยืนยันสิทธิ์',
      text: 'กรุณากรอกรหัสผ่านแอดมินเพื่อยืนยันการลบรุ่น',
      input: 'password',
      inputPlaceholder: 'รหัสผ่านแอดมิน',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      showLoaderOnConfirm: true,
      preConfirm: (password) => {
        if (!password) {
          Swal.showValidationMessage('กรุณากรอกรหัสผ่าน');
          return false;
        }
        return lastValueFrom(this.authService.adminLogin({ email: adminData.email, password }))
          .then(res => {
            if (!res.success) throw new Error(res.message);
            return true;
          })
          .catch(error => {
            Swal.showValidationMessage(`รหัสผ่านไม่ถูกต้อง`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((authResult) => {
      if (authResult.isConfirmed) {
        Swal.fire({
          title: '⚠️ ลบรุ่นอย่างถาวร?',
      html: `
        <p style="color: #d32f2f; margin-bottom: 8px; text-align: left;">
          การลบรุ่น "${batch.batch_name}" จะส่งผลให้ข้อมูลต่อไปนี้ถูก <b>ลบทิ้งอย่างถาวร</b>:
        </p>
        <ul style="color: #d32f2f; text-align: left; font-size: 14px; padding-left: 24px; margin-top: 0;">
          <li>รายชื่อนักเรียนทั้งหมดในรุ่นนี้</li>
          <li>คะแนนทั้งหมดของนักเรียนในรุ่นนี้</li>
          <li>แบบฟอร์มประเมินที่ผูกกับรุ่นนี้</li>
          <li>กลุ่มวิชาและรายวิชาทั้งหมดของรุ่นนี้</li>
        </ul>
        <p style="text-align: left; font-weight: bold; margin-top: 16px;">
          คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด?
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบเลย!',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d32f2f',
      cancelButtonColor: '#9e9e9e',
    }).then((result) => {
      if (result.isConfirmed) {
        this.courseService.deleteBatch(batch.id).subscribe({
          next: (res) => {
            if (res.success) {
              Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ!',
                text: 'ลบรุ่นและข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว',
                timer: 1500,
                showConfirmButton: false
              });
              // Reset some fields if the deleted batch was selected
              if (this.batchForm.course_id === batch.id) this.batchForm.course_id = '';
              if (this.selectedCourseIdForGroup === batch.id) this.selectedCourseIdForGroup = '';
              if (this.selectedBatchForSubject === batch.id) this.selectedBatchForSubject = '';
              
              this.loadAllData();
            } else {
              Swal.fire('ข้อผิดพลาด', res.message, 'error');
            }
          },
          error: (err) => {
            console.error('Error deleting batch:', err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
          }
        });
      }
    });
      }
    });
  }

  // ==========================================
  // จัดการหลักสูตร (Delete)
  // ==========================================
  trackByCourseId(index: number, course: any): any {
    return course.id;
  }

  deleteCourse(course: any) {
    const adminData = this.authService.getAdminData();
    if (!adminData || !adminData.email) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
      return;
    }

    Swal.fire({
      title: '⚠️ ยืนยันสิทธิ์',
      text: 'กรุณากรอกรหัสผ่านแอดมินเพื่อยืนยันการลบหลักสูตร',
      input: 'password',
      inputPlaceholder: 'รหัสผ่านแอดมิน',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      showLoaderOnConfirm: true,
      preConfirm: (password) => {
        if (!password) {
          Swal.showValidationMessage('กรุณากรอกรหัสผ่าน');
          return false;
        }
        return lastValueFrom(this.authService.adminLogin({ email: adminData.email, password }))
          .then(res => {
            if (!res.success) throw new Error(res.message);
            return true;
          })
          .catch(error => {
            Swal.showValidationMessage(`รหัสผ่านไม่ถูกต้อง`);
          });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((authResult) => {
      if (authResult.isConfirmed) {
        Swal.fire({
          title: '⚠️ ลบหลักสูตรอย่างถาวร?',
      html: `
        <p style="color: #d32f2f; margin-bottom: 8px; text-align: left;">
          การลบหลักสูตร "<b>${course.course_name} (ปี ${course.curriculum_year})</b>" จะส่งผลให้ข้อมูลต่อไปนี้ถูก <b>ลบทิ้งอย่างถาวร</b>:
        </p>
        <ul style="color: #d32f2f; text-align: left; font-size: 14px; padding-left: 24px; margin-top: 0;">
          <li><b>รุ่น (Batches)</b> ทั้งหมดที่อยู่ในหลักสูตรนี้</li>
          <li><b>กลุ่มวิชาและรายวิชา</b> ทั้งหมดในทุกรุ่นของหลักสูตรนี้</li>
          <li><b>รายชื่อนักเรียนและคะแนน</b> ทั้งหมดในทุกรุ่นของหลักสูตรนี้</li>
          <li>แบบฟอร์มประเมินที่ผูกกับหลักสูตรนี้</li>
        </ul>
        <p style="text-align: left; font-weight: bold; margin-top: 16px;">
          คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดอย่างถาวร?
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบเลย!',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d32f2f',
      cancelButtonColor: '#9e9e9e',
    }).then((result) => {
      if (result.isConfirmed) {
        this.courseService.deleteCourse(course.id).subscribe({
          next: (res) => {
            if (res.success) {
              Swal.fire({
                icon: 'success',
                title: 'ลบสำเร็จ!',
                text: 'ลบหลักสูตรและข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว',
                timer: 1500,
                showConfirmButton: false
              });
              
              // Reset some fields if the deleted course was selected
              if (this.selectedCourseNameForBatch === course.course_name) this.selectedCourseNameForBatch = '';
              if (this.selectedCourseNameForGroup === course.course_name) this.selectedCourseNameForGroup = '';
              if (this.selectedCourseNameForSubject === course.course_name) this.selectedCourseNameForSubject = '';
              
              this.loadAllData();
            } else {
              Swal.fire('ข้อผิดพลาด', res.message, 'error');
            }
          },
          error: (err) => {
            console.error('Error deleting course:', err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
          }
        });
      }
    });
      }
    });
  }

  // ==========================================
  // จัดการกลุ่มวิชาและรายวิชา (Delete)
  // ==========================================

  async deleteSubjectGroup(group: any) {
    try {
      const res = await lastValueFrom(this.courseService.checkGroupScores(group.id));
      const hasScores = res.hasScores;

      const adminData = this.authService.getAdminData();
      if (!adminData || !adminData.email) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
        return;
      }

      let confirmHtml = `คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่มวิชา "<b>${group.group_name}</b>"?`;
      if (hasScores) {
        confirmHtml = `<p style="color: #d32f2f; margin-bottom: 8px; text-align: left; font-weight: bold;">⚠️ มีการกรอกคะแนนแล้ว!</p>
                       <p style="color: #d32f2f; margin-bottom: 8px; text-align: left;">หากลบ คะแนนทั้งหมดของนักเรียนในกลุ่มวิชานี้จะ<b>หายไปอย่างถาวร</b></p>
                       ${confirmHtml}`;
      }

      Swal.fire({
        title: '⚠️ ยืนยันสิทธิ์ลบกลุ่มวิชา',
        text: 'กรุณากรอกรหัสผ่านแอดมินเพื่อยืนยันการลบ',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านแอดมิน',
        inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        showLoaderOnConfirm: true,
        preConfirm: (password) => {
          if (!password) {
            Swal.showValidationMessage('กรุณากรอกรหัสผ่าน');
            return false;
          }
          return lastValueFrom(this.authService.adminLogin({ email: adminData.email, password }))
            .then(authRes => {
              if (!authRes.success) throw new Error(authRes.message);
              return true;
            })
            .catch(error => {
              Swal.showValidationMessage(`รหัสผ่านไม่ถูกต้อง`);
            });
        },
        allowOutsideClick: () => !Swal.isLoading()
      }).then((authResult) => {
        if (authResult.isConfirmed) {
          Swal.fire({
            title: '⚠️ ยืนยันการลบ?',
            html: confirmHtml,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบเลย!',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#d32f2f',
            cancelButtonColor: '#9e9e9e',
          }).then((result) => {
            if (result.isConfirmed) {
              this.courseService.deleteSubjectGroup(group.id).subscribe({
                next: (delRes) => {
                  if (delRes.success) {
                    Swal.fire({
                      icon: 'success',
                      title: 'ลบสำเร็จ!',
                      text: 'ลบกลุ่มวิชาเรียบร้อยแล้ว',
                      timer: 1500,
                      showConfirmButton: false
                    });
                    this.loadAllData();
                    if (this.subjectForm.group_id === group.id) {
                       this.subjectForm.group_id = '';
                       this.subjectsInGroup = [];
                    }
                  } else {
                    Swal.fire('ข้อผิดพลาด', delRes.message, 'error');
                  }
                },
                error: (err) => {
                  console.error('Error deleting group:', err);
                  Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
                }
              });
            }
          });
        }
      });
    } catch (err) {
      console.error(err);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบคะแนนได้', 'error');
    }
  }

  async deleteSubject(subject: any) {
    try {
      const res = await lastValueFrom(this.courseService.checkSubjectScores(subject.subject_id));
      const hasScores = res.hasScores;

      const adminData = this.authService.getAdminData();
      if (!adminData || !adminData.email) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
        return;
      }

      let confirmHtml = `คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชา "<b>${subject.subject_name}</b>"?`;
      if (hasScores) {
        confirmHtml = `<p style="color: #d32f2f; margin-bottom: 8px; text-align: left; font-weight: bold;">⚠️ มีการกรอกคะแนนแล้ว!</p>
                       <p style="color: #d32f2f; margin-bottom: 8px; text-align: left;">หากลบ คะแนนของนักเรียนในรายวิชานี้จะ<b>หายไปอย่างถาวร</b></p>
                       ${confirmHtml}`;
      }

      Swal.fire({
        title: '⚠️ ยืนยันสิทธิ์ลบรายวิชา',
        text: 'กรุณากรอกรหัสผ่านแอดมินเพื่อยืนยันการลบ',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านแอดมิน',
        inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        showLoaderOnConfirm: true,
        preConfirm: (password) => {
          if (!password) {
            Swal.showValidationMessage('กรุณากรอกรหัสผ่าน');
            return false;
          }
          return lastValueFrom(this.authService.adminLogin({ email: adminData.email, password }))
            .then(authRes => {
              if (!authRes.success) throw new Error(authRes.message);
              return true;
            })
            .catch(error => {
              Swal.showValidationMessage(`รหัสผ่านไม่ถูกต้อง`);
            });
        },
        allowOutsideClick: () => !Swal.isLoading()
      }).then((authResult) => {
        if (authResult.isConfirmed) {
          Swal.fire({
            title: '⚠️ ยืนยันการลบ?',
            html: confirmHtml,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบเลย!',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#d32f2f',
            cancelButtonColor: '#9e9e9e',
          }).then((result) => {
            if (result.isConfirmed) {
              this.courseService.deleteSubject(subject.subject_id).subscribe({
                next: (delRes) => {
                  if (delRes.success) {
                    Swal.fire({
                      icon: 'success',
                      title: 'ลบสำเร็จ!',
                      text: 'ลบรายวิชาเรียบร้อยแล้ว',
                      timer: 1500,
                      showConfirmButton: false
                    });
                    this.onGroupChange(); // reload subjects in this group
                  } else {
                    Swal.fire('ข้อผิดพลาด', delRes.message, 'error');
                  }
                },
                error: (err) => {
                  console.error('Error deleting subject:', err);
                  Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'error');
                }
              });
            }
          });
        }
      });
    } catch (err) {
      console.error(err);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบคะแนนได้', 'error');
    }
  }

  onGroupChange() {
    if (!this.subjectForm.group_id || !this.selectedBatchForSubject) {
      this.subjectsInGroup = [];
      return;
    }
    
    this.isLoadingSubjects = true;
    this.courseService.getSubjectsByBatch(this.selectedBatchForSubject).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          const selectedGroupObj = this.groups.find(g => g.id.toString() === this.subjectForm.group_id.toString());
          if (selectedGroupObj) {
            const groupData = res.data.find((g: any) => g.group_name === selectedGroupObj.group_name);
            if (groupData && groupData.subjects) {
              this.subjectsInGroup = groupData.subjects;
            } else {
              this.subjectsInGroup = [];
            }
          } else {
            this.subjectsInGroup = [];
          }
        } else {
          this.subjectsInGroup = [];
        }
        this.isLoadingSubjects = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching subjects for group:', err);
        this.isLoadingSubjects = false;
        this.subjectsInGroup = [];
        this.cdr.detectChanges();
      }
    });
  }
}