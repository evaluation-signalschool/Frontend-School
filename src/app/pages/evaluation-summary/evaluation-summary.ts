import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
  teacherName: string;
  curriculumId: string;
  courseId: string;
  courseName: string;
  scores: {
    q1: number; q2: number; q3: number; q4: number; q5: number; q6: number; q7: number;
  };
  averageScore: number;
  level: 'ปานกลาง' | 'มาก' | 'มากที่สุด';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './evaluation-summary.html',
  styleUrls: ['./evaluation-summary.scss'],
})
export class EvaluationSummaryComponent implements OnInit {
  totalCount: number = 57;
  totalUsers: number = 40;
  courseName: string = '';
  
  // Tab สถานะปัจจุบัน
  activeTab: string = 'overview';
  
  selectedCurriculum: string = 'ALL';
  selectedCourseNameSelect: string = 'ALL';

  curriculumList: Curriculum[] = [
    { id: 'CS-2024', name: 'วิทยาการคอมพิวเตอร์ (หลักสูตรปรับปรุง 2567)' },
    { id: 'IT-2024', name: 'เทคโนโลยีสารสนเทศ (หลักสูตรปรับปรุง 2567)' },
  ];

  allCourses: Course[] = [
    { name: 'ฝ่ายอำนวยการ', curriculumId: 'CS-2024' },
    { name: 'ระเบียบการนำหน่วย', curriculumId: 'CS-2024' },
    { name: 'ภาษาอังกฤษทางทหาร', curriculumId: 'IT-2024' },
  ];

  allPendingUsers: PendingUser[] = [
    {
      studentId: '6501001',
      name: 'นายสมชาย สายลุย',
      curriculumId: 'CS-2024',
      courseId: 'c1',
      courseName: 'ฝ่ายอำนวยการ',
    },
    {
      studentId: '6501005',
      name: 'นางสาวนภา แจ่มใส',
      curriculumId: 'CS-2024',
      courseId: 'c1',
      courseName: 'ฝ่ายอำนวยการ',
    },
    {
      studentId: '6501012',
      name: 'นายกิตติ เก่งมาก',
      curriculumId: 'CS-2024',
      courseId: 'c2',
      courseName: 'ระเบียบการนำหน่วย',
    },
    {
      studentId: '6502088',
      name: 'นายอนันต์ ขยันเรียน',
      curriculumId: 'IT-2024',
      courseId: 'c3',
      courseName: 'ภาษาอังกฤษทางทหาร',
    },
  ];

  allEvaluationResults: EvaluationResult[] = [
    {
      teacherName: 'ดร. สมศักดิ์ รักสอน',
      curriculumId: 'CS-2024',
      courseId: 'c1',
      courseName: 'ฝ่ายอำนวยการ',
      scores: { q1: 5, q2: 5, q3: 4, q4: 5, q5: 5, q6: 4, q7: 5 },
      averageScore: 4.71,
      level: 'มากที่สุด',
    },
    {
      teacherName: 'ผศ. วิภา กิจเจริญ',
      curriculumId: 'CS-2024',
      courseId: 'c2',
      courseName: 'ระเบียบการนำหน่วย',
      scores: { q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, q6: 4, q7: 5 },
      averageScore: 4.14,
      level: 'มาก',
    },
    {
      teacherName: 'อ. ณัฐพล คนขยัน',
      curriculumId: 'IT-2024',
      courseId: 'c3',
      courseName: 'ภาษาอังกฤษทางทหาร',
      scores: { q1: 3, q2: 3, q3: 4, q4: 3, q5: 4, q6: 3, q7: 3 },
      averageScore: 3.28,
      level: 'ปานกลาง',
    },
  ];

  // เพิ่มข้อมูลวิชาที่ 3 เพื่อให้ครอบคลุมวิชาทั้งหมดในระบบ
  studentEvalData: StudentEvalItem[] = [
    {
      courseName: 'ฝ่ายอำนวยการ',
      curriculumId: 'CS-2024',
      score1: 4.80, score2: 4.50, score3: 4.70, score4: 4.60, score5: 4.90,
      avgScore: 4.70, level: 'มากที่สุด'
    },
    {
      courseName: 'ระเบียบการนำหน่วย',
      curriculumId: 'CS-2024',
      score1: 4.30, score2: 4.20, score3: 4.40, score4: 4.10, score5: 4.50,
      avgScore: 4.30, level: 'มาก'
    },
    {
      courseName: 'ภาษาอังกฤษทางทหาร',
      curriculumId: 'CS-2024',
      score1: 3.50, score2: 3.80, score3: 3.60, score4: 3.70, score5: 3.90,
      avgScore: 3.70, level: 'มาก'
    }
  ];

  studentEvalSummary = {
    avg1: 4.20, avg2: 4.16, avg3: 4.23, avg4: 4.13, avg5: 4.43,
    totalAvg: 4.23, totalLevel: 'มาก'
  };

  constructor(private route: ActivatedRoute) {}

 ngOnInit(): void {
  this.route.queryParams.subscribe((params) => {
    if (params['course']) {
      const rawCourse = params['course'];
      this.courseName = decodeURIComponent(rawCourse).trim();
      this.selectedCourseNameSelect = this.courseName;
      this.selectedCurriculum = 'ALL';
      // ❌ ลบ this.activeTab = ... ตรงนี้ออก! อย่าสั่งสลับ tab ในนี้
    }
  });
}

  // ฟังก์ชันสำหรับเปลี่ยน Tab
  selectTab(tabName: string): void {
    this.activeTab = tabName;
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

  return this.studentEvalData.filter((item) => {
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
    return this.allPendingUsers.filter((user) => {
      const matchCurriculum =
        !this.selectedCurriculum ||
        this.selectedCurriculum === 'ALL' ||
        user.curriculumId === this.selectedCurriculum;

      const targetCourse = (this.selectedCourseNameSelect || '').trim().toLowerCase();
      const matchCourse =
        !this.selectedCourseNameSelect ||
        this.selectedCourseNameSelect === 'ALL' ||
        user.courseName.trim().toLowerCase().includes(targetCourse);

      return matchCurriculum && matchCourse;
    });
  }

  get displayEvaluationResults(): EvaluationResult[] {
    if (!this.allEvaluationResults) return [];

    return this.allEvaluationResults.filter((item) => {
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

    const sum = this.displayEvaluationResults.reduce((acc, item) => {
      const scoreObj = item.scores as Record<string, number>;
      return acc + (scoreObj?.[key] || 0);
    }, 0);

    return (sum / this.displayEvaluationResults.length).toFixed(2);
  }

  get overallAverage(): string {
    if (!this.displayEvaluationResults?.length) return '0.00';
    const sum = this.displayEvaluationResults.reduce(
      (acc, item) => acc + (item.averageScore || 0),
      0,
    );
    return (sum / this.displayEvaluationResults.length).toFixed(2);
  }

  onCurriculumChange() {
    this.selectedCourseNameSelect = 'ALL';
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

    if (this.activeTab === 'overview') {
      elementToExport = document.querySelector('.pending-table');
    } else if (this.activeTab === 'results' || this.activeTab === 'teacher_eval') {
      elementToExport = document.querySelector('.results-table, .student-eval-table');
    } else if (this.activeTab === 'course_eval') {
      elementToExport = document.querySelector('.matrix-table');
    }

    if (!elementToExport) {
      alert('ไม่พบข้อมูลตารางใน Tab ปัจจุบันเพื่อ Export');
      return;
    }

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.table_to_sheet(elementToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ReportData');
      const fileName = `รายงานผลการประเมิน_${this.activeTab}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } else {
      console.warn('XLSX library is not loaded');
    }
  }

  exportPDF(): void {
    const element = document.querySelector('.page-container') as HTMLElement;

    if (!element) {
      alert('ไม่พบเนื้อหาเพื่อสร้าง PDF');
      return;
    }

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `รายงานผลการประเมิน_${this.activeTab}_${new Date().getTime()}.pdf`,
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