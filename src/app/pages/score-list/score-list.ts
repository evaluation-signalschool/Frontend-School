import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { DropdownService } from '../../services/dropdown.service';
import { ScoreService } from '../../services/score.service';
import { CourseService, CourseGroup } from '../../services/course.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

interface Batch {
  id: number;
  name: string;
}

interface SubjectItem {
  id?: number;
  subject_id?: number;
  name?: string;
  subject_name?: string;
  group_id?: number;
}

interface SubjectColumn {
  subject_id: number;
  subject_name: string;
  max_score: number;
  is_su?: boolean;
}

interface StudentResult {
  student_id: number;
  student_code: string;
  full_name: string;
  total_raw_score: string;
  total_max_score: number;
  percent: string;
  grade: string;
  grade_point: number;
  index_value: string;
  subject_scores: { [subjectId: number]: number }; // เก็บพจนานุกรมคะแนนแต่ละวิชา
}

interface GroupSummary {
  group_name: string;
  total_credit: number;
  total_max_score: number;
  subjects_list_text: string;
  subjects: SubjectColumn[]; // เก็บรายวิชาเพื่อเอาไปวนลูปสร้างคอลัมน์
  is_su?: boolean;
}

@Component({
  selector: 'app-score-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    RouterModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './score-list.html',
  styleUrl: './score-list.scss',
})
export class ScoreList implements OnInit {
  // Dropdown state
  courseGroups: CourseGroup[] = [];
  selectedCourse: any = 'all';
  batches: Batch[] = [];
  selectedBatch: number | null = null;
  subjectsList: SubjectItem[] = [];
  selectedSubjectId: number | null = null;

  // Table data
  students: StudentResult[] = [];
  groupSummary: GroupSummary | null = null;
  lastProcessedTime: string = '';
  isLoading: boolean = false;
  errorMsg: string = '';

  private cdr = inject(ChangeDetectorRef);

  constructor(
    private courseService: CourseService,
    private dropdownService: DropdownService,
    private scoreService: ScoreService,
  ) {}

  ngOnInit(): void {
    this.loadCourses();
    this.updateProcessedTime();
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Failed to load courses', err),
    });
  }

  onCourseChange(): void {
    this.selectedBatch = null;
    this.selectedSubjectId = null;
    this.batches = [];
    this.subjectsList = [];
    this.students = [];
    this.groupSummary = null;

    if (this.selectedCourse && this.selectedCourse !== 'all') {
      const courseGroup = this.courseGroups.find(
        (c) =>
          c.batches?.[0]?.course_id == this.selectedCourse || c.course_name === this.selectedCourse,
      );
      if (courseGroup) {
        this.batches = courseGroup.batches.map((b) => ({
          id: b.batch_id,
          name: b.batch_name,
        }));
      }
    }
    this.cdr.detectChanges();
  }

  onBatchChange(): void {
    this.selectedSubjectId = null;
    this.subjectsList = [];
    this.students = [];
    this.groupSummary = null;
    this.cdr.detectChanges();

    if (this.selectedBatch) {
      this.loadSubjectsDropdown(this.selectedBatch);
    }
  }

  loadSubjectsDropdown(batchId: number): void {
    this.dropdownService.getSubjects(batchId).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.subjectsList = res.data.map((s: any) => ({
            id: s.id || s.subject_id,
            subject_name: s.subject_name || s.name || 'ไม่มีชื่อวิชา', // 👈 ดักชื่อวิชาไว้
            group_id: s.group_id, // 👈 สำคัญมาก! ต้องเก็บ group_id ของวิชานี้ไว้ด้วย
          }));
          this.cdr.detectChanges();
          console.log('โหลดรายวิชาสำเร็จ:', this.subjectsList); // แอบดูข้อมูลใน Console
        }
      },
      error: (err) => console.error('Failed to load subjects', err),
    });
  }

  onSubjectChange(): void {
    this.students = [];
    this.groupSummary = null;
    this.cdr.detectChanges();

    // ค้นหาวิชาที่ผู้ใช้เพิ่งกดเลือกจาก Dropdown
    const selectedSubj = this.subjectsList.find((s) => s.id === this.selectedSubjectId);

    // ถ้าวิชานั้นมี group_id ให้ใช้เลย แต่ถ้าไม่มี ให้ใช้ id ตัวมันเองแทน
    const groupId = selectedSubj?.group_id || selectedSubj?.id;

    if (this.selectedBatch && groupId) {
      this.loadResults(groupId); // ส่ง groupId ไปให้ API Backend คำนวณรวบยอด!
    }
  }

  loadResults(groupId: number): void {
    if (!this.selectedBatch || !groupId) return;
    this.isLoading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.scoreService.getProcessGroupScores(this.selectedBatch, groupId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.students = res.data;
          this.groupSummary = res.summary;
          if (this.groupSummary && this.groupSummary.subjects && this.groupSummary.subjects.length > 0) {
            this.groupSummary.is_su = this.groupSummary.subjects.every(s => s.is_su);
          }
          this.updateProcessedTime();
        } else {
          this.students = [];
          this.groupSummary = null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Failed to load results', err);
        this.errorMsg = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  reProcess(): void {
    // 👈 เปลี่ยนมาหาค่าจาก selectedSubjectId เหมือนกัน
    const selectedSubj = this.subjectsList.find((s) => s.id === this.selectedSubjectId);
    const groupId = selectedSubj?.group_id || selectedSubj?.id;

    if (groupId) {
      this.loadResults(groupId);
    }
  }

  exportToExcel(): void {
    if (!this.students || this.students.length === 0) {
      return;
    }

    // 1. สร้าง Headers
    const headers = ['ลำดับ', 'ยศ ชื่อ-นามสกุล'];
    const subjects = this.groupSummary?.subjects || [];
    
    // เติมชื่อวิชา
    subjects.forEach(subj => {
      headers.push(subj.subject_name + (subj.is_su ? ' (S/U)' : ` (เต็ม ${subj.max_score})`));
    });

    // เติมคอลัมน์สรุป
    headers.push('คิดเป็นร้อยละ', 'เกรด (ตัวอักษร)', 'เกรด (ตัวเลข)', 'ค่าประกอบ Index');

    // 2. สร้างข้อมูลทีละแถว
    const csvData = this.students.map((student, index) => {
      const row = [
        index + 1,
        student.full_name || ''
      ];

      // เติมคะแนนแต่ละวิชา
      subjects.forEach(subj => {
        const score = student.subject_scores[subj.subject_id];
        if (score !== undefined && score !== null) {
          if (subj.is_su) {
            row.push(score > 0 ? 'S' : 'U');
          } else {
            row.push(score);
          }
        } else {
          row.push('-');
        }
      });

      // เติมข้อมูลสรุป
      row.push(
        student.percent !== undefined ? student.percent + '%' : '-',
        student.grade || '-',
        student.grade_point !== undefined && student.grade_point !== null ? student.grade_point : '-',
        student.index_value || '-'
      );

      return row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    // 3. รวม Header กับ Data
    const csvContent = [headers.map(h => `"${h}"`).join(','), ...csvData].join('\n');

    // 4. เพิ่ม BOM สำหรับภาษาไทยใน Excel
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 5. สร้างลิ้งค์สำหรับดาวน์โหลด
    const groupName = this.groupSummary?.group_name || 'ประมวลผลการเรียน';
    const batchName = this.batches.find(b => b.id === this.selectedBatch)?.name || '';
    const filename = `สรุปผล_${groupName}_${batchName}.csv`.replace(/\s+/g, '_');

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private updateProcessedTime(): void {
    const now = new Date();
    this.lastProcessedTime =
      now.toLocaleDateString('th-TH') + ' เวลา ' + now.toLocaleTimeString('th-TH') + ' น.';
  }
}
