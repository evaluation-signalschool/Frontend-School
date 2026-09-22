import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThaiDatePickerComponent } from '../../components/thai-datepicker/thai-datepicker.component';
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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, ThaiDatePickerComponent],
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
  courseForm: any = { course_name: '', curriculum_year: null };
  isNewCourse: boolean = false;
  
  // Table filters
  filterCourseYear: string = '';
  filterCourseName: string = '';
  
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

  // Batch Subjects Inline Section states
  batchSubjectsList: any[] = [];
  isLoadingBatchSubjects: boolean = false;
  filterSubjectGroupId: string = '';
  filterSubjectName: string = '';

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
          this.groups = (res.data || []).sort((a: any, b: any) => this.compareGroupNames(a.group_name, b.group_name)); 
          this.cdr.detectChanges(); // บังคับให้ UI อัปเดตทันที
        }
      },
      error: (err) => console.error(err)
    });
    if (this.selectedBatchForSubject) {
      this.loadSubjectsForSelectedBatch();
    }
  }

  // Helpers for Course Names
  getUniqueCourseNames(): string[] {
    const names = this.courses.map(c => c.course_name);
    return Array.from(new Set(names));
  }

  getUniqueCourseYears(): string[] {
    const years = this.courses.map(c => c.curriculum_year).filter(y => y);
    return Array.from(new Set(years)).sort((a: any, b: any) => b - a).map(String);
  }

  getFilteredCourses(): any[] {
    return this.courses.filter(c => {
      const matchYear = this.filterCourseYear ? c.curriculum_year?.toString() === this.filterCourseYear : true;
      const matchName = this.filterCourseName ? c.course_name.toLowerCase().includes(this.filterCourseName.toLowerCase()) : true;
      return matchYear && matchName;
    });
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

  trackByGroupId(index: number, group: any): any {
    return group.id;
  }

  // Filter methods for cascading dropdowns
  getBatchesForCourse(courseId: string) {
    if (!courseId) return [];
    return this.batches.filter((b: any) => b.course_id.toString() === courseId.toString());
  }

  // ฟังก์ชันช่วยจัดลำดับความสำคัญของกลุ่มวิชา: M (วิชาหลัก) -> MN (วิชารอง) -> S (วิชาประกอบ) -> P (ภาคปฏิบัติ)
  getGroupPrefixOrder(name: string): number {
    const upper = (name || '').trim().toUpperCase();
    if (upper.startsWith('MN')) return 2;
    if (upper.startsWith('M')) return 1;
    if (upper.startsWith('S')) return 3;
    if (upper.startsWith('P')) return 4;
    return 5;
  }

  compareGroupNames(aName: string, bName: string): number {
    const orderA = this.getGroupPrefixOrder(aName);
    const orderB = this.getGroupPrefixOrder(bName);
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // ถ้าเป็นกลุ่มประเภทเดียวกัน ให้เรียงตามตัวเลขน้อยไปมาก เช่น M01, M02, M03...
    const matchA = (aName || '').match(/\d+/);
    const matchB = (bName || '').match(/\d+/);
    if (matchA && matchB) {
      const numA = parseInt(matchA[0], 10);
      const numB = parseInt(matchB[0], 10);
      if (numA !== numB) {
        return numA - numB;
      }
    }

    return (aName || '').localeCompare(bName || '', 'th', { numeric: true, sensitivity: 'base' });
  }

  getGroupsForBatch(batchId: string) {
    if (!batchId) return [];
    return this.groups
      .filter((g: any) => g.batch_id.toString() === batchId.toString())
      .sort((a: any, b: any) => this.compareGroupNames(a.group_name, b.group_name));
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

  onCourseSelectChange(event: any) {
    if (event.target.value === 'NEW_COURSE') {
      this.isNewCourse = true;
      this.courseForm.course_name = '';
    }
  }

  cancelNewCourse() {
    this.isNewCourse = false;
    this.courseForm.course_name = '';
  }

  onSubmitCourse() {
    if (this.courseForm.course_name === 'NEW_COURSE' || !this.courseForm.course_name) {
      Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อหลักสูตร', 'warning');
      return;
    }
    this.courseService.addCourse(this.courseForm).subscribe({
      next: (res) => {
        Swal.fire('สำเร็จ!', 'เพิ่มหลักสูตรเรียบร้อยแล้ว', 'success');
        this.courseForm = { course_name: '', curriculum_year: null };
        this.isNewCourse = false;
        this.loadAllData(); // reload
      },
      error: (err) => {
        const msg = err?.error?.message || 'ไม่สามารถเพิ่มหลักสูตรได้';
        Swal.fire('เกิดข้อผิดพลาด!', msg, 'error');
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
      const removed = this.groupsList[index];
      const match = removed?.group_name ? removed.group_name.match(/^(.*?)(\d+)$/) : null;

      this.groupsList.splice(index, 1);

      if (match) {
        const prefix = match[1];
        const padLength = match[2].length;

        for (let i = index; i < this.groupsList.length; i++) {
          const curr = this.groupsList[i];
          if (!curr || !curr.group_name) break;

          const currMatch = curr.group_name.match(/^(.*?)(\d+)$/);
          // ถ้าไม่ใช่รหัสที่ขึ้นต้นด้วย prefix เดียวกัน ให้หยุดรันเลข
          if (!currMatch || currMatch[1].toUpperCase() !== prefix.toUpperCase()) {
            break;
          }

          let nextNum: number;
          if (i === 0) {
            nextNum = parseInt(match[2], 10);
          } else {
            const prev = this.groupsList[i - 1];
            const prevMatch = prev?.group_name ? prev.group_name.match(/^(.*?)(\d+)$/) : null;
            if (prevMatch && prevMatch[1].toUpperCase() === prefix.toUpperCase()) {
              nextNum = parseInt(prevMatch[2], 10) + 1;
            } else {
              nextNum = 1;
            }
          }

          const nextNumStr = nextNum.toString().padStart(padLength, '0');
          curr.group_name = prefix + nextNumStr;
        }
      }

      this.cdr.detectChanges();
    }
  }

  onGroupNameInput(g: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    // อนุญาตเฉพาะตัวแปรภาษาอังกฤษ (A-Z, a-z) และตัวเลข (0-9) เท่านั้น ไม่อนุญาตอักษรพิเศษและภาษาไทย
    const clean = (input.value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    g.group_name = clean;
    input.value = clean;
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

    // Pattern Validation: ต้องเป็นตัวแปรภาษาอังกฤษ (A-Z) และตัวเลขเท่านั้น โดยไม่มีอักษรพิเศษ
    const pattern = /^[A-Z][A-Z0-9]*$/i;
    for (const g of validGroups) {
      const gName = g.group_name.trim().toUpperCase();
      if (!pattern.test(gName)) {
        Swal.fire(
          'รูปแบบชื่อกลุ่มวิชาไม่ถูกต้อง', 
          `กลุ่มวิชา "<b>${g.group_name}</b>" ไม่ตรงตามรูปแบบที่กำหนด<br><br><span style="font-size: 14px; color: #666;">ต้องเป็นตัวอักษรภาษาอังกฤษ (A-Z) และตัวเลขเท่านั้น โดยไม่มีอักษรพิเศษหรือภาษาไทย<br>ตัวอย่างเช่น: M01, MN01, S01, P01</span>`, 
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
      if (this.selectedBatchForSubject) {
        this.loadSubjectsForSelectedBatch();
      }
      
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
  formatDateToThaiInput(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parts[1];
      const d = parts[2];
      const beYear = y < 2500 ? y + 543 : y;
      return `${d}/${m}/${beYear}`;
    }
    return dateStr;
  }

  parseThaiInputToISO(text: string): string {
    if (!text || !text.trim()) return '';
    const parts = text.trim().split(/[\/\-\.]/);
    if (parts.length === 3) {
      // กรณีผู้ใช้กรอก YYYY-MM-DD
      if (parts[0].length === 4) {
        let y = parseInt(parts[0], 10);
        if (y >= 2400) y -= 543;
        return `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // กรณีผู้ใช้กรอก DD/MM/YYYY (พ.ศ.)
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parseInt(parts[2], 10);
      if (y >= 2400) y -= 543;
      return `${y}-${m}-${d}`;
    }
    return text;
  }

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
          
          <label style="font-size: 14px; color: #555; margin-top: 8px;">วันที่เริ่มต้น (วว/ดด/พ.ศ.)</label>
          <input id="swal-start-date" class="swal2-input" placeholder="เช่น 09/09/2569" value="${this.formatDateToThaiInput(startDate)}" style="margin: 0; width: 100%; box-sizing: border-box;">
          
          <label style="font-size: 14px; color: #555; margin-top: 8px;">วันที่สิ้นสุด (วว/ดด/พ.ศ.)</label>
          <input id="swal-end-date" class="swal2-input" placeholder="เช่น 09/09/2569" value="${this.formatDateToThaiInput(endDate)}" style="margin: 0; width: 100%; box-sizing: border-box;">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#673ab7',
      preConfirm: () => {
        const name = (document.getElementById('swal-batch-name') as HTMLInputElement).value;
        const startRaw = (document.getElementById('swal-start-date') as HTMLInputElement).value;
        const endRaw = (document.getElementById('swal-end-date') as HTMLInputElement).value;
        
        if (!name.trim()) {
          Swal.showValidationMessage('กรุณากรอกชื่อรุ่น');
          return false;
        }

        const start = this.parseThaiInputToISO(startRaw);
        const end = this.parseThaiInputToISO(endRaw);

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
                    if (this.selectedBatchForSubject) {
                      this.loadSubjectsForSelectedBatch();
                    }
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
      this.cdr.detectChanges();
      return;
    }
    
    this.isLoadingSubjects = true;
    this.cdr.detectChanges();
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

  // ==========================================
  // จัดการรายวิชาทั้งหมดในรุ่นที่เลือก (Inline Batch Subjects)
  // ==========================================
  onBatchSelectedForSubject() {
    this.subjectForm.group_id = '';
    this.filterSubjectGroupId = '';
    this.filterSubjectName = '';
    if (this.selectedBatchForSubject) {
      this.loadSubjectsForSelectedBatch();
    } else {
      this.batchSubjectsList = [];
    }
    this.cdr.detectChanges();
  }

  loadSubjectsForSelectedBatch() {
    if (!this.selectedBatchForSubject) {
      this.batchSubjectsList = [];
      this.cdr.detectChanges();
      return;
    }
    this.isLoadingBatchSubjects = true;
    this.cdr.detectChanges();
    this.courseService.getSubjectsByBatch(this.selectedBatchForSubject).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          const allSubjs: any[] = [];
          const sortedGroups = [...res.data].sort((a: any, b: any) =>
            this.compareGroupNames(a.group_name, b.group_name)
          );
          for (const g of sortedGroups) {
            if (Array.isArray(g.subjects)) {
              for (const s of g.subjects) {
                allSubjs.push({
                  ...s,
                  subject_id: s.subject_id || s.id,
                  group_name: g.group_name,
                  group_id: g.id || g.group_id
                });
              }
            }
          }
          this.batchSubjectsList = allSubjs;
        } else {
          this.batchSubjectsList = [];
        }
        this.isLoadingBatchSubjects = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading subjects for batch:', err);
        this.batchSubjectsList = [];
        this.isLoadingBatchSubjects = false;
        this.cdr.detectChanges();
      }
    });
  }

  getSubjectsCountInGroup(groupName: string): number {
    return this.batchSubjectsList.filter(s => s.group_name === groupName).length;
  }

  getFilteredBatchSubjects(): any[] {
    let list = this.batchSubjectsList;
    if (this.filterSubjectGroupId) {
      const selGroup = this.groups.find(g => g.id.toString() === this.filterSubjectGroupId.toString());
      if (selGroup) {
        list = list.filter(s => s.group_name === selGroup.group_name);
      }
    }
    if (this.filterSubjectName && this.filterSubjectName.trim()) {
      const q = this.filterSubjectName.trim().toLowerCase();
      list = list.filter(s => (s.subject_name || '').toLowerCase().includes(q));
    }
    return list;
  }

  trackBySubjectId(index: number, s: any): any {
    return s.subject_id || s.id || index;
  }
}