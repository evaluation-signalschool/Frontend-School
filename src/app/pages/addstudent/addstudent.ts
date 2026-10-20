import { ChangeDetectorRef, Component, OnInit, NgZone } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DropdownService } from '../../services/dropdown.service';
import { StudentService } from '../../services/student.service';
import { CourseService, CourseGroup, BatchItem } from '../../services/course.service';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface Student {
  id: number;
  rank: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  password?: string;
  affiliation: string;
  student_code?: string;
  rank_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  showPassword?: boolean; // สำหรับเปิดปิดตาดูรหัสในตาราง
}

@Component({
  selector: 'app-addstudent',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './addstudent.html',
  styleUrls: ['./addstudent.scss'],
})
export class Addstudent implements OnInit {
  constructor(
    private router: Router,
    private location: Location,
    private courseService: CourseService,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  activeTab: 'single' | 'excel' | 'file' = 'single';
  students: Student[] = [];
  studentForms: Student[] = [this.getEmptyForm()];
  isEditing: boolean = false;
  editingId: number | null = null;
  excelData: string = '';
  selectedFileName: string = '';
  selectedFile: File | null = null;
  showPassword = false;

  pastedData: string = '';
  showPasteArea: boolean = false;

  togglePasteArea() {
    this.showPasteArea = !this.showPasteArea;
  }

  processPastedData() {
    if (!this.pastedData.trim()) return;

    const rows = this.pastedData.split('\n');
    const newForms: Student[] = [];

    for (let row of rows) {
      const trimmedRow = row.trim();
      if (!trimmedRow) continue;

      // ข้ามบรรทัดหัวตาราง (ถ้าผู้ใช้เผลอก๊อปปี้หัวตารางมาด้วย)
      if (
        (trimmedRow.includes('ชื่อ') && (trimmedRow.includes('นามสกุล') || trimmedRow.includes('สกุล'))) ||
        (trimmedRow.includes('ยศ') && trimmedRow.includes('ชื่อ'))
      ) {
        continue;
      }

      // รองรับทั้งคั่นด้วย Tab (จาก Excel), comma หรือช่องว่างหลายช่อง
      let columns: string[] = [];
      if (trimmedRow.includes('\t')) {
        columns = trimmedRow.split('\t').map(c => c?.trim() || '');
      } else if (trimmedRow.includes(',')) {
        columns = trimmedRow.split(',').map(c => c?.trim() || '');
      } else {
        columns = trimmedRow.split(/\s{2,}/).map(c => c?.trim() || '');
      }

      if (columns.length === 0 || !columns[0]) continue;

      const newStudent = this.getEmptyForm();
      const hasThai = (str: string) => /[\u0E00-\u0E7F]/.test(str);
      const isEmail = (s: string) => s.includes('@');
      const isPhone = (s: string) => /^[0-9\-\+\s]{8,15}$/.test(s.replace(/[\s\-]/g, ''));

      let fullNameStr = '';
      let affiliationStr = '';
      let phoneStr = '';
      let emailStr = '';

      const assignPhoneAndEmail = (valA: string, valB: string) => {
        if (!valA && !valB) return;
        if (isEmail(valA)) {
          emailStr = valA;
          phoneStr = valB;
        } else if (isEmail(valB)) {
          emailStr = valB;
          phoneStr = valA;
        } else if (isPhone(valA)) {
          phoneStr = valA;
          emailStr = valB;
        } else if (isPhone(valB)) {
          phoneStr = valB;
          emailStr = valA;
        } else {
          // ถ้าไม่มี @ และไม่ใช่ตัวเลขชัดเจน ให้จัดตามลำดับฟอร์ม: [เบอร์โทรศัพท์, อีเมล]
          phoneStr = valA;
          emailStr = valB;
        }
      };

      // ตรวจสอบกรณีฟอร์แมตเดิมที่มีรหัสผ่านนำหน้า: [0]=รหัสผ่าน, [1]=ยศ-ชื่อ-สกุล, [2]=สังกัด, [3]=เบอร์โทร/อีเมล, [4]=อีเมล/เบอร์โทร
      const isOldPasswordFormat = columns.length >= 4 && !hasThai(columns[0]) && hasThai(columns[1]);

      if (isOldPasswordFormat) {
        fullNameStr = columns[1];
        affiliationStr = columns[2] || '';
        assignPhoneAndEmail(columns[3] || '', columns[4] || '');
      } else if (columns.length >= 5 && hasThai(columns[1]) && hasThai(columns[2])) {
        // รูปแบบ 6 หรือ 5 คอลัมน์ที่สัมพันธ์กับฟอร์ม:
        // [0]=ยศ, [1]=ชื่อ, [2]=นามสกุล, [3]=สังกัด, [4]=เบอร์โทรศัพท์, [5]=อีเมล
        newStudent.rank = columns[0];
        newStudent.firstName = columns[1];
        newStudent.lastName = columns[2];
        affiliationStr = columns[3] || '';
        assignPhoneAndEmail(columns[4] || '', columns[5] || '');
      } else if (columns.length === 4 && hasThai(columns[1]) && hasThai(columns[2])) {
        // [0]=ยศ, [1]=ชื่อ, [2]=นามสกุล, [3]=สังกัด
        newStudent.rank = columns[0];
        newStudent.firstName = columns[1];
        newStudent.lastName = columns[2];
        affiliationStr = columns[3] || '';
      } else if (columns.length === 3 && hasThai(columns[0]) && hasThai(columns[1]) && hasThai(columns[2])) {
        // [0]=ยศ, [1]=ชื่อ, [2]=นามสกุล
        newStudent.rank = columns[0];
        newStudent.firstName = columns[1];
        newStudent.lastName = columns[2];
      } else {
        // รูปแบบรวมชื่อ: [0]=ยศ-ชื่อ-นามสกุล, [1]=สังกัด, [2]=เบอร์โทร, [3]=อีเมล
        fullNameStr = columns[0];
        affiliationStr = columns[1] || '';
        assignPhoneAndEmail(columns[2] || '', columns[3] || '');
      }

      // แยก ยศ ชื่อ สกุล ถ้ายังไม่ได้แยก
      if (fullNameStr && !newStudent.firstName) {
        const nameParts = fullNameStr.trim().split(/\s+/);
        if (nameParts.length >= 3) {
          newStudent.rank = nameParts[0];
          newStudent.firstName = nameParts[1];
          newStudent.lastName = nameParts.slice(2).join(' ');
        } else if (nameParts.length === 2) {
          newStudent.rank = '';
          newStudent.firstName = nameParts[0];
          newStudent.lastName = nameParts[1];
        } else if (nameParts.length === 1) {
          newStudent.firstName = nameParts[0];
        }
      }

      // ถ้าสังกัดมี '@' แสดงว่าเป็นอีเมล
      if (affiliationStr && isEmail(affiliationStr) && !emailStr) {
        emailStr = affiliationStr;
        affiliationStr = '';
      }

      newStudent.affiliation = affiliationStr;
      newStudent.phone = phoneStr;
      newStudent.email = emailStr;
      newStudent.password = ''; // ไม่ต้องใช้รหัสผ่าน

      if (newStudent.firstName) {
        newForms.push(newStudent);
      }
    }

    if (newForms.length > 0) {
      if (this.studentForms.length === 1 && !this.studentForms[0].firstName) {
        this.studentForms = newForms;
      } else {
        this.studentForms = [...this.studentForms, ...newForms];
      }
      this.pastedData = '';
      this.showPasteArea = false;
      Swal.fire({
        icon: 'success',
        title: 'นำเข้าสู่ฟอร์มสำเร็จ',
        text: `ดึงข้อมูลมาใส่ในฟอร์มแล้ว ${newForms.length} คน สามารถตรวจสอบ/แก้ไขรายละเอียดแต่ละคน และกด "บันทึกข้อมูลนักเรียน" ได้เลย`
      });
    } else {
      Swal.fire('รูปแบบข้อมูลไม่ถูกต้อง', 'กรุณาคัดลอกจาก Excel หรือตาราง (ยศ | ชื่อ | นามสกุล | สังกัด | เบอร์โทรศัพท์ | อีเมล)', 'error');
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
  
  courseGroups: CourseGroup[] = [];
  availableBatches: BatchItem[] = [];
  selectedCourse: string = '';
  selectedBatch: string = '';

  ngOnInit() {
    this.fetchCourses();
  }

  fetchCourses() {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
        }
      },
      error: (err) => console.error('Failed to load courses', err),
    });
  }

  onCourseChange() {
    const selectedGroup = this.courseGroups.find((c) => c.course_name === this.selectedCourse);
    if (selectedGroup) {
      this.availableBatches = selectedGroup.batches;
    } else {
      this.availableBatches = [];
    }
    this.selectedBatch = '';
    this.fetchStudents();
  }

  onBatchChange() {
    this.fetchStudents();
  }

  fetchStudents() {
    if (!this.selectedBatch) {
      this.students = [];
      this.cdr.detectChanges();
      return;
    }
    this.studentService.getStudents(this.selectedBatch).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          const data = Array.isArray(res) ? res : (res.data || []);
          this.students = data.map((s: any) => ({
            id: s.id,
            rank: s.rank_name || s.rankName || '',
            firstName: s.first_name || s.firstName || '',
            lastName: s.last_name || s.lastName || '',
            studentCode: s.student_code || s.studentCode || '',
            password: s.password || '',
            affiliation: s.affiliation || '',
            email: s.email || '',
            phone: s.phone || '',
            showPassword: false
          }));
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Failed to load students', err),
    });
  }

  onCancel(): void {
    this.location.back();
  }

  switchTab(tabId: 'single' | 'excel' | 'file') {
    this.activeTab = tabId;
  }

  resetForm() {
    this.studentForms = [this.getEmptyForm()];
    this.isEditing = false;
    this.editingId = null;
  }

  addFormRow() {
    this.studentForms.push(this.getEmptyForm());
  }

  removeFormRow(index: number) {
    if (this.studentForms.length > 1) {
      this.studentForms.splice(index, 1);
    }
  }

  private getEmptyForm(): Student {
    return {
      id: 0,
      rank: '',
      firstName: '',
      lastName: '',
      studentCode: '',
      password: '',
      affiliation: '',
      email: '',
      phone: '',
    };
  }

  onEditStudent(student: Student) {
    this.isEditing = true;
    this.editingId = student.id;
    this.studentForms = [{ ...student, password: '' }];
    this.activeTab = 'single';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onDeleteStudent(id: number) {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: "คุณต้องการลบข้อมูลนักเรียนคนนี้ใช่หรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.studentService.deleteStudent(id).subscribe({
          next: (res) => {
            Swal.fire('สำเร็จ', 'ลบข้อมูลนักเรียนสำเร็จ', 'success');
            if (this.editingId === id) {
              this.resetForm();
            }
            this.fetchStudents(); // โหลดข้อมูลใหม่เพื่ออัปเดตลำดับ
          },
          error: (err) => {
            console.error('Delete failed', err);
            Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการลบข้อมูลนักเรียน', 'error');
          }
        });
      }
    });
  }

  onSubmitSingle() {
    if (!this.selectedCourse || !this.selectedBatch) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกหลักสูตรและรุ่นก่อนทำการเพิ่มนักเรียน', 'warning');
      return;
    }

    // ตรวจสอบว่าทุกแถวกรอกข้อมูลครบหรือไม่
    for (let form of this.studentForms) {
      if (!form.firstName || !form.lastName) {
        Swal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูล ชื่อ และนามสกุล ให้ครบถ้วนทุกรายการ', 'warning');
        return;
      }
    }

    if (this.isEditing && this.editingId !== null) {
      const form = this.studentForms[0];
      const payload = {
        batch_id: this.selectedBatch,
        student_code: form.studentCode,
        password: form.password || '1234',
        rank_name: form.rank,
        first_name: form.firstName,
        last_name: form.lastName,
        affiliation: form.affiliation,
        email: form.email,
        phone: form.phone,
      };

      this.studentService.updateStudent(this.editingId, payload).subscribe({
        next: (res) => {
          Swal.fire('สำเร็จ', 'อัปเดตข้อมูลนักเรียนสำเร็จ', 'success');
          this.resetForm();
          this.fetchStudents();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Update failed', err);
          Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลนักเรียน', 'error');
        }
      });
    } else {
      // เพิ่มหลายคนพร้อมกัน
      Swal.fire({
        title: 'กำลังบันทึกข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const addSequentially = (index: number) => {
        if (index >= this.studentForms.length) {
          Swal.fire('สำเร็จ', `เพิ่มข้อมูลนักเรียน ${this.studentForms.length} รายการสำเร็จ`, 'success');
          this.resetForm();
          this.fetchStudents();
          this.cdr.detectChanges();
          return;
        }

        const form = this.studentForms[index];
        const payload = {
          batch_id: this.selectedBatch,
          student_code: form.studentCode,
          password: form.password || '1234',
          rank_name: form.rank,
          first_name: form.firstName,
          last_name: form.lastName,
          affiliation: form.affiliation,
          email: form.email,
          phone: form.phone,
        };

        this.studentService.addStudent(payload).subscribe({
          next: () => addSequentially(index + 1),
          error: (err) => {
            console.error('Add failed at index ' + index, err);
            Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลนักเรียนบางรายการ', 'error');
            this.fetchStudents();
          }
        });
      };

      addSequentially(0);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.selectedFileName = this.selectedFile.name;
    }
  }

  onSubmitFile() {
    if (!this.selectedCourse || !this.selectedBatch) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกหลักสูตรและรุ่นก่อนทำการอัปโหลดไฟล์', 'warning');
      return;
    }
    if (!this.selectedFile) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกไฟล์ CSV หรือ TXT ก่อนทำการบันทึก', 'warning');
      return;
    }

    this.studentService.uploadStudentCsv(this.selectedBatch, this.selectedFile).subscribe({
      next: (res) => {
        Swal.fire('สำเร็จ', 'อัปโหลดข้อมูลสำเร็จ', 'success');
        this.selectedFile = null;
        this.selectedFileName = '';
        this.fetchStudents();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Upload failed', err);
        Swal.fire('ผิดพลาด', 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์', 'error');
      },
    });
  }

  resequenceStudents() {
    if (!this.selectedBatch) return;

    Swal.fire({
      title: 'ยืนยันการจัดเรียงเลขที่ใหม่?',
      text: "ระบบจะทำการรันเลขที่นักเรียนใหม่ตั้งแต่ 1 เป็นต้นไป ตามลำดับปัจจุบัน การกระทำนี้ไม่สามารถย้อนกลับได้!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ใช่, จัดเรียงใหม่เลย!',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.studentService.resequenceStudents(this.selectedBatch).subscribe({
          next: (res) => {
            Swal.fire('สำเร็จ!', 'จัดเรียงเลขที่นักเรียนเรียบร้อยแล้ว', 'success');
            this.fetchStudents(); // โหลดข้อมูลใหม่
          },
          error: (err) => {
            console.error(err);
            Swal.fire('ผิดพลาด', 'ไม่สามารถจัดเรียงเลขที่ได้', 'error');
          }
        });
      }
    });
  }

  async exportToExcel() {
    if (!this.students || this.students.length === 0) {
      Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลนักเรียนให้ Export', 'warning');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('รายชื่อนักเรียน');
    
    worksheet.properties.defaultRowHeight = 25;

    // สร้าง Header
    const headers = ['ลำดับ', 'ยศ', 'ชื่อ', 'นามสกุล', 'สังกัด', 'อีเมล', 'เบอร์โทรศัพท์'];
    const headerRow = worksheet.addRow(headers);
    
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Sarabun', size: 12, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    
    // สร้าง Data
    this.students.forEach((student, index) => {
      const rowData = [
        student.studentCode,
        student.rank,
        student.firstName,
        student.lastName,
        student.affiliation || '',
        student.email || '',
        student.phone || ''
      ];
      
      const excelRow = worksheet.addRow(rowData);
      excelRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Sarabun', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 3 || colNumber === 4 || colNumber === 5 ? 'left' : 'center' };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
    });

    // ปรับขนาดคอลัมน์
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    worksheet.getColumn(3).width = 25; // ชื่อ
    worksheet.getColumn(4).width = 25; // นามสกุล
    worksheet.getColumn(5).width = 20; // สังกัด
    worksheet.getColumn(6).width = 25; // อีเมล
    worksheet.getColumn(7).width = 18; // เบอร์โทร

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `รายชื่อนักเรียน_${this.selectedBatch || 'ทั้งหมด'}.xlsx`);
  }
}


