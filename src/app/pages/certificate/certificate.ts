import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CourseService, CourseGroup, BatchItem } from '../../services/course.service';
import { StudentService } from '../../services/student.service';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

// ========================================== //
// ส่วนใหม่: โครงสร้างข้อมูลตำแหน่ง/สไตล์ของแต่ละกล่องข้อความ
// (สำหรับโหมดลากจัดตำแหน่งอิสระ)
// ========================================== //
interface LayoutField {
  topMm: number;
  leftMm: number;
  widthMm: number;
  fontSize: number; // pt
  color: string;
  fontWeight: number;
  textAlign: 'left' | 'center' | 'right';
}
type LayoutMap = Record<string, LayoutField>;

// ค่าเริ่มต้น อิงตามตำแหน่งเดิมที่มีอยู่ใน certificate.scss ให้ใกล้เคียงของเดิมที่สุด
const DEFAULT_LAYOUT: LayoutMap = {
  name:           { topMm: 112,   leftMm: 23.5,  widthMm: 250, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  course:         { topMm: 123.7, leftMm: 23.5,  widthMm: 250, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  duration:       { topMm: 135.5, leftMm: 23.5,  widthMm: 250, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  issueDate:      { topMm: 147.2, leftMm: 23.5,  widthMm: 250, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  // ลายเซ็นซ้าย แยกทีละบรรทัด
  sigLeftRank:    { topMm: 166.8, leftMm: 25.4,  widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'left' },
  sigLeftName:    { topMm: 178.5, leftMm: 25.4,  widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  sigLeftTitle:   { topMm: 190.2, leftMm: 25.4,  widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  // ลายเซ็นขวา แยกทีละบรรทัด
  sigRightRank:   { topMm: 166.8, leftMm: 185.0, widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'left' },
  sigRightName:   { topMm: 178.5, leftMm: 185.0, widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
  sigRightTitle:  { topMm: 190.2, leftMm: 185.0, widthMm: 100, fontSize: 35, color: '#000000', fontWeight: 400, textAlign: 'center' },
};

const LAYOUT_STORAGE_KEY = 'certificateTextLayout_v2'; // เปลี่ยน key เพื่อ reset layout เก่า

@Component({
  selector: 'app-certificate',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './certificate.html',
  styleUrls: ['./certificate.scss'],
})
export class Certificate implements OnInit {
  courseGroups: CourseGroup[] = [];
  
  // Selections
  selectedCourseName: string = '';
  selectedCourseId: string = '';
  selectedBatchId: string = '';
  
  // Data
  selectedBatch: BatchItem | null = null;
  students: any[] = [];
  printStudents: any[] = []; // ใช้สำหรับวนลูปพิมพ์

  // Certificate Configurations
  extraCourseText: string = 'ผ่านสื่ออิเล็กทรอนิกส์ (หลักสูตรเร่งรัด)';
  issueDate: string = ''; // Format YYYY-MM-DD สำหรับ input[type="date"]
  
  commanderName: string = 'พรเทพ ยังรักษา';
  commanderRank: string = 'พลโท';
  commanderTitle: string = 'ผู้บัญชาการโรงเรียน';
  
  deputyName: string = 'ธนชัย ครุธบุญยงค์';
  deputyRank: string = 'พันเอก';
  deputyTitle: string = 'รองผู้บัญชาการโรงเรียน';

  // ========================================== //
  // ส่วนใหม่: state ของโหมดจัดตำแหน่งข้อความอิสระ
  // ========================================== //
  designMode = false;
  selectedKey: string | null = null;
  layout: LayoutMap = this.loadLayout();

  designFields: { key: string; label: string }[] = [
    { key: 'name',          label: 'ชื่อผู้เข้าอบรม' },
    { key: 'course',        label: 'ชื่อหลักสูตร' },
    { key: 'duration',      label: 'ระยะเวลาอบรม' },
    { key: 'issueDate',     label: 'วันที่ออกใบประกาศ' },
    { key: 'sigLeftRank',   label: 'ยศ (ซ้าย)' },
    { key: 'sigLeftName',   label: 'ชื่อ (ซ้าย)' },
    { key: 'sigLeftTitle',  label: 'ตำแหน่ง (ซ้าย)' },
    { key: 'sigRightRank',  label: 'ยศ (ขวา)' },
    { key: 'sigRightName',  label: 'ชื่อ (ขวา)' },
    { key: 'sigRightTitle', label: 'ตำแหน่ง (ขวา)' },
  ];

  private dragKey: string | null = null;
  private dragOffsetPx = { x: 0, y: 0 };
  private resizeKey: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidthMm = 0;

  private readonly SNAP_MM = 0; // ปิดการดูด (0 mm)

  // Guide state (computed during drag)
  activeHSnap: number | null = null; // topMm ที่กำลัง snap
  activeVSnap: number | null = null; // leftMm ที่กำลัง snap
  isCenterH: boolean = false; // กล่องอยู่กึ่งกลางแนวนอน?
  isCenterV: boolean = false; // กล่องอยู่กึ่งกลางแนวตั้ง?

  get dragX(): number | null {
    return this.dragKey ? this.layout[this.dragKey].leftMm : null;
  }

  get dragY(): number | null {
    return this.dragKey ? this.layout[this.dragKey].topMm : null;
  }

  constructor(
    private location: Location,
    private courseService: CourseService,
    private studentService: StudentService
  ) {}

  ngOnInit(): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'หน้านี้ยังอยู่ระหว่างการพัฒนา',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
    });
    this.fetchCourses();
  }

  fetchCourses() {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res.success) {
          this.courseGroups = res.data;
        }
      },
      error: (err) => console.error('Error fetching courses:', err)
    });
  }

  getUniqueCourseNames(): string[] {
    const names = this.courseGroups.map((g) => g.course_name);
    return Array.from(new Set(names));
  }

  getCoursesByName(name: string): BatchItem[] {
    const group = this.courseGroups.find((g) => g.course_name === name);
    return group ? group.batches : [];
  }

  getBatchesForCourse(courseId: string | number): BatchItem[] {
    const group = this.courseGroups.find((g) => g.course_name === this.selectedCourseName);
    if (!group) return [];
    return group.batches.filter((b) => Number(b.course_id) === Number(courseId));
  }

  onBatchChange() {
    this.students = [];
    if (!this.selectedBatchId) {
      this.selectedBatch = null;
      return;
    }

    // หาข้อมูลรุ่นที่ถูกเลือก
    const group = this.courseGroups.find(g => g.course_name === this.selectedCourseName);
    if (group) {
      this.selectedBatch = group.batches.find(b => Number(b.batch_id) === Number(this.selectedBatchId)) || null;
      
      // ดึงข้อมูลวันที่สิ้นสุดมาเป็นค่าเริ่มต้นของวันที่ออกใบประกาศ
      if (this.selectedBatch && this.selectedBatch.start_date) {
        // หา end_date จาก data (ถ้า backend ส่งกลับมาใน batch_item) 
        // หากไม่มี จะใช้วันที่ปัจจุบันเป็นค่าเริ่มต้น
        const anyBatch = this.selectedBatch as any;
        if (anyBatch.end_date) {
          this.issueDate = anyBatch.end_date.substring(0, 10);
        } else {
          this.issueDate = new Date().toISOString().substring(0, 10);
        }
      }
    }

    // ดึงรายชื่อนักเรียน
    this.studentService.getStudents(this.selectedBatchId).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res.data || []);
        this.students = data;
      },
      error: (err) => console.error('Error fetching students:', err)
    });
  }

  onCancel(): void {
    this.location.back();
  }

  // --- Helper Functions for Formatting ---
  
  toThaiDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const thaiNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    let year = date.getFullYear();
    // ถ้าปีน้อยกว่า 2500 แสดงว่าเป็น ค.ศ. ให้บวก 543
    if (year < 2500) {
      year += 543;
    }

    // แปลงตัวเลขเป็นเลขไทย
    const toThaiNum = (num: number) => num.toString().split('').map(d => thaiNumerals[parseInt(d)]).join('');

    return `${toThaiNum(day)} ${month} ${toThaiNum(year)}`;
  }

  getPrintIssueDate(): string {
    if (!this.issueDate) return '';
    return `ให้ไว้ ณ วันที่ ${this.toThaiDate(this.issueDate)}`;
  }

  getPrintDuration(): string {
    if (!this.selectedBatch) return '';
    const anyBatch = this.selectedBatch as any;
    const start = anyBatch.start_date ? this.toThaiDate(anyBatch.start_date) : '';
    const end = anyBatch.end_date ? this.toThaiDate(anyBatch.end_date) : '';
    
    if (start && end) {
      return `ระยะเวลาการฝึกอบรม ตั้งแต่ ${start} ถึง ${end}`;
    } else if (start) {
      return `ระยะเวลาการฝึกอบรม ตั้งแต่ ${start}`;
    }
    return '';
  }

  toThaiNumerals(text: string): string {
    if (!text) return text;
    const thaiNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return text.replace(/[0-9]/g, match => thaiNumerals[parseInt(match)]);
  }

  getPrintCourseAndBatch(): string {
    if (!this.selectedBatch || !this.selectedCourseName) return '';
    const text = `ได้สำเร็จ การฝึกอบรมตามหลักสูตร${this.selectedCourseName} ${this.extraCourseText} ${this.selectedBatch.batch_name}`;
    return this.toThaiNumerals(text);
  }

  // --- Print Actions ---
  
  printCertificate(student: any) {
    this.printStudents = [student];
    setTimeout(() => {
      window.print();
    }, 100);
  }

  printAllCertificates() {
    this.printStudents = [...this.students];
    setTimeout(() => {
      window.print();
    }, 100);
  }

  // --- Search & Filter ---
  searchTerm: string = '';

  get filteredStudents(): any[] {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      return this.students;
    }
    const q = this.searchTerm.trim().toLowerCase();
    return this.students.filter((s) => {
      const code = (s.student_code || '').toLowerCase();
      const rank = (s.rank_name || '').toLowerCase();
      const first = (s.first_name || '').toLowerCase();
      const last = (s.last_name || '').toLowerCase();
      const full = `${rank} ${first} ${last}`.toLowerCase();
      const aff = (s.affiliation || '').toLowerCase();
      return code.includes(q) || full.includes(q) || aff.includes(q);
    });
  }

  // --- Export & Copy for Staff ---
  exportCertificateMailMerge(): void {
    if (!this.students || this.students.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูลนักเรียน',
        text: 'กรุณาเลือกหลักสูตรและรุ่นที่มีข้อมูลนักเรียนก่อนทำการส่งออก',
        confirmButtonColor: '#7e22ce'
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('รายชื่อออกใบประกาศ');
    worksheet.properties.defaultRowHeight = 24;

    // Header title row
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    const bName = this.selectedBatch ? this.selectedBatch.batch_name : '';
    const yr = this.selectedBatch?.curriculum_year ? `ประจำปีการศึกษา ${this.selectedBatch.curriculum_year}` : '';
    titleCell.value = `รายชื่อผู้สำเร็จการศึกษาสำหรับออกใบประกาศนียบัตร - ${this.selectedCourseName} ${bName} ${yr}`;
    titleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FF4A148C' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
    worksheet.getRow(1).height = 32;

    // Subtitle instruction
    worksheet.mergeCells('A2:L2');
    const subCell = worksheet.getCell('A2');
    subCell.value = 'ไฟล์นี้จัดเตรียมข้อมูลคอลัมน์มาตรฐานสำหรับนำไปเชื่อมต่อทำจดหมายเวียน (Mail Merge) ใน Microsoft Word ได้ทันที';
    subCell.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF6B21A8' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Table Column Headers for Word Mail Merge
    const headers = [
      'ลำดับ',
      'รหัสประจำตัว',
      'ยศ',
      'ชื่อ',
      'นามสกุล',
      'ยศ_ชื่อ_นามสกุล',
      'สังกัด',
      'หลักสูตร',
      'รุ่น',
      'วันที่ออกใบประกาศ',
      'ผู้ลงนาม_1',
      'ผู้ลงนาม_2'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });

    const printIssueDateText = this.getPrintIssueDate() || '-';
    const sig1Text = `${this.commanderRank} ${this.commanderName} (${this.commanderTitle})`;
    const sig2Text = `${this.deputyRank} ${this.deputyName} (${this.deputyTitle})`;

    this.students.forEach((s, idx) => {
      const rank = (s.rank_name || '').trim();
      const first = (s.first_name || '').trim();
      const last = (s.last_name || '').trim();
      const fullNameWithRank = `${rank} ${first} ${last}`.trim();

      const row = worksheet.addRow([
        idx + 1,
        s.student_code || '-',
        rank || '-',
        first,
        last,
        fullNameWithRank,
        s.affiliation || '-',
        this.selectedCourseName || '-',
        bName || '-',
        printIssueDateText,
        sig1Text,
        sig2Text
      ]);

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Sarabun', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if ([1, 2, 3, 9, 10].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    // Auto-fit column widths
    worksheet.columns.forEach((col: any) => {
      let maxLen = 12;
      col.eachCell({ includeEmpty: false }, (cell: any) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 38);
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const fileName = `รายชื่อออกใบประกาศ_${this.selectedCourseName}_${bName || 'รุ่น'}.xlsx`;
      saveAs(new Blob([buffer]), fileName);

      Swal.fire({
        icon: 'success',
        title: 'ส่งออกไฟล์ Excel เรียบร้อยแล้ว',
        html: `ไฟล์ <b>${fileName}</b> พร้อมใช้งาน<br><small style="color: #6b21a8;">ท่านสามารถนำไฟล์นี้ไปเชื่อมต่อ Mail Merge ใน Word เพื่อพิมพ์ใบประกาศได้ทันที</small>`,
        confirmButtonColor: '#7e22ce'
      });
    });
  }

  copyAllStudentsText(): void {
    if (!this.students || this.students.length === 0) return;
    const lines = this.students.map((s, idx) => {
      const fullName = `${s.rank_name ? s.rank_name + ' ' : ''}${s.first_name || ''} ${s.last_name || ''}`.trim();
      const code = s.student_code ? `(${s.student_code})` : '';
      const aff = s.affiliation ? `สังกัด ${s.affiliation}` : '';
      return `${idx + 1}. ${fullName} ${code} ${aff}`.trim();
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'คัดลอกรายชื่อทั้งหมดแล้ว',
        text: `คัดลอกรายชื่อนักเรียน ${this.students.length} นาย ลงคลิปบอร์ดแล้ว สามารถนำไปวาง (Ctrl+V) ใน Word ได้ทันที`,
        timer: 2000,
        showConfirmButton: false
      });
    });
  }

  copySingleStudent(s: any): void {
    const fullName = `${s.rank_name ? s.rank_name + ' ' : ''}${s.first_name || ''} ${s.last_name || ''}`.trim();
    const aff = s.affiliation ? `สังกัด ${s.affiliation}` : '';
    const text = `${fullName} ${aff}`.trim();
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `คัดลอก: ${fullName}`,
        showConfirmButton: false,
        timer: 1500
      });
    });
  }

  // ========================================== //
  // ส่วนใหม่: โหมดจัดตำแหน่งข้อความอิสระ (ลาก-วาง + ตกแต่ง)
  // ========================================== //

  /** โหลดตำแหน่งที่เคยบันทึกไว้จากเบราว์เซอร์ (ถ้ามี) ผสานกับค่าเริ่มต้น */
  private loadLayout(): LayoutMap {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: LayoutMap = {} as LayoutMap;
        for (const key of Object.keys(DEFAULT_LAYOUT)) {
          merged[key] = { ...DEFAULT_LAYOUT[key], ...(parsed[key] || {}) };
        }
        return merged;
      }
    } catch (e) {
      console.warn('โหลดตำแหน่งข้อความที่บันทึกไว้ไม่สำเร็จ ใช้ค่าเริ่มต้นแทน', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  }

  /** บันทึกตำแหน่ง/สไตล์ปัจจุบันลงเบราว์เซอร์ (localStorage) เพื่อใช้ตอนพิมพ์ครั้งถัดไป */
  saveLayout(): void {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(this.layout));
    } catch (e) {
      console.warn('บันทึกตำแหน่งข้อความไม่สำเร็จ', e);
    }
  }

  /** รีเซ็ตกลับเป็นตำแหน่งเริ่มต้น */
  resetLayout(): void {
    this.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    this.saveLayout();
  }

  getFieldLabel(key: string): string {
    return this.designFields.find(f => f.key === key)?.label || key;
  }

  selectField(key: string): void {
    this.selectedKey = key;
  }

  deselectField(): void {
    this.selectedKey = null;
  }

  /** ข้อความตัวอย่างที่ใช้แสดงในโหมดจัดตำแหน่ง (ใช้ข้อมูลจริงถ้ามีเลือกรุ่น/นักเรียนแล้ว) */
  previewText(key: string): string {
    switch (key) {
      case 'name': {
        const s = this.students[0];
        return s ? `${s.rank_name} ${s.first_name} ${s.last_name}` : 'ยศ ชื่อ นามสกุล (ตัวอย่าง)';
      }
      case 'course':
        return this.getPrintCourseAndBatch() || 'ได้สำเร็จการฝึกอบรมตามหลักสูตร ... (ตัวอย่าง)';
      case 'duration':
        return this.getPrintDuration() || 'ระยะเวลาการฝึกอบรม ... (ตัวอย่าง)';
      case 'issueDate':
        return this.getPrintIssueDate() || 'ให้ไว้ ณ วันที่ ... (ตัวอย่าง)';
      case 'sigLeftRank':  return this.commanderRank || 'พลโท';
      case 'sigLeftName':  return `(${this.commanderName || 'ชื่อ นามสกุล'})`;
      case 'sigLeftTitle': return this.commanderTitle || 'ผู้บัญชาการโรงเรียน';
      case 'sigRightRank':  return this.deputyRank || 'พันเอก';
      case 'sigRightName':  return `(${this.deputyName || 'ชื่อ นามสกุล'})`;
      case 'sigRightTitle': return this.deputyTitle || 'รองผู้บัญชาการโรงเรียน';
      default: return '';
    }
  }

  /** สไตล์ตำแหน่ง/ฟอนต์/สี ที่ใช้ทั้งในหน้าจัดตำแหน่งและตอนพิมพ์จริง (มาจากข้อมูลเดียวกัน) */
  fieldStyle(key: string): { [prop: string]: string } {
    const f = this.layout[key];
    if (!f) return {};
    const isSig = key.startsWith('sig');
    return {
      position: 'absolute',
      top: f.topMm + 'mm',
      left: f.leftMm + 'mm',
      width: f.widthMm + 'mm',
      'font-size': f.fontSize + 'pt',
      color: f.color,
      'font-weight': String(f.fontWeight),
      'line-height': '1',
      'text-align': f.textAlign || (isSig ? 'left' : 'center'),
      'font-family': "'BooK_R-luX', 'Sarabun', 'TH Sarabun PSK', sans-serif",
      'white-space': 'nowrap',
      'overflow': 'visible',
    };
  }

  /** เส้นไกด์แนวนอน: กลุ่มที่มี topMm ตรงกัน 2+ อัน + เส้นวัดระยะห่างแนวนอนระหว่างกล่อง */
  getHGuides(): { topMm: number; active: boolean; gaps: { leftMm: number; widthMm: number; label: string }[] }[] {
    const positions = new Map<number, string[]>();
    for (const key of Object.keys(this.layout)) {
      const t = Math.round(this.layout[key].topMm * 10) / 10;
      if (!positions.has(t)) positions.set(t, []);
      positions.get(t)!.push(key);
    }

    const guides: any[] = [];
    positions.forEach((keys, topMm) => {
      if (keys.length < 2) return;
      const active = this.activeHSnap === topMm;

      // คำนวณระยะห่าง (gap) ระหว่างกล่องที่อยู่แนวเดียวกัน
      const sorted = keys
        .map(k => ({ leftMm: this.layout[k].leftMm, widthMm: this.layout[k].widthMm }))
        .sort((a, b) => a.leftMm - b.leftMm);

      const gaps: any[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const gapStart = a.leftMm + a.widthMm;
        const gapSize = b.leftMm - gapStart;
        if (gapSize > 0.5) {
          gaps.push({ leftMm: gapStart, widthMm: gapSize, label: `${Math.round(gapSize)}mm` });
        }
      }

      guides.push({ topMm, active, gaps });
    });

    return guides;
  }

  /** เส้นไกด์แนวตั้ง: กลุ่มที่มี leftMm ตรงกัน 2+ อัน + เส้นวัดระยะห่างแนวตั้งระหว่างกล่อง */
  getVGuides(): { leftMm: number; active: boolean; gaps: { topMm: number; heightMm: number; label: string }[] }[] {
    const positions = new Map<number, string[]>();
    for (const key of Object.keys(this.layout)) {
      const l = Math.round(this.layout[key].leftMm * 10) / 10;
      if (!positions.has(l)) positions.set(l, []);
      positions.get(l)!.push(key);
    }

    const guides: any[] = [];
    positions.forEach((keys, leftMm) => {
      if (keys.length < 2) return;
      const active = this.activeVSnap === leftMm;

      const sorted = keys
        .map(k => ({ topMm: this.layout[k].topMm }))
        .sort((a, b) => a.topMm - b.topMm);

      const gaps: any[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const gapStart = sorted[i].topMm;
        const gapSize = sorted[i + 1].topMm - gapStart;
        if (gapSize > 0.5) {
          gaps.push({ topMm: gapStart, heightMm: gapSize, label: `${Math.round(gapSize)}mm` });
        }
      }

      guides.push({ leftMm, active, gaps });
    });

    return guides;
  }

  startResize(event: PointerEvent, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeKey = key;
    this.resizeStartX = event.clientX;
    this.resizeStartWidthMm = this.layout[key].widthMm;
  }

  startDrag(event: PointerEvent, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragKey = key;
    this.selectedKey = key;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dragOffsetPx = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  @HostListener('document:pointermove', ['$event'])
  onDocPointerMove(event: PointerEvent): void {
    if (this.resizeKey) {
      // Handle resize
      const mmPerPx = 25.4 / 96;
      const deltaX = event.clientX - this.resizeStartX;
      const deltaMm = deltaX * mmPerPx;
      const field = this.layout[this.resizeKey];
      if (field) {
        field.widthMm = Math.round(Math.max(20, this.resizeStartWidthMm + deltaMm) * 10) / 10;
      }
      return;
    }
    if (!this.dragKey) return;
    const stage = document.getElementById('designStage');
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const mmPerPx = 25.4 / 96; // ค่าคงที่ตามสเป๊ค CSS (1in = 96px = 25.4mm) ใช้ได้ตรงกันทั้งจอและตอนพิมพ์

    const xPx = event.clientX - stageRect.left - this.dragOffsetPx.x;
    const yPx = event.clientY - stageRect.top - this.dragOffsetPx.y;

    const field = this.layout[this.dragKey];
    if (!field) return;

    let xMm = Math.max(0, xPx * mmPerPx);
    let yMm = Math.max(0, yPx * mmPerPx);

    field.leftMm = Math.round(xMm * 10) / 10;
    field.topMm = Math.round(yMm * 10) / 10;

    // Reset visual snap state
    this.activeHSnap = null;
    this.activeVSnap = null;
    this.isCenterH = false;
    this.isCenterV = false;

    // หาว่าตรงกับแกนกลางหน้ากระดาษพอดีไหม
    const centerX = Math.round((field.leftMm + (field.widthMm / 2)) * 10) / 10;
    if (centerX === 148.5 || field.leftMm === 148.5) {
      this.isCenterH = true;
    }
    if (field.topMm === 105) {
      this.isCenterV = true;
    }

    // หาว่าตรงกับกล่องอื่นพอดีเป๊ะไหม (เพื่อไฮไลต์เส้นไกด์)
    for (const key of Object.keys(this.layout)) {
      if (key === this.dragKey) continue;
      const other = this.layout[key];
      if (field.topMm === other.topMm) {
        this.activeHSnap = other.topMm;
      }
      if (field.leftMm === other.leftMm) {
        this.activeVSnap = other.leftMm;
      }
    }
  }

  @HostListener('document:pointerup')
  onDocPointerUp(): void {
    this.isCenterH = false;
    this.isCenterV = false;
    if (this.resizeKey) {
      this.resizeKey = null;
      this.saveLayout();
    }
    if (this.dragKey) {
      this.dragKey = null;
      this.saveLayout();
    }
  }
}
