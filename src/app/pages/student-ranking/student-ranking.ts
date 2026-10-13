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
  isTop3Group?: boolean;
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

  // Storage Keys สำหรับจำค่าการเลือกและผลการคำนวณ เพื่อให้เข้าออกหน้าแล้วไม่รีเฟรชใหม่
  private readonly STORAGE_KEY_SELECTION = 'student_ranking_last_selection';
  private readonly STORAGE_KEY_SUBJECTS_PREFIX = 'student_ranking_subjects_batch_';
  private readonly STORAGE_KEY_CACHE_PREFIX = 'student_ranking_cache_batch_';

  // --- การตัดสินผู้ครองลำดับที่ 1, 2, 3 (ผู้ครองโล่รางวัลเกียรตินิยม / กรอบทอง) ---
  get rank1Winner(): RankedStudent | null {
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    return completed.find((s) => s.manualRank === 1) || null;
  }

  get rank2Winner(): RankedStudent | null {
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    return completed.find((s) => s.manualRank === 2) || null;
  }

  get rank3Winner(): RankedStudent | null {
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    return completed.find((s) => s.manualRank === 3) || null;
  }

  get top3Winners(): RankedStudent[] {
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    return completed
      .filter((s) => s.manualRank != null && s.manualRank >= 1 && s.manualRank <= 3)
      .sort((a, b) => (a.manualRank as number) - (b.manualRank as number));
  }

  get topRankContenders(): RankedStudent[] {
    if (!this.rankedStudents || this.rankedStudents.length === 0) return [];
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    if (completed.length === 0) return [];

    const top3 = this.top3Winners;
    const top3Gpas = new Set(top3.map((w) => w.gpa));
    return completed.filter(
      (s) => (s.manualRank != null && s.manualRank <= 3) || top3Gpas.has(s.gpa)
    );
  }

  isRank1TiedGroup(groupId?: number): boolean {
    if (!groupId) return false;
    const tg = this.tiedGroups.find((g) => g.groupId === groupId);
    return tg ? tg.minRank === 1 : false;
  }

  get rank1TiedGroup(): TiedGroup | undefined {
    return this.tiedGroups.find((g) => g.minRank === 1);
  }

  get hasTop3Tie(): boolean {
    return this.topRankContenders.length > 3;
  }

  get isTop3TieResolved(): boolean {
    if (!this.hasTop3Tie) return true;
    const top3 = this.top3Winners;
    const hasUnresolved = top3.some((w) => w.isTrulyTied);
    return !hasUnresolved && (this.appliedSubjectCount > 0 || this.hasManualAdjustments);
  }

  // รองรับการเรียกจาก template
  get hasRank1Tie(): boolean {
    return this.hasTop3Tie;
  }

  get isRank1TieResolved(): boolean {
    return this.isTop3TieResolved;
  }

  get activeTieStatus(): { title: string; subtitle: string; level: number; count: number } {
    const completed = this.rankedStudents.filter((s) => s.is_completed !== false);
    if (completed.length === 0) {
      return { title: 'ยังไม่มีข้อมูลนักเรียน', subtitle: '', level: 0, count: 0 };
    }

    const gpaMap = new Map<string, RankedStudent[]>();
    completed.forEach((s) => {
      if (!gpaMap.has(s.gpa)) gpaMap.set(s.gpa, []);
      gpaMap.get(s.gpa)!.push(s);
    });
    const sortedGpas = Array.from(gpaMap.keys()).sort((a, b) => Number(b) - Number(a));

    if (sortedGpas.length > 0 && gpaMap.get(sortedGpas[0])!.length > 1) {
      const cluster = gpaMap.get(sortedGpas[0])!;
      return {
        title: `⚠️ ตรวจพบการแย่งลำดับที่ 1 (ชิงโล่รางวัลเกียรตินิยม - ${cluster.length} นาย)`,
        subtitle: `มีนักเรียนได้เกรดเฉลี่ยสูงสุดเท่ากันที่อันดับ 1 (GPA ${sortedGpas[0]}) จำนวน ${cluster.length} นาย กรุณาติ๊กเลือกวิชาตัดสินเพิ่มด้านบน หรือใช้ปุ่ม ⬆️ ⬇️ เพื่อตัดสิน`,
        level: 1,
        count: cluster.length,
      };
    }

    if (sortedGpas.length > 1 && gpaMap.get(sortedGpas[1])!.length > 1) {
      const cluster = gpaMap.get(sortedGpas[1])!;
      return {
        title: `⚠️ ลำดับที่ 1 ไม่ซ้ำ แต่ตรวจพบการแย่งลำดับที่ 2 (ชิงโล่รางวัล - ${cluster.length} นาย)`,
        subtitle: `ลำดับที่ 1 ได้ผู้ครองโล่เด็ดขาดแล้ว แต่ตรวจพบเกรดเท่ากันที่อันดับ 2 (GPA ${sortedGpas[1]}) จำนวน ${cluster.length} นาย กำลังแย่งชิงโล่อันดับ 2 และ 3`,
        level: 2,
        count: cluster.length,
      };
    }

    if (sortedGpas.length > 2 && gpaMap.get(sortedGpas[2])!.length > 1) {
      const cluster = gpaMap.get(sortedGpas[2])!;
      return {
        title: `⚠️ ลำดับที่ 1 และ 2 ไม่ซ้ำ แต่ตรวจพบการแย่งลำดับที่ 3 (ชิงโล่รางวัล - ${cluster.length} นาย)`,
        subtitle: `ลำดับที่ 1 และ 2 ได้ผู้ครองโล่เด็ดขาดแล้ว แต่ตรวจพบเกรดเท่ากันที่อันดับ 3 (GPA ${sortedGpas[2]}) จำนวน ${cluster.length} นาย กำลังแย่งชิงโล่อันดับ 3`,
        level: 3,
        count: cluster.length,
      };
    }

    return {
      title: 'ผู้ครองโล่รางวัลเกียรตินิยม (อันดับ 1, 2, 3 - กรอบทอง)',
      subtitle: 'ผลการตัดสินลำดับที่ 1, 2, 3 สำหรับรับมอบโล่รางวัลเกียรตินิยมครบทั้ง 3 อันดับเด็ดขาดแล้ว',
      level: 0,
      count: 3,
    };
  }

  get displayedStudents(): RankedStudent[] {
    let list = [...this.rankedStudents];

    if (this.filterMode === 'rank1-only') {
      const r1Contenders = this.topRankContenders;
      const r1Ids = new Set(r1Contenders.map((c) => c.student_id));
      list = list.filter((s) => r1Ids.has(s.student_id));
    } else if (this.filterMode === 'tied-only') {
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

  // --- LocalStorage Persistence Helpers ---
  private saveCurrentSelection(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.selectedCourse && this.selectedBatch) {
        localStorage.setItem(
          this.STORAGE_KEY_SELECTION,
          JSON.stringify({
            courseId: this.selectedCourse,
            batchId: this.selectedBatch,
          })
        );
      }
    } catch (_) {}
  }

  private saveBatchSubjects(batchId: number, subjectIds: number[]): void {
    if (typeof window === 'undefined' || !batchId) return;
    try {
      localStorage.setItem(
        this.STORAGE_KEY_SUBJECTS_PREFIX + batchId,
        JSON.stringify(subjectIds)
      );
    } catch (_) {}
  }

  private getSavedBatchSubjects(batchId: number): number[] | null {
    if (typeof window === 'undefined' || !batchId) return null;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_SUBJECTS_PREFIX + batchId);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  private saveBatchCache(batchId: number, data: any): void {
    if (typeof window === 'undefined' || !batchId) return;
    try {
      localStorage.setItem(
        this.STORAGE_KEY_CACHE_PREFIX + batchId,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (_) {}
  }

  private getBatchCache(batchId: number): any | null {
    if (typeof window === 'undefined' || !batchId) return null;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_CACHE_PREFIX + batchId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Date.now() - parsed.timestamp < 24 * 3600 * 1000) {
          return parsed.data;
        }
      }
    } catch (_) {}
    return null;
  }

  // ล้างการจำค่าตัวเลือกเพื่อเริ่มเลือกรุ่นใหม่
  clearSavedSelection(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY_SELECTION);
      } catch (_) {}
    }
    this.selectedCourse = '';
    this.selectedBatch = '';
    this.batches = [];
    this.rankedStudents = [];
    this.rawStudentsData = [];
    this.availableSubjects = [];
    this.tiedGroups = [];
    this.filterMode = 'all';
    this.isLoading = false;
    this.isTableLoading = false;
    this.isRecalculating = false;
    this.triggerViewUpdate();
  }

  ngOnInit(): void {
    let paramCourse: any = null;
    let paramBatch: any = null;

    // ตรวจสอบ queryParams
    this.route.queryParams.subscribe((params) => {
      if (params['courseId']) paramCourse = params['courseId'];
      if (params['batchId']) paramBatch = Number(params['batchId']);
    });

    if (paramCourse) this.selectedCourse = paramCourse;
    if (paramBatch) this.selectedBatch = paramBatch;

    // ถ้าไม่มีใน queryParams ให้ดึงค่าที่เคยเลือกและคำนวณไว้ล่าสุดจาก Storage
    if (!this.selectedCourse && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(this.STORAGE_KEY_SELECTION);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.courseId) this.selectedCourse = parsed.courseId;
          if (parsed.batchId) this.selectedBatch = Number(parsed.batchId);
        }
      } catch (_) {}
    }

    this.loadCourses();
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
      this.rawStudentsData = [];
      this.availableSubjects = [];
      this.tiedGroups = [];
      this.totalStudents = 0;
      this.completedCount = 0;
      this.incompleteCount = 0;
      this.topPerformer = null;
      this.avgGpa = '0.00';
      this.tiedCount = 0;
      this.hasTiedUnresolved = false;
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
    }
    this.batches = [];

    if (!this.selectedCourse) {
      this.saveCurrentSelection();
      this.triggerViewUpdate();
      return;
    }

    const courseGroup = this.courseGroups.find(
      (c) =>
        String(c.batches?.[0]?.course_id) === String(this.selectedCourse) ||
        c.course_name === this.selectedCourse
    );

    const onBatchesReady = () => {
      this.saveCurrentSelection();
      if (this.selectedBatch && this.batches.some((b) => Number(b.id) === Number(this.selectedBatch))) {
        this.onBatchChange();
      }
      this.triggerViewUpdate();
    };

    if (courseGroup && courseGroup.batches && courseGroup.batches.length > 0) {
      this.batches = courseGroup.batches.map((b) => ({
        id: b.batch_id,
        name: b.batch_name || `รุ่นที่ ${b.batch_id}`,
      }));
      onBatchesReady();
    } else {
      this.dropdownService.getBatches(this.selectedCourse).subscribe({
        next: (res) => {
          if (res?.success && res.data) {
            this.batches = res.data.map((b: any) => ({
              id: b.id || b.batch_id,
              name: b.name || b.batch_name || `รุ่นที่ ${b.id || b.batch_id}`,
            }));
            onBatchesReady();
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
      this.rawStudentsData = [];
      this.availableSubjects = [];
      this.tiedGroups = [];
      this.totalStudents = 0;
      this.completedCount = 0;
      this.incompleteCount = 0;
      this.topPerformer = null;
      this.avgGpa = '0.00';
      this.tiedCount = 0;
      this.hasTiedUnresolved = false;
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
      this.saveCurrentSelection();
      this.triggerViewUpdate();
      return;
    }

    this.saveCurrentSelection();

    const batchId = Number(this.selectedBatch);
    const savedSubjectIds = this.getSavedBatchSubjects(batchId);

    // 1. ดึงข้อมูลจาก Cache ในเครื่องมาแสดงผลทันที (ไม่ให้หน้าจอดับหรือกะพริบ)
    const cachedData = this.getBatchCache(batchId);
    if (cachedData && cachedData.data && cachedData.data.length > 0) {
      this.rankedStudents = cachedData.data;
      this.rawStudentsData = cachedData.data;
      this.tiedGroups = cachedData.tiedGroups || [];
      this.totalStudents = cachedData.summary?.total_students ?? cachedData.data.length;
      this.completedCount = cachedData.summary?.completed_students ?? cachedData.data.filter((s: any) => s.is_completed).length;
      this.incompleteCount = cachedData.summary?.incomplete_students ?? cachedData.data.filter((s: any) => !s.is_completed).length;
      this.appliedSubjectCount = cachedData.summary?.selected_subjects_count ?? (savedSubjectIds?.length ?? 0);

      const completedList = cachedData.data.filter((s: any) => s.is_completed);
      this.topPerformer = completedList.length > 0 ? completedList[0] : null;
      this.tiedCount = cachedData.summary?.tiedCount ?? cachedData.data.filter((s: any) => s.isTiedGpa && s.is_completed).length;
      this.hasTiedUnresolved = (cachedData.summary?.unresolvedTies || 0) > 0;

      if (completedList.length > 0) {
        const sumGpa = completedList.reduce((acc: number, curr: any) => acc + (Number(curr.gpa) || 0), 0);
        this.avgGpa = (sumGpa / completedList.length).toFixed(2);
      }

      if (cachedData.availableSubjects && cachedData.availableSubjects.length > 0) {
        this.setupAvailableSubjects(cachedData.availableSubjects, savedSubjectIds);
      }
      this.triggerViewUpdate();
    } else {
      // เคลียร์ข้อมูลรุ่นเดิมออกทั้งหมด เพื่อไม่ให้ข้อมูลรุ่นเก่าค้างอยู่ระหว่างโหลดรุ่นใหม่
      this.rankedStudents = [];
      this.rawStudentsData = [];
      this.availableSubjects = [];
      this.tiedGroups = [];
      this.totalStudents = 0;
      this.completedCount = 0;
      this.incompleteCount = 0;
      this.topPerformer = null;
      this.avgGpa = '0.00';
      this.tiedCount = 0;
      this.hasTiedUnresolved = false;
      this.isLoading = true;
      this.triggerViewUpdate();
    }

    // 2. ซิงค์กับ Backend เสมอเพื่อตรวจสอบคะแนนที่เป็นปัจจุบันที่สุด
    this.calculateRanking(false, savedSubjectIds || undefined);
  }

  // กำหนดค่าการเลือกวิชา โดยเริ่มต้นเป็นไม่เลือก (ผู้ใช้เป็นผู้กำหนดวิชาตัดสินเอง)
  private setupAvailableSubjects(subjectsList: any[], savedSubIds?: number[] | null): void {
    this.availableSubjects = subjectsList.map((sub: any) => {
      let isSel = false;
      if (savedSubIds && savedSubIds.length > 0) {
        isSel = savedSubIds.includes(Number(sub.id));
      } else if (sub.selected !== undefined) {
        isSel = Boolean(sub.selected);
      }

      return {
        id: sub.id,
        name: sub.name,
        max_score: Number(sub.max_score) || 0,
        group_name: sub.group_name || '',
        is_su: Boolean(sub.is_su),
        selected: isSel,
      };
    });

    this.appliedSubjectCount = this.availableSubjects.filter((s) => s.selected).length;
  }

  // --- จัดการการเลือกวิชาสำหรับคิดคะแนนตัดสิน (Tie-Breaking Subjects) ---
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
  applyRecalculateRanking(): void {
    if (!this.selectedBatch) return;

    const batchId = Number(this.selectedBatch);
    const selectedSubIds = this.availableSubjects
      .filter((s) => s.selected)
      .map((s) => s.id);

    // บันทึกวิชาที่เลือกลงใน Storage เสมอ
    this.saveBatchSubjects(batchId, selectedSubIds);

    this.isTableLoading = true;
    this.isRecalculating = true;
    this.triggerViewUpdate();

    // หากมีข้อมูลนักเรียนในเครื่องแล้ว ให้คำนวณและวาดหน้าใหม่อย่างรวดเร็ว
    if (this.rawStudentsData && this.rawStudentsData.length > 0) {
      setTimeout(() => {
        this.calculateRankingLocal();
        this.appliedSubjectCount = selectedSubIds.length;
        this.isTableLoading = false;
        this.isRecalculating = false;
        this.hasPendingSubjectChanges = false;

        // บันทึก Cache ลง Storage
        this.saveBatchCache(batchId, {
          data: this.rankedStudents,
          tiedGroups: this.tiedGroups,
          summary: {
            total_students: this.totalStudents,
            completed_students: this.completedCount,
            incomplete_students: this.incompleteCount,
            selected_subjects_count: this.appliedSubjectCount,
            tiedCount: this.tiedCount,
            unresolvedTies: this.hasTiedUnresolved ? 1 : 0,
          },
          availableSubjects: this.availableSubjects,
        });

        this.triggerViewUpdate();

        const toastText = selectedSubIds.length > 0
          ? `บันทึกและใช้เกณฑ์วิชาที่เลือก ${selectedSubIds.length} วิชาในการประมวลผล`
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

      // ซิงค์กับ Backend เบื้องหลัง
      this.scoreService.getBatchRanking(batchId, selectedSubIds).subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            this.rawStudentsData = res.data;
            this.saveBatchCache(batchId, res);
          }
        },
        error: (err) => {
          console.warn('Backend sync error (ranking already applied locally):', err);
        },
      });
      return;
    }

    // กรณีเข้าสู่หน้าครั้งแรกที่ยังไม่มีข้อมูลในเครื่อง
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

            this.saveBatchCache(batchId, res);
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

  // --- คำนวณอันดับและแก้ไขลำดับซ้ำ ---
  calculateRanking(isBatchInit: boolean = false, explicitSubIds?: number[]): void {
    if (!this.selectedBatch) {
      this.rankedStudents = [];
      this.isLoading = false;
      this.isTableLoading = false;
      this.isRecalculating = false;
      this.triggerViewUpdate();
      return;
    }

    const batchId = Number(this.selectedBatch);
    const subjectIdsParam =
      explicitSubIds !== undefined
        ? explicitSubIds
        : (isBatchInit ? undefined : this.availableSubjects.filter((s) => s.selected).map((s) => s.id));

    // หากมีข้อมูลแสดงผลอยู่แล้วจากแคช ให้เปิดโหลดเฉพาะส่วนตาราง ไม่ให้หน้ากระพริบ
    if (this.rankedStudents && this.rankedStudents.length > 0) {
      this.isTableLoading = true;
    } else {
      this.isLoading = true;
      this.isTableLoading = true;
    }
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

          // บันทึก Cache ลง Storage
          this.saveBatchCache(batchId, res);

          // ตั้งค่ารายการวิชาและสถานะการติ๊กเลือก
          if (res.availableSubjects && res.availableSubjects.length > 0) {
            this.setupAvailableSubjects(res.availableSubjects, subjectIdsParam);
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
        if (this.rawStudentsData && this.rawStudentsData.length > 0) {
          this.calculateRankingLocal();
        } else {
          this.rankedStudents = [];
        }
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


    let currentTargetRank = 1;
    let nextRankNumber = 1;
    let tiedCases = 0;
    let unresolvedTies = 0;

    for (const gpa of sortedGpas) {
      const cluster = gpaMap.get(gpa)!;

      if (currentTargetRank <= 3) {
        // กลุ่มนี้เข้าร่วมชิง Top 3 โล่รางวัลเกียรตินิยม (กรอบทอง)
        cluster.sort((a, b) => {
          if (selectedSubIds.size > 0) {
            const tbDiff = b.tieBreakScore - a.tieBreakScore;
            if (Math.abs(tbDiff) > 0.001) return tbDiff;
          }
          const rawDiff = b.total_raw_score - a.total_raw_score;
          if (Math.abs(rawDiff) > 0.001) return rawDiff;
          const codeA = parseInt(a.student_code, 10);
          const codeB = parseInt(b.student_code, 10);
          if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
          return a.student_code.localeCompare(b.student_code);
        });

        const slotsAvailable = 4 - currentTargetRank;
        const takeCount = Math.min(cluster.length, slotsAvailable);

        for (let i = 0; i < takeCount; i++) {
          const s = cluster[i];
          s.calculatedRank = currentTargetRank;
          s.manualRank = currentTargetRank;
          s.isTrulyTied = false;

          if (cluster.length > 1) {
            s.isTiedGpa = true;
            tiedCases++;
            const sameTbCount = cluster.filter(
              (other) => Math.abs(other.tieBreakScore - s.tieBreakScore) <= 0.001
            ).length;

            if (selectedSubIds.size === 0) {
              s.isTrulyTied = true;
              unresolvedTies++;
              s.tieBreakReason = `⚠️ เกรด ${s.gpa} เท่ากัน (แย่งชิงอันดับที่ ${s.calculatedRank} - กรุณาเลือกวิชาด้านบนเพื่อตัดสิน)`;
            } else if (sameTbCount > 1) {
              s.isTrulyTied = true;
              unresolvedTies++;
              s.tieBreakReason = `⚠️ คะแนนวิชาที่เลือกเท่ากัน (${s.tieBreakScore.toFixed(1)}) แย่งชิงอันดับที่ ${s.calculatedRank} เลือกวิชาเพิ่มเพื่อตัดสิน`;
            } else {
              s.tieBreakReason = `เกรด ${s.gpa} (ชนะด้วยคะแนนวิชาที่เลือก: ${s.tieBreakScore.toFixed(1)} / ${s.tieBreakMaxScore})`;
            }
          } else {
            s.isTiedGpa = false;
            s.tieBreakReason = `เกรดสะสม ${s.gpa} (อันดับที่ ${s.calculatedRank} เดี่ยว)`;
          }

          currentTargetRank++;
        }

        // กรณีมีคนในกลุ่มที่หลุดจาก Top 3
        if (cluster.length > takeCount) {
          const rankForRest = 4;
          for (let i = takeCount; i < cluster.length; i++) {
            const s = cluster[i];
            s.calculatedRank = rankForRest;
            s.manualRank = rankForRest;
            s.isTiedGpa = true;
            s.isTrulyTied = false;
            s.tieBreakReason = `เกรดสะสม ${s.gpa} เท่ากัน ${cluster.length} คน (ได้ลำดับที่ ${rankForRest} ร่วมกัน)`;
          }
          nextRankNumber = rankForRest + 1;
        } else {
          nextRankNumber = currentTargetRank;
        }
      } else {
        // ลำดับอื่นๆ ตั้งแต่อันดับ 4 เป็นต้นไป: ถ้าเกรดซ้ำกัน ให้ได้ลำดับที่เดียวกัน (Dense Ranking)
        const assignedRank = nextRankNumber;
        cluster.sort((a, b) => {
          const codeA = parseInt(a.student_code, 10);
          const codeB = parseInt(b.student_code, 10);
          if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
          return a.student_code.localeCompare(b.student_code);
        });

        cluster.forEach((s) => {
          s.calculatedRank = assignedRank;
          s.manualRank = assignedRank;
          s.isTrulyTied = false;
          if (cluster.length > 1) {
            s.isTiedGpa = true;
            s.tieBreakReason = `เกรดสะสม ${s.gpa} เท่ากัน ${cluster.length} คน (ได้ลำดับที่ ${assignedRank} ร่วมกัน)`;
          } else {
            s.isTiedGpa = false;
            s.tieBreakReason = `เกรดสะสม ${s.gpa}`;
          }
        });

        nextRankNumber = assignedRank + 1;
      }
    }

    // นักเรียนที่คะแนนไม่สมบูรณ์
    incompleteStudents.sort((a, b) => (Number(b.gpa) || 0) - (Number(a.gpa) || 0));
    incompleteStudents.forEach((s) => {
      s.calculatedRank = null;
      s.manualRank = null;
      s.isTiedGpa = false;
      s.isTrulyTied = false;
      s.tieBreakReason = `⚠️ คะแนนยังไม่สมบูรณ์ (มีคะแนนเพียง ${s.completion_text} วิชา - ไม่นำมาจัดอันดับ)`;
    });

    // เรียงลำดับนักเรียนที่ครบสมบูรณ์
    completeStudents.sort((a, b) => {
      if (a.manualRank !== b.manualRank) {
        return (a.manualRank as number) - (b.manualRank as number);
      }
      const tbDiff = b.tieBreakScore - a.tieBreakScore;
      if (Math.abs(tbDiff) > 0.001) return tbDiff;
      const codeA = parseInt(a.student_code, 10);
      const codeB = parseInt(b.student_code, 10);
      if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
      return a.student_code.localeCompare(b.student_code);
    });

    // กำหนดกลุ่มที่เกรดซ้ำ (เฉพาะกลุ่มที่เกี่ยวข้องกับการชิงอันดับ 1, 2, 3 โล่รางวัลเกียรตินิยม)
    const tiedGroupsList: TiedGroup[] = [];
    let groupCounter = 0;

    sortedGpas.forEach((gpa) => {
      const cluster = gpaMap.get(gpa)!;
      if (cluster.length > 1) {
        const isTop3 = cluster.some((m) => (m.manualRank as number) <= 3);
        if (!isTop3) {
          // ลำดับอื่นๆ (อันดับ 4 เป็นต้นไป) ไม่นำมาทำเป็นการ์ดกลุ่มซ้ำ
          cluster.forEach((s) => {
            s.isTiedGpa = false;
            delete s.tiedGroupId;
            delete s.tiedGroupColor;
            delete s.tiedGroupBg;
            delete s.tiedGroupText;
            delete s.tiedGroupCount;
          });
          return;
        }

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

        const minR = Math.min(...cluster.map((m) => m.manualRank as number));
        const maxR = Math.max(...cluster.map((m) => m.manualRank as number));

        tiedGroupsList.push({
          groupId: gId,
          gpa: gpa,
          studentCount: cluster.length,
          color: palette,
          isTop3Group: true,
          isResolved: selectedSubIds.size > 0 && !cluster.filter((m) => (m.manualRank as number) <= 3).some((m) => m.isTrulyTied),
          minRank: minR,
          maxRank: maxR,
          studentCodes: cluster.map((s) => s.student_code).join(', '),
        });
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
    this.tiedCount = completeStudents.filter((s) => (s.manualRank as number) <= 3 && s.isTiedGpa).length;
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
    const complete = this.rankedStudents.filter((s) => s.is_completed !== false);
    let nextDenseRank = 4;
    let prevGpa = '';

    complete.forEach((s, idx) => {
      if (idx < 3) {
        s.manualRank = idx + 1;
        prevGpa = s.gpa;
      } else {
        if (idx === 3) {
          s.manualRank = 4;
          prevGpa = s.gpa;
          nextDenseRank = 5;
        } else {
          if (s.gpa === prevGpa) {
            s.manualRank = nextDenseRank - 1;
          } else {
            s.manualRank = nextDenseRank;
            prevGpa = s.gpa;
            nextDenseRank++;
          }
        }
      }
      if (s.manualRank !== s.calculatedRank) {
        s.tieBreakReason = `ปรับลำดับเฉพาะบุคคล (เดิมคำนวณได้ที่ ${s.calculatedRank})`;
      }
    });

    this.rankedStudents.forEach((s) => {
      if (s.is_completed === false) {
        s.manualRank = null;
      }
    });

    // อัปเดต minRank และ maxRank ให้กลุ่มที่ซ้ำ
    this.tiedGroups.forEach((tg) => {
      const members = this.rankedStudents.filter((s) => s.tiedGroupId === tg.groupId && s.manualRank != null);
      if (members.length > 0) {
        tg.minRank = Math.min(...members.map((m) => m.manualRank as number));
        tg.maxRank = Math.max(...members.map((m) => m.manualRank as number));
        tg.isTop3Group = members.some((m) => (m.manualRank as number) <= 3);
        tg.isResolved = tg.isTop3Group
          ? !members.filter((m) => (m.manualRank as number) <= 3).some((m) => m.isTrulyTied)
          : true;
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
