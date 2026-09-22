import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CourseService, BatchItem } from '../../services/course.service';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface Curriculum {
  id: string;
  name: string;
}

export interface Course {
  name: string;
  curriculumId: string;
}

export interface PendingUser {
  studentId: string;
  name: string;
  curriculumId: string;
  courseId: string;
  courseName: string;
  teacherName?: string;
}

export interface EvaluationResult {
  courseName: string;
  teacherName: string;
  instructorName?: string;
  curriculumId: string;
  courseId?: string;
  scores: {
    q1: number | string; q2: number | string; q3: number | string;
    q4: number | string; q5: number | string; q6: number | string; q7: number | string;
  };
  averageScore: number;
  level: string;
}

export interface StudentEvalItem {
  courseName: string;
  curriculumId: string;
  score1: number | string;
  score2: number | string;
  score3: number | string;
  score4: number | string;
  score5: number | string;
  avgScore: number | string;
  level: string;
}

declare const XLSX: any;
declare const html2pdf: any;

@Component({
  selector: 'app-evaluation-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './evaluation-summary.html',
  styleUrls: ['./evaluation-summary.scss'],
})
export class EvaluationSummaryComponent implements OnInit, AfterViewInit, OnDestroy {
  totalCount: number = 0;
  totalUsers: number = 0;
  isChartExpanded: boolean = false;
  isResultsExpanded: boolean = false;
  courseName: string = '';
  batches: BatchItem[] = [];
  selectedBatch: BatchItem | null = null;
  isLoading: boolean = true;
  @ViewChild('contentRef') contentRef!: ElementRef;
  
  // Section Navigation
  activeSection: string = 'overview';
  sections = [
    { id: 'sec-overview', key: 'overview' },
    { id: 'sec-results', key: 'results' },
    { id: 'sec-teacher', key: 'teacher' },
    { id: 'sec-course', key: 'course' }
  ];

  overviewChart: Chart | null = null;
  
  selectedCurriculum: string = 'ALL';
  selectedCourseNameSelect: string = 'ALL';

  curriculumList: Curriculum[] = [
    { id: 'CS-2024', name: 'วิทยาการคอมพิวเตอร์ (หลักสูตรปรับปรุง 2567)' },
    { id: 'IT-2024', name: 'เทคโนโลยีสารสนเทศ (หลักสูตรปรับปรุง 2567)' },
  ];

  allCourses: Course[] = [
    { name: 'กฎหมายที่เกี่ยวข้องกับทหาร', curriculumId: 'CS-2024' },
    { name: 'การจัดกองทัพบก', curriculumId: 'CS-2024' },
    { name: 'การจัดการฝึก', curriculumId: 'CS-2024' },
    { name: 'การจัดฝ่ายอำนวยการ', curriculumId: 'CS-2024' },
    { name: 'การต่อต้านการก่อการร้าย', curriculumId: 'CS-2024' },
    { name: 'การบรรยายโดยผู้ทรงคุณวุฒิ', curriculumId: 'CS-2024' },
    { name: 'การบรรยายสรุปทางทหาร', curriculumId: 'CS-2024' },
    { name: 'การบินทหารบก', curriculumId: 'CS-2024' },
    { name: 'การปฏิบัติการสารสนเทศ', curriculumId: 'CS-2024' },
    { name: 'การปฏิบัติการเพื่อสันติภาพ', curriculumId: 'CS-2024' },
    { name: 'การปฏิบัติการร่วม/ผสม', curriculumId: 'CS-2024' },
    { name: 'การปฏิบัติงานของ พัน.ส.พล.ทางยุทธวิธี', curriculumId: 'CS-2024' },
    { name: 'การป้องกันและปราบปรามการก่อความไม่สงบ', curriculumId: 'CS-2024' },
    { name: 'การฝึกภาคสนามการสื่อสารทางยุทธวิธี', curriculumId: 'CS-2024' }
  ];

  allPendingUsers: PendingUser[] = [];
  allEvaluationResults: EvaluationResult[] = [];
  studentEvalData: StudentEvalItem[] = [];
  courseEvalData: any = null;

  courseEvalPart1: any = { formName: '', topics: [], scores: [], levels: [], hasData: false };
  courseEvalPart2: any = { formName: '', topics: [], scores: [], levels: [], hasData: false };
  courseEvalPart3: any = { formName: '', topics: [], scores: [], levels: [], hasData: false };

  get studentEvalSummary() {
    const data = this.displayStudentEvalData.filter((d: any) => d.avgScore && d.avgScore !== '-');
    const totalSubjects = this.displayStudentEvalData.length;
    const evaluatedSubjects = data.length;

    if (data.length === 0) {
      return {
        totalText: `ทั้งหมด 0 วิชา จาก ${totalSubjects}`,
        avg1: '-', avg2: '-', avg3: '-', avg4: '-', avg5: '-',
        totalAvg: '-', totalLevel: '-'
      };
    }

    const sum1 = data.reduce((acc: number, d: any) => acc + (typeof d.score1 === 'number' ? d.score1 : 0), 0);
    const sum2 = data.reduce((acc: number, d: any) => acc + (typeof d.score2 === 'number' ? d.score2 : 0), 0);
    const sum3 = data.reduce((acc: number, d: any) => acc + (typeof d.score3 === 'number' ? d.score3 : 0), 0);
    const sum4 = data.reduce((acc: number, d: any) => acc + (typeof d.score4 === 'number' ? d.score4 : 0), 0);
    const sum5 = data.reduce((acc: number, d: any) => acc + (typeof d.score5 === 'number' ? d.score5 : 0), 0);

    const c1 = data.filter((d: any) => typeof d.score1 === 'number').length;
    const c2 = data.filter((d: any) => typeof d.score2 === 'number').length;
    const c3 = data.filter((d: any) => typeof d.score3 === 'number').length;
    const c4 = data.filter((d: any) => typeof d.score4 === 'number').length;
    const c5 = data.filter((d: any) => typeof d.score5 === 'number').length;

    const avg1 = c1 > 0 ? (sum1 / c1) : '-';
    const avg2 = c2 > 0 ? (sum2 / c2) : '-';
    const avg3 = c3 > 0 ? (sum3 / c3) : '-';
    const avg4 = c4 > 0 ? (sum4 / c4) : '-';
    const avg5 = c5 > 0 ? (sum5 / c5) : '-';

    const totalSum = data.reduce((acc: number, d: any) => acc + (typeof d.avgScore === 'number' ? d.avgScore : 0), 0);
    const totalAvg = data.length > 0 ? (totalSum / data.length) : '-';

    let totalLevel = 'ปรับปรุง';
    if (typeof totalAvg === 'number') {
      if (totalAvg >= 4.51) totalLevel = 'มากที่สุด';
      else if (totalAvg >= 3.51) totalLevel = 'มาก';
      else if (totalAvg >= 2.51) totalLevel = 'ปานกลาง';
      else if (totalAvg >= 1.51) totalLevel = 'พอใช้';
    } else {
      totalLevel = '-';
    }

    return {
      totalText: `ทั้งหมด ${evaluatedSubjects} วิชา จาก ${totalSubjects}`,
      avg1, avg2, avg3, avg4, avg5,
      totalAvg, totalLevel
    };
  }

  selectedSubjectForPendingList: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private generalEvaluationService: GeneralEvaluationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      // รีเซ็ตเฉพาะข้อมูลที่แสดงผล ไม่แตะ batches (จะถูก reset ใน loadBatches แทน)
      this.selectedBatch = null;
      this.overviewData = [];
      this.allEvaluationResults = [];
      this.studentEvalData = [];
      this.courseEvalData = [];
      this.totalUsers = 0;
      
      if (params['course']) {
        const rawCourse = params['course'];
        this.courseName = decodeURIComponent(rawCourse).trim();
        this.selectedCourseNameSelect = 'ALL';
        this.selectedCurriculum = 'ALL';
      } else {
        this.courseName = '';
      }
      // Always load batches regardless of whether a course was specified
      this.loadBatches();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.renderOverviewChart(), 100);
  }

  ngOnDestroy(): void {
    if (this.overviewChart) {
      this.overviewChart.destroy();
    }
    const canvas = document.getElementById('overviewBarChart') as HTMLCanvasElement;
    if (canvas) {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) {
        existingChart.destroy();
      }
    }
  }

  loadBatches(): void {
    this.isLoading = true;
    this.courseService.getCourses().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          if (this.courseName) {
            const matchTerm = this.courseName.replace(/[\s\(\)\-\.]/g, '').toLowerCase();
            const courseGroup = response.data.find((c: any) => {
              if (!c.course_name) return false;
              const cName = c.course_name.replace(/[\s\(\)\-\.]/g, '').toLowerCase();
              return cName === matchTerm;
            });
            if (courseGroup && courseGroup.batches) {
              this.batches = courseGroup.batches.filter((b: any) => b.is_active !== false);
            } else {
              this.batches = [];
            }
          } else {
            // No course name specified, combine all batches from all courses
            let allBatches: BatchItem[] = [];
            response.data.forEach((courseGroup: any) => {
              if (courseGroup.batches) {
                const activeBatches = courseGroup.batches.filter((b: any) => b.is_active !== false);
                allBatches = allBatches.concat(activeBatches);
              }
            });
            
            // Remove duplicates by batch_id
            const uniqueBatches = new Map();
            allBatches.forEach((batch) => {
              if (!uniqueBatches.has(batch.batch_id)) {
                uniqueBatches.set(batch.batch_id, batch);
              }
            });
            this.batches = Array.from(uniqueBatches.values());
          }
          this.selectedBatch = null;
          // บังคับให้ Angular อัปเดตหน้าจอทันทีหลังจากโหลด batches เสร็จ
          this.cdr.detectChanges();
          this.onBatchChange();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching courses:', error);
        this.isLoading = false;
      }
    });
  }

  overviewData: any[] = [];
  
  onBatchChange(): void {
    if (!this.selectedBatch) {
      this.overviewData = [];
      this.allEvaluationResults = [];
      this.studentEvalData = [];
      this.courseEvalData = null;
      this.courseEvalPart1 = { formName: '', topics: [], scores: [], levels: [], hasData: false };
      this.courseEvalPart2 = { formName: '', topics: [], scores: [], levels: [], hasData: false };
      this.courseEvalPart3 = { formName: '', topics: [], scores: [], levels: [], hasData: false };
      this.totalUsers = 0;
      setTimeout(() => this.renderOverviewChart(), 100);
      return;
    }
    this.isLoading = true;
    
    this.generalEvaluationService.getEvaluationSummary(this.selectedBatch.batch_id).subscribe({
      next: (res: any) => {
        if (res.success) {
          const data = res.data;
          this.totalUsers = data.totalStudents || 0;
          this.totalCount = data.totalSubjects || 0;
          this.overviewData = data.overview || [];
          
          // Map to table data structures
          this.allPendingUsers = [];
          this.overviewData.forEach((ov: any) => {
            if (ov.pendingUsers && ov.pendingUsers.length > 0) {
              ov.pendingUsers.forEach((pu: any) => {
                this.allPendingUsers.push({
                  studentId: pu.studentCode,
                  name: pu.name,
                  curriculumId: 'ALL', 
                  courseId: ov.formId?.toString() || '',
                  courseName: ov.courseName
                });
              });
            }
          });

          this.allEvaluationResults = data.teacherResults || [];
          this.studentEvalData = data.studentResults || [];
          this.courseEvalData = data.courseResults || null;

          if (data.courseResults) {
            const sanitizePart = (part: any) => {
              if (!part || !part.topics) return part;
              const validIndices: number[] = [];
              part.topics.forEach((t: string, idx: number) => {
                if (!t.includes('ตำแหน่ง') && !t.includes('ความรับผิดชอบ')) {
                  validIndices.push(idx);
                }
              });
              return {
                ...part,
                topics: validIndices.map((i) => part.topics[i]),
                scores: validIndices.map((i) => part.scores[i]),
                percentages: validIndices.map((i) => (part.percentages ? part.percentages[i] : '-')),
                levels: validIndices.map((i) => part.levels[i]),
              };
            };

            this.courseEvalPart1 = sanitizePart(data.courseResults.part1) || { formName: '', topics: [], scores: [], levels: [], hasData: false };
            this.courseEvalPart2 = sanitizePart(data.courseResults.part2) || { formName: '', topics: [], scores: [], levels: [], hasData: false };
            this.courseEvalPart3 = sanitizePart(data.courseResults.part3) || { formName: '', topics: [], scores: [], levels: [], hasData: false };
          }
          
          this.cdr.detectChanges();
          setTimeout(() => this.renderOverviewChart(), 100);
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error fetching summary:', err);
        this.isLoading = false;
      }
    });
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el && this.contentRef) {
      // คำนวณตำแหน่งและชดเชยความสูงของ Sticky Header (ประมาณ 180px)
      const container = this.contentRef.nativeElement;
      const offsetTop = el.offsetTop - 180;
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }

  onScroll(): void {
    if (!this.contentRef) return;
    const el = this.contentRef.nativeElement;
    const scrollTop = el.scrollTop;
    const height = el.clientHeight;
    const scrollHeight = el.scrollHeight;

    if (scrollTop + height >= scrollHeight - 10) {
      this.activeSection = this.sections[this.sections.length - 1].key;
      return;
    }

    let current = this.sections[0].key;
    this.sections.forEach((sec) => {
      const target = document.getElementById(sec.id);
      // ชดเชย Sticky Header ในการคำนวณ 180px
      if (target && (target.offsetTop - 180 - height * 0.2) <= scrollTop) {
        current = sec.key;
      }
    });
    this.activeSection = current;
  }

  renderOverviewChart(): void {
    const canvas = document.getElementById('overviewBarChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.overviewChart) {
      this.overviewChart.destroy();
    }
    // เพิ่มการเคลียร์ instance เดิมที่อาจจะตกค้างใน Canvas (กรณีไปหน้าอื่นแล้วกลับมา)
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    // Get data from overviewData
    const labels = this.overviewData.map((d: any) => d.courseName);
    const evaluatedData = this.overviewData.map((d: any) => d.evaluatedCount);
    const pendingData = this.overviewData.map((d: any) => d.pendingCount);

    this.overviewChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'ประเมินแล้ว',
            data: evaluatedData,
            backgroundColor: '#6366f1',
            borderRadius: 6,
          },
          {
            label: 'ยังไม่ประเมิน',
            data: pendingData,
            backgroundColor: '#cbd5e1',
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Sarabun, sans-serif', size: 14 }
            }
          },
          tooltip: {
            callbacks: {
              footer: (tooltipItems: any) => {
                if (tooltipItems[0].datasetIndex === 1) {
                  return 'คลิกเพื่อดูรายชื่อผู้ที่ยังไม่ประเมินของวิชานี้';
                }
                return '';
              }
            }
          }
        },
        onClick: (event: any, activeElements: any) => {
          if (activeElements.length > 0) {
            const datasetIndex = activeElements[0].datasetIndex;
            const dataIndex = activeElements[0].index;
            
            // ถ้าคลิกที่แท่ง "ยังไม่ประเมิน"
            if (datasetIndex === 1) {
              const selectedCourse = this.overviewData[dataIndex].courseName;
              this.selectedSubjectForPendingList = selectedCourse;
              this.cdr.detectChanges();
              
              // เลื่อนลงมาที่ส่วนตาราง
              this.scrollTo('pending-section');
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: this.totalUsers,
            ticks: { stepSize: 10 }
          },
          x: {
            ticks: {
              font: { family: 'Sarabun, sans-serif', size: 12 }
            }
          }
        }
      }
    });
  }

  getChartWidth(): number {
    const minWidthPerItem = 90; // ลดขนาดความกว้างต่อแท่งลงนิดนึงตามที่ขอ
    const itemsCount = this.overviewData && this.overviewData.length > 0 
      ? this.overviewData.length 
      : this.filteredCourses.length;
    
    // โหมดเต็มจอก็ให้เล็กลงมาหน่อยด้วย (130px)
    const multiplier = this.isChartExpanded ? 130 : minWidthPerItem;
    return Math.max(1000, itemsCount * multiplier);
  }

  get filteredCourses(): Course[] {
    if (!this.selectedCurriculum || this.selectedCurriculum === 'ALL') {
      return this.allCourses;
    }
    return this.allCourses?.filter((c) => c.curriculumId === this.selectedCurriculum) || [];
  }

  get selectedCourseName(): string {
    if (this.selectedCourseNameSelect !== 'ALL' && this.selectedCourseNameSelect) {
      return this.selectedCourseNameSelect;
    }
    return this.courseName || '';
  }

  get currentBatchName(): string {
    return this.selectedBatch?.batch_name ? `(${this.selectedBatch.batch_name})` : '';
  }

  getScorePercent(score: number | string | null | undefined): string {
    if (score === '-' || score === null || score === undefined || isNaN(Number(score))) {
      return '-';
    }
    const num = Number(score);
    const percent = ((num / 5) * 100).toFixed(2);
    return `${percent}%`;
  }

  get displayStudentEvalData(): StudentEvalItem[] {
  if (!this.studentEvalData) return [];

  return this.studentEvalData.filter((item: any) => {
    // กรองตามหลักสูตร
    const matchCurriculum =
      !this.selectedCurriculum ||
      this.selectedCurriculum === 'ALL' ||
      item.curriculumId === this.selectedCurriculum;

    // กรองตามชื่อวิชา
    const targetCourse = (this.selectedCourseNameSelect || '').normalize('NFC').trim().toLowerCase();
    const matchCourse =
      !this.selectedCourseNameSelect ||
      this.selectedCourseNameSelect === 'ALL' ||
      item.courseName.normalize('NFC').trim().toLowerCase().includes(targetCourse);

    return matchCurriculum && matchCourse;
  });
}

  get displayPendingUsers(): PendingUser[] {
    if (!this.selectedSubjectForPendingList) return [];
    
    return this.allPendingUsers.filter((user: any) => {
      const matchCurriculum =
        !this.selectedCurriculum ||
        this.selectedCurriculum === 'ALL' ||
        user.curriculumId === this.selectedCurriculum;

      const matchSubject = user.courseName === this.selectedSubjectForPendingList;

      return matchCurriculum && matchSubject;
    });
  }

  get displayEvaluationResults(): EvaluationResult[] {
    if (!this.allEvaluationResults) return [];

    return this.allEvaluationResults.filter((item: any) => {
      const matchCurriculum =
        !this.selectedCurriculum ||
        this.selectedCurriculum === 'ALL' ||
        item.curriculumId === this.selectedCurriculum;

      const targetCourse = (this.selectedCourseNameSelect || '').trim().toLowerCase();
      const matchCourse =
        !this.selectedCourseNameSelect ||
        this.selectedCourseNameSelect === 'ALL' ||
        item.courseName.trim().toLowerCase().includes(targetCourse);

      return matchCurriculum && matchCourse;
    });
  }

  get overallLevel(): string {
    const avg = parseFloat(this.overallAverage);
    if (isNaN(avg)) return '-';
    if (avg >= 4.51) return 'มากที่สุด';
    if (avg >= 3.51) return 'มาก';
    if (avg >= 2.51) return 'ปานกลาง';
    if (avg >= 1.51) return 'พอใช้';
    return 'ปรับปรุง';
  }

  get evaluatedCount(): number {
    return Math.max(0, this.totalUsers - this.displayPendingUsers.length);
  }

  get evaluatedPercent(): number {
    return this.totalUsers > 0 ? Math.round((this.evaluatedCount / this.totalUsers) * 100) : 0;
  }

  get pendingPercent(): number {
    return this.totalUsers > 0
      ? Math.round((this.displayPendingUsers.length / this.totalUsers) * 100)
      : 0;
  }

  get chartGradient(): string {
    const deg = (this.evaluatedPercent / 100) * 360;
    return `conic-gradient(#6366f1 0deg ${deg}deg, #a5b4fc ${deg}deg 360deg)`;
  }

  getOverallQ(key: string): string {
    if (!this.displayEvaluationResults?.length) return '0.00';

    let validCount = 0;
    const sum = this.displayEvaluationResults.reduce((acc, item) => {
      const scoreObj = item.scores as any;
      const val = scoreObj?.[key];
      if (val !== undefined && val !== '-' && val !== null) {
        validCount++;
        return acc + Number(val);
      }
      return acc;
    }, 0);

    return validCount > 0 ? (sum / validCount).toFixed(2) : '0.00';
  }

  get overallAverage(): string {
    if (!this.displayEvaluationResults?.length) return '0.00';
    let validCount = 0;
    const sum = this.displayEvaluationResults.reduce((acc, item) => {
      if (item.level !== '-' && !isNaN(Number(item.averageScore))) {
        validCount++;
        return acc + Number(item.averageScore);
      }
      return acc;
    }, 0);
    return validCount > 0 ? (sum / validCount).toFixed(2) : '0.00';
  }

  onCurriculumChange() {
    this.selectedCourseNameSelect = 'ALL';
    setTimeout(() => this.renderOverviewChart(), 100);
  }

  toggleChartExpand() {
    this.isChartExpanded = !this.isChartExpanded;
    setTimeout(() => {
      if (this.overviewChart) {
        this.overviewChart.resize();
      }
    }, 100);
  }

  onChartWheel(event: WheelEvent) {
    const el = event.currentTarget as HTMLElement;
    
    // ตรวจสอบว่าเลื่อนสุดขอบซ้ายหรือขวาแล้วหรือยัง
    const atLeftEdge = el.scrollLeft === 0 && event.deltaY < 0;
    // ใช้ Math.abs หรือการปัดเศษเพื่อป้องกันปัญหาทศนิยมในการเปรียบเทียบขนาด
    const atRightEdge = Math.ceil(el.scrollLeft) >= (el.scrollWidth - el.clientWidth) && event.deltaY > 0;
    
    // ถ้ายังไม่สุดขอบซ้าย/ขวา ให้เปลี่ยนการเลื่อนบน-ล่าง เป็นซ้าย-ขวา แทน
    if (!atLeftEdge && !atRightEdge) {
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    }
  }

  exportExcel(): void {
    let elementToExport: HTMLElement | null = null;

    if (this.activeSection === 'overview') {
      elementToExport = document.querySelector('.pending-table');
    } else if (this.activeSection === 'results' || this.activeSection === 'teacher') {
      elementToExport = document.querySelector(`#sec-${this.activeSection} .results-table, #sec-${this.activeSection} .student-eval-table`);
    } else if (this.activeSection === 'course') {
      elementToExport = document.querySelector(`#sec-${this.activeSection}`);
    }

    if (!elementToExport) {
      alert('ไม่พบข้อมูลตารางใน Tab ปัจจุบันเพื่อ Export');
      return;
    }

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.table_to_sheet(elementToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ReportData');
      const fileName = `รายงานผลการประเมิน_${this.activeSection}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } else {
      console.warn('XLSX library is not loaded');
    }
  }

  exportPDF(): void {
    const element = document.querySelector('.page-wrap') as HTMLElement;

    if (!element) {
      alert('ไม่พบเนื้อหาเพื่อสร้าง PDF');
      return;
    }

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `รายงานผลการประเมิน_${this.activeSection}_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
      };
      html2pdf().set(opt).from(element).save();
    } else {
      console.warn('html2pdf library is not loaded');
    }
  }


}