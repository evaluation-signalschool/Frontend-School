import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { CourseService, CourseGroup, BatchItem } from '../../services/course.service';
import { ScoreService } from '../../services/score.service';

export interface SubjectItem {
  no?: number | string;
  name: string;
  credit?: number | string;
  grade?: string;
  braceSpan?: number;
  braceCredit?: string;
  braceGrade?: string;
  skipMerge?: boolean;
}

export interface SubjectGroup {
  categoryName: string;
  items: SubjectItem[];
}

export interface CellItem {
  no?: number;
  name: string;
  isHeader?: boolean;
  groupSize?: number;
  inGroup?: boolean;
  credit?: number | string;
  grade?: number | string;
}

export interface RowData {
  left?: CellItem | null;
  right?: CellItem | null;
}

@Component({
  selector: 'app-transcript',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transcript.html',
  styleUrls: ['./transcript.scss'],
})
export class Transcript implements OnInit {
  readonly rowHeightPx = 28;
  readonly Number = Number;

  getStudentCriteria(gpa: any): string {
    const num = Number(gpa);
    if (num >= 3.5) return 'ดีเลิศ';
    if (num >= 3.0) return 'ดีมาก';
    if (num >= 2.5) return 'ดี';
    if (num >= 2.0) return 'พอใช้';
    return 'ตก';
  }

  getStudentResult(gpa: any): string {
    const num = Number(gpa);
    return num >= 2.0 ? 'สำเร็จการฝึกอบรม' : 'ไม่สำเร็จการฝึกอบรม';
  }

  isOfficerCourse(): boolean {
    const name = (this.selectedCourseName || '').toLowerCase();
    return name.includes('นายร้อย') || name.includes('นายพัน') || name.includes('สัญญาบัตร');
  }

  // ==========================================
  // ข้อมูลหลักสูตร และรุ่น (Courses & Batches)
  // ==========================================
  courseGroups: CourseGroup[] = [];
  selectedCourseName: string = '';
  selectedCourseId: string = '';
  selectedBatchId: string = '';
  selectedBatch: BatchItem | null = null;

  // รายชื่อนักเรียนในรุ่น (ดึงจากระบบจริง)
  students: any[] = [];
  currentIndex: number = 0;
  isLoading: boolean = false;
  isLoadingScores: boolean = false;
  rawSubjectGroups: any[] = [];
  batchTotalCredits: string = '';

  // ==========================================
  // แถบเครื่องมือ Microsoft Word (Word-like Ribbon Toolbar)
  // ==========================================
  isEditMode: boolean = false;
  fontSize: string = '10.5pt';
  isBold: boolean = false;
  marginPreset: 'narrow' | 'normal' | 'wide' = 'normal';
  zoomScale: number = 100;
  isPrintingAll: boolean = false;

  // ข้อมูลหัวเอกสาร (แก้ไขได้)
  headerInfo = {
    annex: 'ผนวก ก',
    title: 'ระเบียบแสดงผลการฝึกอบรม',
    school: 'โรงเรียนทหารสื่อสาร กรมทหารสื่อสาร',
    courseTitle: 'หลักสูตรชั้นนายร้อย เหล่า ส. รุ่นที่ 70 (ชกท.0210) ประจำปีการศึกษา 2569',
    orderInfo: 'เปิดการฝึกอบรมตามคำสั่ง สส. (เฉพาะ) ที่ 293/69 ลง 16. เม.ย. 69',
    durationInfo: 'ระยะเวลาการฝึกอบรม 14 สัปดาห์ ตั้งแต่ 14 พ.ค. 69 ถึง 28 ส.ค. 69',
    studentName: 'ยศ-ชื่อ-นามสกุล ร้อยตรี อธิวัฒณ์ นิลศรี',
  };

  // ตารางวิชาและผลการฝึกอบรม
  displayRows: RowData[] = [];

  // ข้อมูลผลสรุปท้ายตาราง (แก้ไขได้)
  summaryData = {
    trainingTimePercent: '100',
    examTimePercent: '100',
    conductScore: '100',
    rank: '1',
    totalCredits: '78',
    gpa: '4.00',
    gradeCriteria: 'ดีเลิศ',
    result: 'สำเร็จการฝึกอบรม',
  };

  // ข้อมูลผู้ลงนาม (แก้ไขได้)
  signature1 = {
    rank: 'ร.ต.อ.',
    name: 'สมชาย เข็มกลัด',
    position1: 'ตำแหน่งที่ 1',
    position2: 'ตำแหน่งที่ 2',
    date: '1 มกราคม 2569',
  };

  signature2 = {
    rank: 'พ.ต.ท.',
    name: 'สมหญิง รักดี',
    position1: 'ตำแหน่งที่ 1',
    position2: 'ตำแหน่งที่ 2',
    date: '1 มกราคม 2569',
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private courseService: CourseService,
    private scoreService: ScoreService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.displayRows = this.getDefaultDisplayRows();
    this.fetchCourses();
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }

  // ==========================================
  // ดึงข้อมูลหลักสูตรและรุ่นจาก Backend
  // ==========================================
  fetchCourses(): void {
    this.isLoading = true;
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.courseGroups = res.data;

          // ตรวจสอบ query parameters ถ้าส่งมาจากหน้าอื่น
          this.route.queryParams.subscribe((params) => {
            const paramBatchId = params['batchId'];
            const paramCourseName = params['courseName'];

            if (paramCourseName && this.getUniqueCourseNames().includes(paramCourseName)) {
              this.selectedCourseName = paramCourseName;
            } else if (this.courseGroups.length > 0) {
              this.selectedCourseName = this.courseGroups[0].course_name;
            }

            if (this.selectedCourseName) {
              const batches = this.getBatchesForSelectedCourse();
              if (paramBatchId && batches.some((b) => Number(b.batch_id) === Number(paramBatchId))) {
                this.selectedBatchId = String(paramBatchId);
              } else if (batches.length > 0) {
                this.selectedBatchId = String(batches[0].batch_id);
              }

              if (this.selectedBatchId) {
                this.onBatchChange();
              }
            }
          });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching courses:', err);
        this.isLoading = false;
      },
    });
  }

  getUniqueCourseNames(): string[] {
    const names = this.courseGroups.map((g) => g.course_name);
    return Array.from(new Set(names));
  }

  getBatchesForSelectedCourse(): BatchItem[] {
    const group = this.courseGroups.find((g) => g.course_name === this.selectedCourseName);
    return group ? group.batches : [];
  }

  onCourseChange(): void {
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.currentIndex = 0;
    const batches = this.getBatchesForSelectedCourse();
    if (batches.length > 0) {
      this.selectedBatchId = String(batches[0].batch_id);
      this.onBatchChange();
    }
  }

  onBatchChange(): void {
    if (!this.selectedBatchId) {
      this.students = [];
      return;
    }

    const batches = this.getBatchesForSelectedCourse();
    this.selectedBatch = batches.find((b) => Number(b.batch_id) === Number(this.selectedBatchId)) || null;

    if (this.selectedBatch) {
      // ตั้งค่าหัวข้อหลักสูตรตามรุ่นจริง
      this.headerInfo.courseTitle = `${this.selectedCourseName} ${this.selectedBatch.batch_name} ประจำปีการศึกษา ${this.selectedBatch.curriculum_year || ''}`;

      if (this.selectedBatch.start_date && this.selectedBatch.end_date) {
        this.headerInfo.durationInfo = `ระยะเวลาการฝึกอบรม ตั้งแต่ ${this.formatThaiDate(this.selectedBatch.start_date)} ถึง ${this.formatThaiDate(this.selectedBatch.end_date)}`;
      }
    }

    this.isLoadingScores = true;
    const batchId = Number(this.selectedBatchId);

    this.scoreService.getBatchScoresSummary(batchId).subscribe({
      next: (res: any) => {
        if (res?.success && res.data && res.data.length > 0) {
          this.rawSubjectGroups = res.summary?.subjectGroups || [];
          this.batchTotalCredits = res.summary?.total_credit ? String(res.summary.total_credit) : '';

          this.students = res.data.map((st: any) => {
            const numGpa = Number(st.gpa);
            const gpa = !isNaN(numGpa) ? Math.min(4.0, Math.max(0, numGpa)).toFixed(2) : '0.00';
            return {
              ...st,
              id: st.student_id || st.id,
              name: st.full_name || `${st.rank_name || ''} ${st.first_name || ''} ${st.last_name || ''}`.trim(),
              gpa: gpa,
              totalCredit: st.totalCredit || this.batchTotalCredits || '',
              behaviorScore: st.behavior_score ?? st.behaviorScore ?? 100,
              trainingTimeScore: st.training_time_score ?? st.trainingTimeScore ?? 100,
              examTimeScore: st.exam_time_score ?? st.examTimeScore ?? 100,
            };
          });

          this.selectStudent(0);
        } else {
          this.rawSubjectGroups = [];
          this.batchTotalCredits = '';
          this.students = [];
          // ถ้าไม่มีข้อมูลในรุ่น ให้ใช้ค่าจำลองเดิม
          this.displayRows = this.getDefaultDisplayRows();
        }
        this.isLoadingScores = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Could not load batch scores, using default template:', err);
        this.rawSubjectGroups = [];
        this.batchTotalCredits = '';
        this.isLoadingScores = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectStudent(index: number | any): void {
    const idx = Number(index);
    if (isNaN(idx) || idx < 0 || idx >= this.students.length) return;

    this.currentIndex = idx;
    const st = this.students[idx];

    // ผูกข้อมูลนักเรียนจริง
    const rankTitle = st.rank_name ? st.rank_name + ' ' : '';
    const fullName = st.name || `${st.first_name || ''} ${st.last_name || ''}`;
    this.headerInfo.studentName = `ยศ-ชื่อ-นามสกุล ${rankTitle}${fullName}`;

    const numGpa = parseFloat(st.gpa || '0');
    let criteria = 'ตก';
    let resultText = 'ไม่สำเร็จการฝึกอบรม';

    if (numGpa >= 3.5) {
      criteria = 'ดีเลิศ';
      resultText = 'สำเร็จการฝึกอบรม';
    } else if (numGpa >= 3.0) {
      criteria = 'ดีมาก';
      resultText = 'สำเร็จการฝึกอบรม';
    } else if (numGpa >= 2.5) {
      criteria = 'ดี';
      resultText = 'สำเร็จการฝึกอบรม';
    } else if (numGpa >= 2.0) {
      criteria = 'พอใช้';
      resultText = 'สำเร็จการฝึกอบรม';
    }

    this.summaryData = {
      trainingTimePercent: String(st.trainingTimeScore || '100'),
      examTimePercent: String(st.examTimeScore || '100'),
      conductScore: String(st.behaviorScore || '100'),
      rank: String(st.ranking || st.rank || idx + 1),
      totalCredits: String(st.totalCredit || this.batchTotalCredits || '78'),
      gpa: String(st.gpa || '0.00'),
      gradeCriteria: criteria,
      result: resultText,
    };

    // อัปเดตผลการเรียนในตารางวิชา
    this.updateDisplayRowsWithStudentScores(st);
    this.cdr.detectChanges();
  }

  prevStudent(): void {
    if (this.currentIndex > 0) {
      this.selectStudent(this.currentIndex - 1);
    }
  }

  nextStudent(): void {
    if (this.currentIndex < this.students.length - 1) {
      this.selectStudent(this.currentIndex + 1);
    }
  }

  updateDisplayRowsWithStudentScores(st: any): void {
    if (this.rawSubjectGroups && this.rawSubjectGroups.length > 0) {
      this.displayRows = this.buildDisplayRowsFromBatch(this.rawSubjectGroups, st);
    } else {
      const rows = this.getDefaultDisplayRows();
      rows.forEach((row) => {
        if (row.left && !row.left.isHeader) {
          if (st.gpa && Number(st.gpa) > 0) {
            row.left.grade = Number(st.gpa) >= 2.0 ? 4 : 2;
          }
        }
        if (row.right && !row.right.isHeader) {
          if (st.gpa && Number(st.gpa) > 0) {
            row.right.grade = Number(st.gpa) >= 2.0 ? 4 : 2;
          }
        }
      });
      this.displayRows = rows;
    }
  }

  getStudentDisplayRows(st: any): RowData[] {
    if (this.rawSubjectGroups && this.rawSubjectGroups.length > 0) {
      return this.buildDisplayRowsFromBatch(this.rawSubjectGroups, st);
    }
    return this.displayRows;
  }

  // ==========================================
  // จัดเรียงและสร้างตารางผลการเรียนจากข้อมูลจริงของรุ่น (Dynamic Batch Subjects)
  // ==========================================
  getCategoryInfo(group: any): { name: string; order: number } {
    const code = (group.groupCode || group.group_name || group.groupName || '').trim().toUpperCase();
    const name = (group.group_name || group.groupName || '').trim();

    if (code.startsWith('MN') || name.includes('วิชารอง') || name.includes('รอง')) {
      return { name: 'วิชารอง', order: 2 };
    }
    if (code.startsWith('M') || name.includes('วิชาหลัก') || name.includes('หลัก')) {
      return { name: 'วิชาหลัก', order: 1 };
    }
    if (code.startsWith('S') || name.includes('วิชาประกอบ') || name.includes('ประกอบ')) {
      return { name: 'วิชาประกอบ', order: 3 };
    }
    if (code.startsWith('P') || name.includes('ภาคปฏิบัติ') || name.includes('ปฏิบัติ')) {
      return { name: 'ภาคปฏิบัติ', order: 4 };
    }
    return { name: 'วิชาทั่วไป', order: 5 };
  }

  getGroupGrade(student: any, group: any): string | number {
    if (!student) return 4;
    const grpId = group.groupId || group.id;
    const grpResult = student.group_results?.[grpId];
    if (grpResult) {
      if (grpResult.grade_point !== undefined && grpResult.grade_point !== null && grpResult.grade_point !== '') {
        return grpResult.grade_point;
      }
      const g = String(grpResult.grade || '').trim().toUpperCase();
      const map: Record<string, number | string> = {
        'A': 4,
        'B+': 3.5,
        'B': 3,
        'C+': 2.5,
        'C': 2,
        'D+': 1.5,
        'D': 1,
        'F': 0,
        'S': 'S',
        'U': 'U',
      };
      if (map[g] !== undefined) return map[g];
      if (grpResult.grade !== undefined && grpResult.grade !== null) return grpResult.grade;
    }
    if (student.gpa && Number(student.gpa) > 0) {
      return Number(student.gpa) >= 2.0 ? 4 : 2;
    }
    return 4;
  }

  buildDisplayRowsFromBatch(rawGroups: any[], student: any): RowData[] {
    if (!rawGroups || rawGroups.length === 0) {
      return this.getDefaultDisplayRows();
    }

    // คัดลอกและเรียงลำดับกลุ่มวิชาตามมาตรฐานหลักสูตรทหาร
    const groups = rawGroups.map((g) => ({
      ...g,
      subjects: g.subjects ? [...g.subjects] : [],
    }));

    groups.sort((a, b) => {
      const catA = this.getCategoryInfo(a);
      const catB = this.getCategoryInfo(b);
      if (catA.order !== catB.order) {
        return catA.order - catB.order;
      }
      const codeA = (a.groupCode || a.group_name || a.groupName || '').trim();
      const codeB = (b.groupCode || b.group_name || b.groupName || '').trim();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // จัดตามหมวดหมู่
    const catMap = new Map<string, any[]>();
    groups.forEach((g) => {
      const catName = this.getCategoryInfo(g).name;
      if (!catMap.has(catName)) {
        catMap.set(catName, []);
      }
      catMap.get(catName)!.push(g);
    });

    // แปลงแต่ละหมวดเป็นชุดแถวข้อมูล (CellItem)
    const catList: { name: string; items: CellItem[] }[] = [];
    catMap.forEach((grpList, catName) => {
      const items: CellItem[] = [{ isHeader: true, name: catName }];

      grpList.forEach((grp) => {
        const gradeVal = this.getGroupGrade(student, grp);
        const creditVal = grp.credit;

        if (grp.subjects && grp.subjects.length > 1) {
          // กลุ่มที่มีหลายวิชารวมกัน (มีปีกกา)
          items.push({
            name: grp.subjects[0].name,
            groupSize: grp.subjects.length,
            credit: creditVal,
            grade: gradeVal,
          });
          for (let i = 1; i < grp.subjects.length; i++) {
            items.push({
              name: grp.subjects[i].name,
              inGroup: true,
            });
          }
        } else if (grp.subjects && grp.subjects.length === 1) {
          // วิชาเดี่ยว
          items.push({
            name: grp.subjects[0].name,
            credit: creditVal,
            grade: gradeVal,
          });
        } else {
          // กรณีไม่มี subjects ย่อย
          items.push({
            name: grp.groupName || grp.groupCode || 'วิชา',
            credit: creditVal,
            grade: gradeVal,
          });
        }
      });

      catList.push({ name: catName, items });
    });

    const totalRows = catList.reduce((sum, c) => sum + c.items.length, 0);
    const leftCells: CellItem[] = [];
    const rightCells: CellItem[] = [];

    if (totalRows <= 32) {
      // สำหรับหลักสูตรที่พอดี 1 หน้า (เช่น 16 - 28 วิชา) แบ่งตามระดับหมวดหมู่โดยไม่แยกกลุ่ม
      let bestSplit = 1;
      let minDiff = Infinity;
      let leftCount = 0;

      for (let i = 0; i < catList.length; i++) {
        leftCount += catList[i].items.length;
        const rightCount = totalRows - leftCount;
        const diff = Math.abs(leftCount - rightCount);
        if (diff < minDiff && leftCount <= 26) {
          minDiff = diff;
          bestSplit = i + 1;
        }
      }

      for (let i = 0; i < bestSplit; i++) {
        leftCells.push(...catList[i].items);
      }
      for (let i = bestSplit; i < catList.length; i++) {
        rightCells.push(...catList[i].items);
      }
    } else {
      // สำหรับหลักสูตรขนาดใหญ่ (เช่น 47 วิชาขึ้นไป) แบ่งคอลัมน์ซ้าย-ขวาอย่างสมดุล โดยไม่ตัดปีกกากลางกลุ่ม
      const target = Math.ceil(totalRows / 2);

      for (const cat of catList) {
        if (leftCells.length + cat.items.length <= target + 2) {
          leftCells.push(...cat.items);
        } else if (leftCells.length < target - 2) {
          leftCells.push(cat.items[0]); // Header
          let idx = 1;
          while (idx < cat.items.length) {
            const item = cat.items[idx];
            const grpSize = item.groupSize || 1;
            if (leftCells.length + grpSize <= target + 1) {
              for (let g = 0; g < grpSize; g++) {
                leftCells.push(cat.items[idx + g]);
              }
              idx += grpSize;
            } else {
              break;
            }
          }
          while (idx < cat.items.length) {
            rightCells.push(cat.items[idx++]);
          }
        } else {
          rightCells.push(...cat.items);
        }
      }
    }

    // ประกบคอลัมน์ซ้ายและขวาเข้าด้วยกัน
    const maxLen = Math.max(leftCells.length, rightCells.length);
    const rows: RowData[] = [];
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        left: leftCells[i] || null,
        right: rightCells[i] || null,
      });
    }

    // รันหมายเลขลำดับ 1..N ต่อเนื่องจากซ้ายไปขวา (เว้นหัวข้อหมวด)
    let seqNo = 1;
    rows.forEach((r) => {
      if (r.left && !r.left.isHeader) {
        r.left.no = seqNo++;
      }
    });
    rows.forEach((r) => {
      if (r.right && !r.right.isHeader) {
        r.right.no = seqNo++;
      }
    });

    return rows;
  }

  // ==========================================
  // แถบเครื่องมือ Microsoft Word Toolbar Actions
  // ==========================================
  increaseFontSize(): void {
    const sizes = ['8pt', '8.5pt', '9pt', '9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
    const idx = sizes.indexOf(this.fontSize);
    if (idx < sizes.length - 1) {
      this.fontSize = sizes[idx + 1];
    }
  }

  decreaseFontSize(): void {
    const sizes = ['8pt', '8.5pt', '9pt', '9.5pt', '10pt', '10.5pt', '11pt', '12pt'];
    const idx = sizes.indexOf(this.fontSize);
    if (idx > 0) {
      this.fontSize = sizes[idx - 1];
    }
  }

  applyHeaderToAll(): void {
    Swal.fire({
      icon: 'success',
      title: 'นำข้อมูลไปใช้กับทุกคนสำเร็จ!',
      text: 'ข้อความส่วนหัว, คำสั่ง สส., วันที่ และข้อมูลผู้ลงนาม ถูกนำไปใช้กับนักเรียนทุกคนในรุ่นนี้เรียบร้อยแล้ว',
      timer: 2000,
      showConfirmButton: false,
    });
  }

  resetCurrentStudent(): void {
    if (this.students.length > 0) {
      this.selectStudent(this.currentIndex);
    } else {
      this.displayRows = this.getDefaultDisplayRows();
    }
    Swal.fire({
      icon: 'info',
      title: 'รีเซ็ตข้อมูลเดิมเรียบร้อย',
      timer: 1500,
      showConfirmButton: false,
    });
  }

  printTranscript(): void {
    window.print();
  }

  printAllStudents(): void {
    if (this.students.length === 0) return;
    this.isPrintingAll = true;
    setTimeout(() => {
      window.print();
      this.isPrintingAll = false;
      this.cdr.detectChanges();
    }, 500);
  }

  formatThaiDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const month = thaiMonths[d.getMonth()];
      const year = (d.getFullYear() + 543).toString().substring(2);
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  }

  braceHeight(groupSize: number | undefined): number {
    return (groupSize || 1) * this.rowHeightPx;
  }

  // ==========================================
  // ข้อมูลแม่แบบ 47 วิชาเริ่มต้น
  // ==========================================
  getDefaultDisplayRows(): RowData[] {
    return [
      {
        left: { isHeader: true, name: 'วิชาหลัก' },
        right: { no: 25, name: 'เหล่าทหาร', credit: 2, grade: 4 },
      },
      {
        left: { no: 1, name: 'ฝ่ายอำนวยการ', credit: 2, grade: 4 },
        right: { no: 26, name: 'การต่อต้านการก่อการร้าย', groupSize: 5, credit: 10, grade: 4 },
      },
      {
        left: { no: 2, name: 'ฝ่ายอำนวยการทางการสื่อสาร', groupSize: 3, credit: 6, grade: 4 },
        right: { no: 27, name: 'การปฏิบัติการเพื่อสันติภาพ', inGroup: true },
      },
      {
        left: { no: 3, name: 'หลักพื้นฐานการรบและโครงร่างสนามรบ', inGroup: true },
        right: { no: 28, name: 'กองทัพเรือ,กองทัพอากาศ', inGroup: true },
      },
      {
        left: { no: 4, name: 'ระเบียบการนำหน่วย', inGroup: true },
        right: { no: 29, name: 'การปฏิบัติการร่วม/ผสม', inGroup: true },
      },
      {
        left: { no: 5, name: 'องค์แทนการสื่อสาร', groupSize: 4, credit: 8, grade: 4 },
        right: { no: 30, name: 'การบินทหารบก', inGroup: true },
      },
      {
        left: { no: 6, name: 'หลักนิยมการสื่อสารทางยุทธวิธี', inGroup: true },
        right: { isHeader: true, name: 'วิชาประกอบ' },
      },
      {
        left: { no: 7, name: 'การปฏิบัติงานของพัน ส.พล.ทางยุทธวิธี', inGroup: true },
        right: { no: 31, name: 'ระเบียบงานสารบรรณ', credit: 2, grade: 4 },
      },
      {
        left: { no: 8, name: 'การสื่อสารทางยุทธวิธีระดับกองพล', inGroup: true },
        right: { no: 32, name: 'ประมุขศิลป์', groupSize: 8, credit: 16, grade: 4 },
      },
      {
        left: { no: 9, name: 'การส่งกำลังและซ่อมบำรุงสายสื่อสาร', credit: 2, grade: 4 },
        right: { no: 33, name: 'อุดมการณ์ทหาร', inGroup: true },
      },
      {
        left: { no: 10, name: 'การสื่อสารประเภทวิทยุ', credit: 2, grade: 4 },
        right: { no: 34, name: 'อุดมการณ์ความรักชาติ', inGroup: true },
      },
      {
        left: { no: 11, name: 'การสื่อสารประเภทสาย', credit: 2, grade: 4 },
        right: { no: 35, name: 'การศาสนาและศีลธรรม', inGroup: true },
      },
      {
        left: { no: 12, name: 'สงครามอิเล็กทรอนิกส์', credit: 2, grade: 4 },
        right: { no: 36, name: 'กฎหมายที่เกี่ยวข้องกับทหาร', inGroup: true },
      },
      {
        left: { no: 13, name: 'การพัฒนาทักษะดิจิทัลที่จำเป็นระดับสูง', credit: 2, grade: 4 },
        right: { no: 37, name: 'ค่านิยม 12 ประการ', inGroup: true },
      },
      {
        left: { no: 14, name: 'การบบรยายสรุปทางการ', groupSize: 3, credit: 6, grade: 4 },
        right: { no: 38, name: 'ครูทหาร', inGroup: true },
      },
      {
        left: { no: 15, name: 'อิเล็กทรอนิกส์ และ IOT เบื้องต้น', inGroup: true },
        right: { no: 39, name: 'หน้าที่พลเมืองดี', inGroup: true },
      },
      {
        left: { no: 16, name: 'การจัดการฝึก', inGroup: true },
        right: { no: 40, name: 'พื้นฐานการวิจัย', groupSize: 4, credit: 8, grade: 4 },
      },
      {
        left: { no: 17, name: 'การปฏิบัติการที่ใช้เครือข่ายเป็นศูนย์กลาง', groupSize: 3, credit: 6, grade: 4 },
        right: { no: 41, name: 'จิตอาสา', inGroup: true },
      },
      {
        left: { no: 18, name: 'กิจการกระจายเสียงและกิจการโทรทัศน์ของ ทบ. ', inGroup: true },
        right: { no: 42, name: 'ต่อต้านการทุจริต', inGroup: true },
      },
      {
        left: { no: 19, name: 'การปฏิบัติการสานสนเทศ', inGroup: true },
        right: { no: 43, name: 'ประวัติศาสตร์ทหาร', inGroup: true },
      },
      {
        left: { no: 20, name: 'ภาษาอังกฤษทางทหาร', credit: 2, grade: 4 },
        right: { no: 44, name: 'การจัดกองทัพบก', credit: 2, grade: 4 },
      },
      {
        left: { isHeader: true, name: 'วิชารอง' },
        right: { no: 45, name: 'การบรรยายโดยผู้ทรงคุณวุฒิ', credit: 2, grade: 4 },
      },
      {
        left: { no: 21, name: 'แผนที่เข็มทิศ', groupSize: 4, credit: 8, grade: 4 },
        right: { isHeader: true, name: 'ภาคปฏิบัติ' },
      },
      {
        left: { no: 22, name: 'การป้องกันปราบปรามการก่อความไม่สงบ', inGroup: true },
        right: { no: 46, name: 'การเรียน/ฝึกร่วมระหว่างเหล่า ร., ม., ป., ช., ส.', credit: 2, grade: 4 },
      },
      {
        left: { no: 23, name: 'ปลัดบัญชี', inGroup: true },
        right: { no: 47, name: 'การฝึกภาคสนามการสื่อสารทางยุทธวิธี', credit: 2, grade: 4 },
      },
      {
        left: { no: 24, name: 'การรักษาความปลอดภัย', inGroup: true },
        right: null,
      },
    ];
  }
}
