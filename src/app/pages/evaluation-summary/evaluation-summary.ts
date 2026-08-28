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
  score1: number;
  score2: number;
  score3: number;
  score4: number;
  score5: number;
  avgScore: number;
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
  courseEvalData: any[] = []; // หรือ type ที่ตรง

  studentEvalSummary = {
    avg1: 4.20, avg2: 4.16, avg3: 4.23, avg4: 4.13, avg5: 4.43,
    totalAvg: 4.23, totalLevel: 'มาก'
  };

  selectedSubjectForPendingList: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private generalEvaluationService: GeneralEvaluationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['course']) {
        const rawCourse = params['course'];
        this.courseName = decodeURIComponent(rawCourse).trim();
        this.selectedCourseNameSelect = 'ALL';
        this.selectedCurriculum = 'ALL';
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
    console.log('loadBatches() called. this.courseName:', this.courseName);
    this.courseService.getCourses().subscribe({
      next: (response) => {
        console.log('getCourses response:', response);
        if (response.success && response.data) {
          if (this.courseName) {
            const matchTerm = this.courseName.replace(/[\s\(\)\-\.]/g, '').toLowerCase();
            const courseGroup = response.data.find((c: any) => {
              if (!c.course_name) return false;
              const cName = c.course_name.replace(/[\s\(\)\-\.]/g, '').toLowerCase();
              return cName.includes(matchTerm) || matchTerm.includes(cName);
            });
            console.log(`Searching for "${matchTerm}", found:`, courseGroup);
            
            if (courseGroup && courseGroup.batches) {
              this.batches = courseGroup.batches.filter((b: any) => b.is_active !== false);
              console.log('Active batches:', this.batches);
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
            console.log('All active batches:', this.batches);
          }
          this.selectedBatch = null;
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
      this.courseEvalData = [];
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
          this.courseEvalData = data.courseResults || [];
          
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
    if (this.selectedCourseNameSelect === 'ALL') return '';
    return this.selectedCourseNameSelect;
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
    if (avg >= 4.5) return 'มากที่สุด';
    if (avg >= 3.5) return 'มาก';
    if (avg >= 2.5) return 'ปานกลาง';
    if (avg >= 1.5) return 'น้อย';
    return 'น้อยที่สุด';
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

  // ตารางที่ 1 (7 หัวข้อ)
courseEvalPart1 = {
  topics: [
    'ด้านวัคถุประสงค์และเนื้อหาวิชาต่างๆ',
    'ด้านความสอดคล้องของเนื้อหาวิชาในหลักสูตร',
    'ด้านนำความรู้ไปใช้ประโยชน์',
    'ด้ารการจัดกิจกรรมต่างๆ ในหลักสูตร',
    'ด้านความพร้อมในการผ่านสื่อ',
    'ด้านระบบสารสนเทศ',
    'ข้อเสนอแนะอื่นๆ'
  ],
  scores: [4.80, 4.55, 4.40, 4.25, 3.90, 4.10 , 4.20],
  levels: ['ดีมากที่สุด', 'ดีมาก', 'ดีมาก', 'ดีมาก', 'ดี', 'ดีมาก', 'ดีมาก']
};

// ตารางที่ 2 (5 หัวข้อ)
courseEvalPart2 = {
  topics: [
    'ด้านการให้คำแนะนำ',
    'ด้านการพัฒนาผู้เรียน',
    'ด้านการให้คำแนะนำเกี่ยวกับระเบียบข้อบังคับ แก่ผู้เรียน',
    'ด้านมนุษยสัมพันธ์',
    'ข้อเสนอแนะอื่นๆ'
  ],
  scores: [4.30, 4.15, 3.85, 4.00, 4.23],
  levels: ['ดีมาก', 'ดีมาก', 'ดี', 'ดีมาก', 'ดีมาก']
};

// ตารางที่ 3 (6 หัวข้อ)
courseEvalPart3 = {
  topics: [
    'ด้านการจัดการเรียนรู้',
    'ด้านเนื้อหารายวิชา',
    'ด้านกิจกรรมเสริมเพื่อเพิ่มทักษะ',
    'ด้านทรัพยากรที่ใช้ในหลักสูตร',
    'ด้านการปฏิบัติตามกฏระเบียบของโรงเรียนความมีวินัยและการตรงต่อเวลาของผู้เรียน',
    'ข้อเสนอแนะอื่นๆ'
  ],
  scores: [4.60, 4.50, 4.35, 4.10, 3.95, 4.00 ],
  levels: ['ดีมากที่สุด', 'ดีมาก', 'ดีมาก', 'ดีมาก', 'ดี', 'ดีมาก']
};

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