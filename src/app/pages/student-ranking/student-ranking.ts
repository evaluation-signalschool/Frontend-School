import { Component, OnInit, ChangeDetectorRef, ApplicationRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { timeout, catchError, of } from 'rxjs';
import { CourseService, CourseGroup } from '../../services/course.service';
import { DropdownService } from '../../services/dropdown.service';
import { ScoreService } from '../../services/score.service';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

export interface SubjectOption {
  id: number;
  name: string;
  max_score: number;
  group_name?: string;
  is_su?: boolean;
  selected: boolean;
}

export interface TiedGroup {
  groupId: number;
  gpa: string;
  studentCount: number;
  color: { bg: string; border: string; text: string; label: string };
  isResolved: boolean;
  minRank: number;
  maxRank: number;
  studentCodes: string;
}

export interface RankedStudent {
  student_id: number;
  student_code: string;
  rank_name: string;
  first_name: string;
  last_name: string;
  full_name: string;
  gpa: string;
  total_raw_score: number;
  total_max_score: number;
  tieBreakScore: number;
  tieBreakMaxScore: number;
  training_time_score: number;
  exam_time_score: number;
  behavior_score: number;
  calculatedRank: number | null;
  manualRank: number | null;
  tieBreakReason: string;
  isTiedGpa: boolean;
  isTrulyTied?: boolean;
  tiedGroupId?: number;
  tiedGroupColor?: string;
  tiedGroupBg?: string;
  tiedGroupText?: string;
  tiedGroupCount?: number;
  scoredSubjectsCount?: number;
  is_completed?: boolean;
  completion_text?: string;
  completed_subjects_count?: number;
  total_curriculum_subjects?: number;
  subject_scores: Record<number, number>;
}

@Component({
  selector: 'app-student-ranking',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './student-ranking.html',
  styleUrl: './student-ranking.scss',
})
export class StudentRanking implements OnInit {
  private courseService = inject(CourseService);
  private dropdownService = inject(DropdownService);
  private scoreService = inject(ScoreService);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private triggerViewUpdate(): void {
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  // Filters
  courses: { id: any; group_name: string }[] = [];
  selectedCourse: any = '';
  batches: { id: any; name: string }[] = [];
  selectedBatch: any = '';

  // Data states
  courseGroups: CourseGroup[] = [];
  availableSubjects: SubjectOption[] = [];
  rankedStudents: RankedStudent[] = [];
  rawStudentsData: any[] = [];
  isLoading: boolean = false;
  isTableLoading: boolean = false;
  isRecalculating: boolean = false;
  hasPendingSubjectChanges: boolean = false;
  appliedSubjectCount: number = 0;
  isTieBreakPanelOpen: boolean = true;
  hasManualAdjustments: boolean = false;
  hasTiedUnresolved: boolean = false;

  // View and Filter states (สลับดูแบบเรียงตามลำดับที่ VS เรียงตามเลขที่)
  viewMode: 'by-rank' | 'by-code' = 'by-rank';
  filterMode: string = 'all'; // 'all' | 'tied-only' | 'group:1' | 'gpa:3.50'
  tiedGroups: TiedGroup[] = [];

  // Color palettes for distinct tied clusters
  private readonly GROUP_PALETTES = [
    { bg: '#fffbe6', border: '#fa8c16', text: '#d46b08', label: 'สีส้มทอง' },
    { bg: '#f9f0ff', border: '#9254de', text: '#531dab', label: 'สีม่วงพาสเทล' },
    { bg: '#e6fffb', border: '#13c2c2', text: '#006d75', label: 'สีฟ้าอมเขียวทีล' },
    { bg: '#fff0f6', border: '#f759ab', text: '#9e1068', label: 'สีชมพูโรส' },
    { bg: '#e6f7ff', border: '#1890ff', text: '#003a8c', label: 'สีน้ำเงินสกาย' },
    { bg: '#fcffe6', border: '#7cb305', text: '#389e0d', label: 'สีเขียวมะนาว' },
    { bg: '#fff2e8', border: '#ff4d4f', text: '#a8071a', label: 'สีแดงปะการัง' },
  ];

  // Statistics
  totalStudents: number = 0;
  completedCount: number = 0;
  incompleteCount: number = 0;
  topPerformer: RankedStudent | null = null;
  avgGpa: string = '0.00';
  tiedCount: number = 0;

  get displayedStudents(): RankedStudent[] {
    let list = [...this.rankedStudents];

    if (this.filterMode === 'tied-only') {
      list = list.filter((s) => s.isTiedGpa && s.is_completed !== false);
    } else if (this.filterMode === 'incomplete-only') {
      list = list.filter((s) => s.is_completed === false);
    } else if (this.filterMode === 'complete-only') {
      list = list.filter((s) => s.is_completed !== false);
    } else if (this.filterMode.startsWith('group:')) {
      const gId = parseInt(this.filterMode.replace('group:', ''), 10);
      list = list.filter((s) => s.tiedGroupId === gId);
    } else if (this.filterMode.startsWith('gpa:')) {
      const targetGpa = this.filterMode.replace('gpa:', '');
      list = list.filter((s) => s.gpa === targetGpa);
    }

    if (this.viewMode === 'by-code') {
      list.sort((a, b) => {
        const codeA = parseInt(a.student_code, 10);
        const codeB = parseInt(b.student_code, 10);
        if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
        return a.student_code.localeCompare(b.student_code);
      });
    } else {
      list.sort((a, b) => {
        // Complete students first (1..N), incomplete students at the bottom
        if (a.is_completed !== false && b.is_completed === false) return -1;
        if (a.is_completed === false && b.is_completed !== false) return 1;
        if (a.manualRank != null && b.manualRank != null) {
          return a.manualRank - b.manualRank;
        }
        if (a.manualRank != null) return -1;
        if (b.manualRank != null) return 1;
        return (Number(b.gpa) || 0) - (Number(a.gpa) || 0);
      });
    }

    return list;
  }

  setViewMode(mode: 'by-rank' | 'by-code'): void {
    this.viewMode = mode;
  }

  setFilterMode(mode: string): void {
    this.filterMode = mode;
  }

  getGroupStudentCodes(groupId?: number): string {
    if (!groupId) return '';
    const found = this.tiedGroups.find((g) => g.groupId === groupId);
    return found ? found.studentCodes : '';
  }

  ngOnInit(): void {
    this.loadCourses();

    // Support queryParams if coming from class-overview
    this.route.queryParams.subscribe((params) => {
      if (params['courseId']) {
        this.selectedCourse = params['courseId'];
      }
      if (params['batchId']) {
        this.selectedBatch = Number(params['batchId']);
      }
    });
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.courseGroups = res.data;
          this.courses = res.data.map((cg: CourseGroup) => ({
            id: cg.batches?.[0]?.course_id || cg.course_name,
            group_name: cg.course_name,
          }));

          if (this.selectedCourse) {
            this.onCourseChange(false);
          }
          this.triggerViewUpdate();
        }
      },
      error: (err) => {
        console.error('Failed to load courses:', err);
      },
    });
  }

  onCourseChange(resetBatch: boolean = true): void {
    if (resetBatch) {
      this.selectedBatch = '';
      this.rankedStudents = [];
      this.availableSubjects = [];
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
    }
    this.batches = [];

    if (!this.selectedCourse) {
      this.triggerViewUpdate();
      return;
    }

    const courseGroup = this.courseGroups.find(
      (c) =>
        c.batches?.[0]?.course_id == this.selectedCourse ||
        c.course_name === this.selectedCourse
    );

    if (courseGroup && courseGroup.batches && courseGroup.batches.length > 0) {
      this.batches = courseGroup.batches.map((b) => ({
        id: b.batch_id,
        name: b.batch_name || `รุ่นที่ ${b.batch_id}`,
      }));
      if (this.selectedBatch) {
        this.onBatchChange();
      }
      this.triggerViewUpdate();
    } else {
      this.dropdownService.getBatches(this.selectedCourse).subscribe({
        next: (res) => {
          if (res?.success && res.data) {
            this.batches = res.data.map((b: any) => ({
              id: b.id || b.batch_id,
              name: b.name || b.batch_name || `รุ่นที่ ${b.id || b.batch_id}`,
            }));
            if (this.selectedBatch) {
              this.onBatchChange();
            }
            this.triggerViewUpdate();
          }
        },
        error: (err) => {
          console.error('Failed to load batches:', err);
          this.triggerViewUpdate();
        },
      });
    }
  }

  onBatchChange(): void {
    if (!this.selectedBatch) {
      this.rankedStudents = [];
      this.availableSubjects = [];
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
      this.triggerViewUpdate();
      return;
    }

    this.availableSubjects = [];
    this.calculateRanking(true);
  }

  // --- จัดการการเลือกวิชาสำหรับคิดคะแนนตัดสิน (Tie-Breaking Subjects) ---
  // เมื่อผู้ใช้ติ๊กเลือกวิชา จะยังไม่ประมวลผลทันที เพื่อไม่ให้หน้ารีเฟรชหรือตัวหมุนกวนใจ
  onSubjectToggle(): void {
    this.hasPendingSubjectChanges = true;
  }

  selectAllSubjects(select: boolean): void {
    this.availableSubjects.forEach((s) => (s.selected = select));
    this.hasPendingSubjectChanges = true;
  }

  selectMainSubjectsOnly(): void {
    this.availableSubjects.forEach((s) => {
      const gName = (s.group_name || '').toUpperCase();
      s.selected =
        (gName.startsWith('M') && !gName.startsWith('MN')) ||
        gName.includes('หลัก');
    });
    this.hasPendingSubjectChanges = true;
  }

  selectGradeSubjectsOnly(): void {
    this.availableSubjects.forEach((s) => (s.selected = !s.is_su));
    this.hasPendingSubjectChanges = true;
  }

  getSelectedSubjectsCount(): number {
    return this.availableSubjects.filter((s) => s.selected).length;
  }

  getSelectedSubjectsText(): string {
    const selected = this.availableSubjects.filter((s) => s.selected);
    if (selected.length === 0) return 'ไม่ได้เลือกวิชาตัดสิน (จัดอันดับตาม GPA เท่านั้น)';
    if (selected.length <= 3) {
      return selected.map((s) => s.name).join(', ');
    }
    return `${selected.slice(0, 3).map((s) => s.name).join(', ')} และอีก ${selected.length - 3} วิชา`;
  }

  // --- ปุ่มคำสั่งประมวลผลการจัดอันดับใหม่ (Recalculate Ranking) ---
  // เมื่อกดปุ่มนี้ ส่วนตารางด้านล่างจะวาดหน้าใหม่พร้อมคำนวณอันดับตามวิชาที่เลือกทันที
  applyRecalculateRanking(): void {
    if (!this.selectedBatch) return;

    const batchId = Number(this.selectedBatch);
    const selectedSubIds = this.availableSubjects
      .filter((s) => s.selected)
      .map((s) => s.id);

    // เปิดสถานะโหลดเฉพาะตารางด้านล่างเพื่อให้ผู้ใช้เห็นว่าระบบกำลังประมวลผล (แผงเลือกวิชาด้านบนไม่ปิด)
    this.isTableLoading = true;
    this.isRecalculating = true;
    this.triggerViewUpdate();

    // หากมีข้อมูลนักเรียนในเครื่องแล้ว ให้คำนวณและวาดหน้าใหม่อย่างรวดเร็ว (แสดง Loading 250ms ให้ผู้ใช้เห็นการอัปเดตอย่างชัดเจน)
    if (this.rawStudentsData && this.rawStudentsData.length > 0) {
      setTimeout(() => {
        this.calculateRankingLocal();
        this.appliedSubjectCount = selectedSubIds.length;
        this.isTableLoading = false;
        this.isRecalculating = false;
        this.hasPendingSubjectChanges = false;
        this.triggerViewUpdate();

        const toastText = selectedSubIds.length > 0
          ? `ใช้เกณฑ์วิชาที่เลือก ${selectedSubIds.length} วิชาในการประมวลผล`
          : `ไม่ได้เลือกวิชาตัดสิน (จัดอันดับตาม GPA เท่านั้น)`;

        Swal.fire({
          icon: selectedSubIds.length > 0 ? 'success' : 'info',
          title: 'คำนวณและจัดอันดับใหม่เรียบร้อยแล้ว',
          text: toastText,
          timer: 1400,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      }, 250);

      // ส่งไปบันทึก/ซิงค์กับ Backend เบื้องหลัง โดยไม่บล็อกหน้าจอผู้ใช้
      this.scoreService.getBatchRanking(batchId, selectedSubIds).subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            this.rawStudentsData = res.data;
          }
        },
        error: (err) => {
          console.warn('Backend sync error (ranking already applied locally):', err);
        },
      });
      return;
    }

    // หากยังไม่มีข้อมูล (กรณีเข้าสู่หน้าครั้งแรก) ให้ดึงจาก Backend
    this.scoreService
      .getBatchRanking(batchId, selectedSubIds)
      .subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            this.rankedStudents = res.data;
            this.rawStudentsData = res.data;
            this.tiedGroups = res.tiedGroups || [];
            this.totalStudents = res.summary?.total_students ?? res.data.length;
            this.completedCount = res.summary?.completed_students ?? res.data.filter((s: any) => s.is_completed).length;
            this.incompleteCount = res.summary?.incomplete_students ?? res.data.filter((s: any) => !s.is_completed).length;
            this.appliedSubjectCount = selectedSubIds.length;

            const completedList = res.data.filter((s: any) => s.is_completed);
            this.topPerformer = completedList.length > 0 ? completedList[0] : null;
            this.tiedCount = res.summary?.tiedCount ?? res.data.filter((s: any) => s.isTiedGpa && s.is_completed).length;
            this.hasTiedUnresolved = (res.summary?.unresolvedTies || 0) > 0;
            this.hasManualAdjustments = false;

            if (completedList.length > 0) {
              const sumGpa = completedList.reduce((acc: number, curr: any) => acc + (Number(curr.gpa) || 0), 0);
              this.avgGpa = (sumGpa / completedList.length).toFixed(2);
            } else {
              this.avgGpa = '0.00';
            }
          } else {
            this.calculateRankingLocal();
          }

          this.appliedSubjectCount = selectedSubIds.length;
          this.isTableLoading = false;
          this.isRecalculating = false;
          this.hasPendingSubjectChanges = false;

          const toastText = selectedSubIds.length > 0
            ? `ใช้เกณฑ์วิชาที่เลือก ${selectedSubIds.length} วิชาในการประมวลผล`
            : `ไม่ได้เลือกวิชาตัดสิน (จัดอันดับตาม GPA เท่านั้น)`;

          Swal.fire({
            icon: selectedSubIds.length > 0 ? 'success' : 'info',
            title: 'คำนวณและจัดอันดับใหม่เรียบร้อยแล้ว',
            text: toastText,
            timer: 1400,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
          });

          this.triggerViewUpdate();
        },
        error: () => {
          this.calculateRankingLocal();
          this.appliedSubjectCount = selectedSubIds.length;
          this.isTableLoading = false;
          this.isRecalculating = false;
          this.hasPendingSubjectChanges = false;
          this.triggerViewUpdate();
        },
      });
  }

  // --- คำนวณอันดับและแก้ไขลำดับซ้ำ (ย้ายมาคำนวณที่ Backend รวดเร็วใน Single Call) ---
  calculateRanking(isBatchInit: boolean = false): void {
    if (!this.selectedBatch) {
      this.rankedStudents = [];
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
      this.triggerViewUpdate();
      return;
    }

    const batchId = Number(this.selectedBatch);
    const subjectIdsParam = isBatchInit ? undefined : this.availableSubjects.filter((s) => s.selected).map((s) => s.id);

    this.isLoading = true;
    this.isTableLoading = true;
    this.triggerViewUpdate();

    this.scoreService.getBatchRanking(batchId, subjectIdsParam).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.isTableLoading = false;
        this.isRecalculating = false;
        this.hasPendingSubjectChanges = false;
        if (res?.success && res.data) {
          this.rankedStudents = res.data;
          this.rawStudentsData = res.data;
          this.tiedGroups = res.tiedGroups || [];
          this.totalStudents = res.summary?.total_students ?? res.data.length;
          this.completedCount = res.summary?.completed_students ?? res.data.filter((s: any) => s.is_completed).length;
          this.incompleteCount = res.summary?.incomplete_students ?? res.data.filter((s: any) => !s.is_completed).length;
          this.appliedSubjectCount = res.summary?.selected_subjects_count ?? (subjectIdsParam?.length ?? 0);

          const completedList = res.data.filter((s: any) => s.is_completed);
          this.topPerformer = completedList.length > 0 ? completedList[0] : null;

          this.tiedCount = res.summary?.tiedCount ?? res.data.filter((s: any) => s.isTiedGpa && s.is_completed).length;
          this.hasTiedUnresolved = (res.summary?.unresolvedTies || 0) > 0;
          this.hasManualAdjustments = false;

          // ถ้าเพิ่งเลือกรุ่นใหม่ ให้ตั้งค่ารายการวิชาให้ติ๊กเลือกจากข้อมูลที่ Backend ส่งกลับมา
          if ((isBatchInit || this.availableSubjects.length === 0) && res.availableSubjects && res.availableSubjects.length > 0) {
            this.availableSubjects = res.availableSubjects.map((sub: any) => {
              const gName = (sub.group_name || '').toUpperCase();
              const isMain =
                (gName.startsWith('M') && !gName.startsWith('MN')) ||
                (sub.group_name || '').includes('หลัก');

              const isSel = sub.selected !== undefined ? Boolean(sub.selected) : isMain;

              return {
                id: sub.id,
                name: sub.name,
                max_score: Number(sub.max_score) || 0,
                group_name: sub.group_name || '',
                is_su: Boolean(sub.is_su),
                selected: isSel,
              };
            });

            // ถ้าไม่มีวิชาหลัก ให้เลือกวิชาทั้งหมดที่ไม่ใช่ S/U เป็นค่าเริ่มต้น
            if (!this.availableSubjects.some((s) => s.selected)) {
              this.availableSubjects.forEach((s) => (s.selected = !s.is_su));
            }

            this.appliedSubjectCount = this.availableSubjects.filter((s) => s.selected).length;
          }

          // คำนวณ GPA เฉลี่ยเฉพาะคนที่เรียนครบสมบูรณ์
          if (completedList.length > 0) {
            const sumGpa = completedList.reduce((acc: number, curr: any) => acc + (Number(curr.gpa) || 0), 0);
            this.avgGpa = (sumGpa / completedList.length).toFixed(2);
          } else {
            this.avgGpa = '0.00';
          }
        } else {
          this.calculateRankingLocal();
        }
        this.triggerViewUpdate();
      },
      error: (err: any) => {
        console.warn('Backend getBatchRanking failed, falling back to local calculation:', err);
        this.isLoading = false;
        this.isTableLoading = false;
        this.isRecalculating = false;
        this.calculateRankingLocal();
        this.triggerViewUpdate();
      },
    });
  }

  // Fallback กรณี Backend ออฟไลน์ หรือยังอยู่ในช่วง Deploy
  calculateRankingLocal(): void {
    this.isLoading = false;
    this.isTableLoading = false;
    this.isRecalculating = false;
    if (!this.rawStudentsData || this.rawStudentsData.length === 0) {
      this.rankedStudents = [];
      this.triggerViewUpdate();
      return;
    }

    const selectedSubIds = new Set(
      this.availableSubjects.filter((s) => s.selected).map((s) => s.id)
    );

    const totalCurriculumSubjects = this.availableSubjects.length;

    // คำนวณคะแนนรวมวิชาที่เลือกให้แต่ละคน
    const students: RankedStudent[] = this.rawStudentsData.map((st: any) => {
      let tieBreakScore = 0;
      let tieBreakMaxScore = 0;
      let scoredCount = 0;

      this.availableSubjects.forEach((sub) => {
        if (selectedSubIds.has(sub.id)) {
          const rawScore = st.subject_scores ? st.subject_scores[sub.id] : undefined;
          if (rawScore !== undefined && rawScore !== null && !isNaN(Number(rawScore))) {
            tieBreakScore += Number(rawScore);
            scoredCount++;
          }
          tieBreakMaxScore += sub.max_score;
        }
      });

      // ความครบถ้วนของรายวิชา (ใช้ผลการตรวจจาก Backend หากมี)
      const isCompleted = st.is_completed !== undefined
        ? Boolean(st.is_completed)
        : (totalCurriculumSubjects > 0
            ? ((st.scored_subjects_count || 0) >= Math.max(1, totalCurriculumSubjects - 3))
            : true);

      const completionText = st.completion_text || `${st.scored_subjects_count || 0}/${totalCurriculumSubjects}`;

      return {
        student_id: st.student_id || st.id,
        student_code: String(st.student_code || st.code || '').padStart(2, '0'),
        rank_name: st.rank_name || '',
        first_name: st.first_name || '',
        last_name: st.last_name || '',
        full_name: st.full_name || `${st.rank_name || ''} ${st.first_name || ''} ${st.last_name || ''}`.trim(),
        gpa: !isNaN(Number(st.gpa)) ? Math.min(4.0, Math.max(0, Number(st.gpa))).toFixed(2) : '0.00',
        total_raw_score: Number(st.total_raw_score) || 0,
        total_max_score: Number(st.total_max_score) || 0,
        tieBreakScore: tieBreakScore,
        tieBreakMaxScore: tieBreakMaxScore,
        training_time_score: Number(st.training_time_score) || 0,
        exam_time_score: Number(st.exam_time_score) || 0,
        behavior_score: Number(st.behavior_score) || 0,
        calculatedRank: null,
        manualRank: null,
        tieBreakReason: '',
        isTiedGpa: false,
        scoredSubjectsCount: scoredCount,
        is_completed: isCompleted,
        completion_text: completionText,
        completed_subjects_count: st.scored_subjects_count || 0,
        total_curriculum_subjects: totalCurriculumSubjects,
        subject_scores: st.subject_scores || {},
      };
    });

    const completeStudents = students.filter((s) => s.is_completed);
    const incompleteStudents = students.filter((s) => !s.is_completed);

    // 1. ตรวจสอบกลุ่มที่ GPA เท่ากันเฉพาะในกลุ่ม complete
    const gpaMap = new Map<string, RankedStudent[]>();
    completeStudents.forEach((s) => {
      if (!gpaMap.has(s.gpa)) {
        gpaMap.set(s.gpa, []);
      }
      gpaMap.get(s.gpa)!.push(s);
    });

    const sortedGpas = Array.from(gpaMap.keys()).sort((a, b) => Number(b) - Number(a));
    const tiedGroupsList: TiedGroup[] = [];
    let groupCounter = 0;

    sortedGpas.forEach((gpa) => {
      const cluster = gpaMap.get(gpa)!;
      if (cluster.length > 1) {
        groupCounter++;
        const palette = this.GROUP_PALETTES[(groupCounter - 1) % this.GROUP_PALETTES.length];
        const gId = groupCounter;

        cluster.forEach((s) => {
          s.isTiedGpa = true;
          s.tiedGroupId = gId;
          s.tiedGroupColor = palette.border;
          s.tiedGroupBg = palette.bg;
          s.tiedGroupText = palette.text;
          s.tiedGroupCount = cluster.length;
        });

        tiedGroupsList.push({
          groupId: gId,
          gpa: gpa,
          studentCount: cluster.length,
          color: palette,
          isResolved: false,
          minRank: 0,
          maxRank: 0,
          studentCodes: cluster.map((s) => s.student_code).join(', '),
        });
      }
    });

    // 2. เรียงลำดับนักเรียนกลุ่มที่ครบสมบูรณ์
    completeStudents.sort((a, b) => {
      const gpaDiff = Number(b.gpa) - Number(a.gpa);
      if (Math.abs(gpaDiff) > 0.0001) return gpaDiff;

      if (selectedSubIds.size > 0) {
        const tbDiff = b.tieBreakScore - a.tieBreakScore;
        if (Math.abs(tbDiff) > 0.001) return tbDiff;
      }
      return 0;
    });

    let tiedCases = 0;
    let unresolvedTies = 0;

    completeStudents.forEach((s, idx) => {
      s.calculatedRank = idx + 1;
      s.manualRank = idx + 1;
      s.isTrulyTied = false;

      if (s.isTiedGpa) {
        tiedCases++;
        const cluster = gpaMap.get(s.gpa)!;
        const sameScoreCount = cluster.filter(
          (other) => Math.abs(other.tieBreakScore - s.tieBreakScore) <= 0.001
        ).length;

        if (selectedSubIds.size === 0) {
          s.isTrulyTied = true;
          unresolvedTies++;
          s.tieBreakReason = `⚠️ เกรด ${s.gpa} เท่ากัน (ยังไม่ได้เลือกวิชาตัดสิน กรุณาติ๊กเลือกวิชาด้านบน)`;
        } else if (sameScoreCount > 1) {
          s.isTrulyTied = true;
          unresolvedTies++;
          s.tieBreakReason = `⚠️ คะแนนวิชาที่เลือกเท่ากัน (${s.tieBreakScore.toFixed(1)}) ติ๊กเลือกวิชาเพิ่มเพื่อตัดสิน`;
        } else {
          s.tieBreakReason = `เกรด ${s.gpa} (ชนะด้วยคะแนนวิชาที่เลือก: ${s.tieBreakScore.toFixed(1)} / ${s.tieBreakMaxScore})`;
        }
      } else {
        s.tieBreakReason = `เกรดสะสม ${s.gpa}`;
      }
    });

    // นักเรียนที่คะแนนไม่สมบูรณ์
    incompleteStudents.sort((a, b) => (Number(b.gpa) || 0) - (Number(a.gpa) || 0));
    incompleteStudents.forEach((s) => {
      s.calculatedRank = null;
      s.manualRank = null;
      s.isTiedGpa = false;
      s.isTrulyTied = false;
      s.tieBreakReason = `⚠️ คะแนนยังไม่สมบูรณ์ (มีคะแนนเพียง ${s.completion_text} วิชา - ไม่นำมาจัดอันดับ)`;
    });

    tiedGroupsList.forEach((tg) => {
      const members = completeStudents.filter((s) => s.tiedGroupId === tg.groupId);
      if (members.length > 0) {
        tg.minRank = Math.min(...members.map((m) => m.manualRank as number));
        tg.maxRank = Math.max(...members.map((m) => m.manualRank as number));
        tg.studentCodes = members.map((m) => m.student_code).join(', ');
        tg.isResolved = selectedSubIds.size > 0 && !members.some((m) => m.isTrulyTied);
      }
    });

    this.tiedGroups = tiedGroupsList;
    this.hasTiedUnresolved = unresolvedTies > 0;
    this.rankedStudents = [...completeStudents, ...incompleteStudents];
    this.hasManualAdjustments = false;

    this.totalStudents = students.length;
    this.completedCount = completeStudents.length;
    this.incompleteCount = incompleteStudents.length;
    this.topPerformer = completeStudents.length > 0 ? completeStudents[0] : null;
    this.tiedCount = tiedCases;
    this.appliedSubjectCount = selectedSubIds.size;
    this.hasPendingSubjectChanges = false;
    this.isRecalculating = false;
    this.isLoading = false;
    this.isTableLoading = false;

    if (completeStudents.length > 0) {
      const sumGpa = completeStudents.reduce((acc, curr) => acc + Number(curr.gpa), 0);
      this.avgGpa = (sumGpa / completeStudents.length).toFixed(2);
    } else {
      this.avgGpa = '0.00';
    }

    this.triggerViewUpdate();
  }

  // --- การปรับลำดับด้วยมือ (Manual Adjustment) ---
  moveRankUp(student: RankedStudent): void {
    if (student.is_completed === false) return;
    const index = this.rankedStudents.findIndex((s) => s.student_id === student.student_id);
    if (index <= 0) return;
    if (this.rankedStudents[index - 1].is_completed === false) return;

    const temp = this.rankedStudents[index];
    this.rankedStudents[index] = this.rankedStudents[index - 1];
    this.rankedStudents[index - 1] = temp;

    this.reindexManualRanks();
    this.hasManualAdjustments = true;
  }

  moveRankDown(student: RankedStudent): void {
    if (student.is_completed === false) return;
    const index = this.rankedStudents.findIndex((s) => s.student_id === student.student_id);
    if (index < 0 || index >= this.rankedStudents.length - 1) return;
    if (this.rankedStudents[index + 1].is_completed === false) return;

    const temp = this.rankedStudents[index];
    this.rankedStudents[index] = this.rankedStudents[index + 1];
    this.rankedStudents[index + 1] = temp;

    this.reindexManualRanks();
    this.hasManualAdjustments = true;
  }

  reindexManualRanks(): void {
    let rankCounter = 1;
    this.rankedStudents.forEach((s) => {
      if (s.is_completed !== false) {
        s.manualRank = rankCounter++;
        if (s.manualRank !== s.calculatedRank) {
          s.tieBreakReason = `ปรับลำดับเฉพาะบุคคล (เดิมคำนวณได้ที่ ${s.calculatedRank})`;
        }
      } else {
        s.manualRank = null;
      }
    });

    // อัปเดต minRank และ maxRank ให้กลุ่มที่ซ้ำ
    this.tiedGroups.forEach((tg) => {
      const members = this.rankedStudents.filter((s) => s.tiedGroupId === tg.groupId && s.manualRank != null);
      if (members.length > 0) {
        tg.minRank = Math.min(...members.map((m) => m.manualRank as number));
        tg.maxRank = Math.max(...members.map((m) => m.manualRank as number));
      }
    });
  }

  resetToCalculated(): void {
    this.calculateRanking();
    Swal.fire({
      icon: 'success',
      title: 'รีเซ็ตเรียบร้อย',
      text: 'ระบบได้จัดเรียงลำดับตามเกณฑ์คำนวณอัตโนมัติเรียบร้อยแล้ว',
      timer: 1500,
      showConfirmButton: false,
    });
  }

  // --- ส่งออก Excel ---
  async exportToExcel(): Promise<void> {
    if (!this.rankedStudents || this.rankedStudents.length === 0) {
      Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลสำหรับส่งออก', 'warning');
      return;
    }

    const courseName = this.getSelectedCourseName();
    const batchName = this.getSelectedBatchName();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Student Rankings');

    worksheet.properties.defaultRowHeight = 24;

    // Header 1: Title
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `รายงานผลการจัดลำดับการศึกษา - ${courseName} ${batchName}`;
    titleCell.font = { name: 'Sarabun', size: 16, bold: true, color: { argb: 'FF4A148C' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
    worksheet.getRow(1).height = 35;

    // Header 2: Tie-break criteria subtitle
    worksheet.mergeCells('A2:H2');
    const subTitleCell = worksheet.getCell('A2');
    const modeText = this.viewMode === 'by-code' ? ' | จัดเรียงตามเลขที่' : ' | จัดเรียงตามลำดับที่ได้';
    subTitleCell.value = `เกณฑ์ตัดสินกรณีเกรดเท่ากัน: ใช้คะแนนรวมในวิชา [ ${this.getSelectedSubjectsText()} ]${modeText}`;
    subTitleCell.font = { name: 'Sarabun', size: 11, italic: true, color: { argb: 'FF6A1B9A' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 24;

    // Table Headers
    const headers = [
      this.viewMode === 'by-code' ? 'ลำดับที่ได้' : 'ลำดับที่',
      'เลขที่',
      'ยศ',
      'ชื่อ - นามสกุล',
      'เกรดเฉลี่ย (GPA)',
      'คะแนนวิชาที่เลือกตัดสิน',
      'คะแนนรวมทุกวิชา',
      'หมายเหตุ / เกณฑ์ตัดสิน',
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E44AD' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    // Data rows
    this.displayedStudents.forEach((s) => {
      const groupNote = s.isTiedGpa && s.is_completed !== false ? `[กลุ่มซ้ำ #${s.tiedGroupId}] ` : '';
      const displayRank = s.is_completed === false ? '-' : (s.manualRank ?? '-');
      const gpaDisplay = s.is_completed === false ? `${Number(s.gpa).toFixed(2)} (ไม่สมบูรณ์)` : Number(s.gpa).toFixed(2);

      const row = worksheet.addRow([
        displayRank,
        s.student_code,
        s.rank_name || '',
        `${s.first_name} ${s.last_name}`.trim(),
        gpaDisplay,
        s.tieBreakScore.toFixed(1),
        s.total_raw_score.toFixed(1),
        `${groupNote}${s.tieBreakReason || '-'}`,
      ]);

      // Highlights for top 3 (complete only)
      if (s.is_completed !== false) {
        if (s.manualRank === 1) {
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } }; // Gold
        } else if (s.manualRank === 2) {
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; // Silver
        } else if (s.manualRank === 3) {
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; // Bronze
        }
      } else {
        // Incomplete row light gray styling
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Sarabun', size: 11 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 4 ? 'left' : 'center',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    // Column widths
    worksheet.getColumn(1).width = 10; // ลำดับ
    worksheet.getColumn(2).width = 10; // เลขที่
    worksheet.getColumn(3).width = 12; // ยศ
    worksheet.getColumn(4).width = 28; // ชื่อ
    worksheet.getColumn(5).width = 18; // GPA
    worksheet.getColumn(6).width = 26; // คะแนนวิชาตัดสิน
    worksheet.getColumn(7).width = 20; // รวมทุกวิชา
    worksheet.getColumn(8).width = 38; // หมายเหตุ

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `รายงานจัดลำดับ_${courseName}_${batchName}.xlsx`);
  }

  // --- พิมพ์รายงาน ---
  printPage(): void {
    window.print();
  }

  getSelectedCourseName(): string {
    const found = this.courses.find((c) => String(c.id) === String(this.selectedCourse));
    return found ? found.group_name : '';
  }

  getSelectedBatchName(): string {
    const found = this.batches.find((b) => String(b.id) === String(this.selectedBatch));
    return found ? found.name : '';
  }
}
