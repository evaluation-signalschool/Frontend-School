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
      if (!row.trim()) continue;
      
      // Excel/Google Sheets copy puts tabs between cells
      const columns = row.split('\t');
      
      // Expected format based on user's Excel:
      // columns[0] = รหัสผ่าน (Password)
      // columns[1] = ยศ - ชื่อ - สกุล
      // columns[2] = สังกัด (Affiliation)
      
      if (columns.length >= 2) {
        const newStudent = this.getEmptyForm();
        
        // 1. รหัสผ่าน
        newStudent.password = columns[0]?.trim() || ''; 
        
        // 2. แยก ยศ ชื่อ สกุล
        const fullNameStr = columns[1] || '';
        // ตัดช่องว่างซ้ำซ้อนออกแล้วแยกคำด้วยช่องว่าง
        const nameParts = fullNameStr.trim().split(/\s+/);
        
        if (nameParts.length >= 3) {
          newStudent.rank = nameParts[0];
          newStudent.firstName = nameParts[1];
          // นามสกุลคือส่วนที่เหลือทั้งหมดมาต่อกัน
          newStudent.lastName = nameParts.slice(2).join(' ');
        } else if (nameParts.length === 2) {
          newStudent.rank = '';
          newStudent.firstName = nameParts[0];
          newStudent.lastName = nameParts[1];
        } else if (nameParts.length === 1) {
          newStudent.firstName = nameParts[0];
        }
        
        // 3. สังกัด
        newStudent.affiliation = columns[2]?.trim() || '';
        
        // 4. อีเมล
        newStudent.email = columns[3]?.trim() || '';

        // 5. เบอร์โทรศัพท์
        newStudent.phone = columns[4]?.trim() || '';
        
        // เพิ่มข้อมูลลงใน array ถ้ามีชื่อ
        if (newStudent.firstName) {
          newForms.push(newStudent);
        }
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
        title: 'สำเร็จ',
        text: `ดึงข้อมูลสำเร็จ ${newForms.length} รายการ กรุณาตรวจสอบข้อมูลและกดบันทึก`
      });
    } else {
      Swal.fire('ผิดพลาด', 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาก๊อปปี้จากตาราง (รหัสผ่าน | ยศ-ชื่อ-สกุล | สังกัด | อีเมล | เบอร์โทรศัพท์)', 'error');
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
    const headers = ['ลำดับ', 'รหัสผ่าน', 'ยศ', 'ชื่อ', 'นามสกุล', 'สังกัด', 'อีเมล', 'เบอร์โทรศัพท์'];
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
        student.password || '1234', // default ถ้าไม่มี
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
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 4 || colNumber === 5 || colNumber === 6 ? 'left' : 'center' };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
    });

    // ปรับขนาดคอลัมน์
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    worksheet.getColumn(4).width = 25; // ชื่อ
    worksheet.getColumn(5).width = 25; // นามสกุล
    worksheet.getColumn(6).width = 20; // สังกัด
    worksheet.getColumn(7).width = 25; // อีเมล

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `รายชื่อนักเรียน_${this.selectedBatch || 'ทั้งหมด'}.xlsx`);
  }
}


