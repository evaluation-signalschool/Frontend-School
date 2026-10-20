import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GeneralEvaluationService } from '../../../services/general-evaluation.service';
import { CourseService } from '../../../services/course.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-evaluation-fill',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './evaluation-fill.component.html',
  styleUrl: './evaluation-fill.component.scss',
})
export class EvaluationFillComponent implements OnInit {
  isLoading = true;
  formDetails: any = null;
  questions: any[] = [];

  batchId: number = 0;
  batchName: string = '';
  subjectId: string = '';
  type: string = '';
  courseTitle: string = '';

  // รายชื่อวิชาในรุ่นที่เลือก สำหรับแสดงผลในดรอปดาวน์
  availableSubjects: { id: any; name: string }[] = [];
  selectedSubjectId: string = ''; // subject ที่ผู้กรอกเลือก

  // สำหรับประเมิน
  instructorName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private generalEvaluationService: GeneralEvaluationService,
    private courseService: CourseService,
    private location: Location,
    private cdr: ChangeDetectorRef,
  ) {}

  getFormSubtitle(): string {
    switch (this.type) {
      case 'instructor':
        return 'คำอธิบาย : แบบประเมินชุดนี้สำหรับผู้เรียน ประเมินอาจารย์ผู้สอน';
      case 'teacher_course':
        return 'คำอธิบาย : แบบประเมินชุดนี้สำหรับครู-อาจารย์ผู้สอน ประเมินผู้เรียนในรายวิชา';
      case 'director':
        return 'คำอธิบาย : แบบประเมินชุดนี้สำหรับผู้เรียน ประเมินอาจารย์กำกับหลักสูตร';
      case 'committee':
        return 'คำอธิบาย : แบบประเมินชุดนี้สำหรับคณะกำกับหลักสูตร';
      case 'course':
        return 'คำอธิบาย : แบบประเมินชุดนี้สำหรับผู้เรียน ประเมินหลักสูตร';
      case 'followup_commander':
        return 'คำอธิบาย : แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับ ผบช.)';
      case 'followup_self':
        return 'คำอธิบาย : แบบประเมินผู้สำเร็จการฝึกอบรม (ผู้ฝึกอบรมประเมินตนเอง)';
      case 'followup_colleague':
        return 'คำอธิบาย : แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับเพื่อนร่วมงาน)';
      default:
        return 'คำอธิบาย : แบบประเมินในระบบ';
    }
  }

  getFormMainTitle(): string {
    if (!this.formDetails) return '';

    const formName = (this.formDetails.form_name || 'แบบประเมิน').trim();
    let batch = '';
    if (this.batchName) {
      const formattedBatch = this.batchName.startsWith('รุ่นที่') ? this.batchName : `รุ่นที่ ${this.batchName}`;
      if (!formName.includes(formattedBatch)) {
        batch = ` ${formattedBatch}`;
      }
    }

    if (this.courseTitle && this.courseTitle !== 'ทำแบบประเมิน' && !formName.includes(this.courseTitle)) {
      const trimmedCourse = this.courseTitle.trim();
      const subject = trimmedCourse.startsWith('วิชา') ? trimmedCourse : `วิชา${trimmedCourse}`;
      return `${formName}${batch} : ${subject}`;
    }

    return `${formName}${batch}`;
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.batchId = params['batchId'];
      this.batchName = params['batchName'] || `รุ่นที่ ${this.batchId}`; // ดึงชื่อรุ่นมา
      this.subjectId = params['subjectId'];
      this.type = params['type'] || 'instructor';
      this.courseTitle = params['courseTitle'] || 'ทำแบบประเมิน';

      if (this.batchId && this.type) {
        this.fetchQuestions();
      } else {
        this.isLoading = false;
        Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ข้อมูลไม่ครบถ้วน', confirmButtonText: 'ตกลง' });
      }
    });
  }

  fetchQuestions() {
    console.log('1. เริ่มเรียก API...', {
      batchId: this.batchId,
      type: this.type,
      subjectId: this.subjectId,
    });
    this.isLoading = true;

    this.generalEvaluationService
      .getEvaluationQuestions(this.batchId, this.type, this.subjectId)
      .subscribe({
        next: (res: any) => {
          console.log('2. API ตอบกลับสำเร็จ (Success):', res);
          try {
            if (res.success && res.data) {
              this.formDetails = res.data;
              // ป้องกันกรณี Backend ไม่ได้ส่ง questions กลับมา ให้เป็น Array ว่างแทน
              const loadedQuestions = res.data.questions || [];
              this.questions = loadedQuestions.map((q: any) => ({
                ...q,
                answer_score: null,
                answer_comment: '',
              }));

              // โหลดรายชื่อวิชาของรุ่นนี้มาเตรียมไว้สำหรับแสดงในดรอปดาวน์
              this.courseService.getSubjectsByBatch(this.batchId).subscribe({
                next: (subRes: any) => {
                  if (subRes.success && subRes.data) {
                    let allSubjects: { id: any; name: string }[] = [];
                    subRes.data.forEach((group: any) => {
                      if (group.subjects && Array.isArray(group.subjects)) {
                        group.subjects.forEach((s: any) => {
                          allSubjects.push({
                            id: s.id || s.subject_id || s.subjectId,
                            name: s.subject_name || s.name || 'ไม่ระบุชื่อวิชา',
                          });
                        });
                      }
                    });
                    // กรองวิชาซ้ำ ออก
                    this.availableSubjects = allSubjects.filter(
                      (s, idx, self) => idx === self.findIndex(t => t.id === s.id)
                    );
                    if (this.subjectId) {
                      this.selectedSubjectId = String(this.subjectId);
                    }
                    this.cdr.detectChanges();
                  }
                }
              });
            }
          } catch (e) {
            console.error('เกิดข้อผิดพลาดในการจัดการข้อมูล:', e);
          } finally {
            this.isLoading = false;
            this.cdr.detectChanges(); // สั่งอัปเดตการแสดงผลบนหน้าจอทันที
          }
        },
        error: (err: any) => {
          console.error('3. API ตอบกลับแบบ Error:', err);
          Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ไม่พบข้อมูลแบบประเมินในระบบ (อาจยังไม่ได้สร้างลิงก์สำหรับรุ่นนี้)', confirmButtonText: 'ตกลง' });
          this.isLoading = false;
          this.cdr.detectChanges(); // สั่งอัปเดตการแสดงผลบนหน้าจอทันที
        },
      });
  }

  // กรองคำถามตามรายวิชาที่เลือก (คำถามทั่วไปและคำถามเฉพาะวิชานั้น)
  get displayedQuestions(): any[] {
    if (!this.questions) return [];
    return this.questions.filter((q) => {
      // ถ้าคำถามนี้ไม่ได้ผูกเฉพาะวิชา (เป็นคำถามทั่วไป) -> แสดงทุกวิชา
      if (!q.subject_for || q.subject_for === '' || q.subject_for === 'all') {
        return true;
      }
      // ถ้าคำถามนี้เจาะจงเฉพาะวิชา -> แสดงเฉพาะเมื่อวิชาตรงกับที่กดเข้ามา
      const currentSubject = this.subjectId || this.selectedSubjectId;
      if (currentSubject) {
        return String(q.subject_for) === String(currentSubject);
      }
      return true;
    });
  }

  // ฟังก์ชันทำความสะอาดข้อความ ป้องกันการโจมตี XSS
  sanitizeText(text: string | null | undefined): string | null {
    if (!text) return null;
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  onCommentInput(q: any): void {
    // ให้ผู้ใช้พิมพ์ได้ตามปกติ เพื่อให้การตรวจสอบความปลอดภัยทำงานตอนกดส่ง
  }

  onSubmit() {
    // Validate ว่าตอบครบทุกข้อที่แสดงอยู่ (displayedQuestions)
    const unanswered = this.displayedQuestions.find(
      (q) => (q.question_type === 'choice' && !q.answer_score) || 
             ((q.question_type === 'dropdown' || q.question_type === 'dropdown_subject') && (!q.answer_comment || q.answer_comment.trim() === ''))
    );
    if (unanswered) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาตอบคำถามให้ครบทุกข้อครับ', confirmButtonText: 'ตกลง' });
      return;
    }

    if (!this.instructorName && this.type === 'instructor') {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาระบุชื่ออาจารย์ผู้สอนครับ', confirmButtonText: 'ตกลง' });
      return;
    }

    // ตรวจสอบความปลอดภัย ป้องกันการกรอกสคริปต์อันตราย (XSS)
    const dangerousScriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<[^>]*script|javascript:|onerror\s*=|onload\s*|<iframe|<embed|<object/i;
    const hasMaliciousScript = this.displayedQuestions.some(
      (q) => q.answer_comment && dangerousScriptRegex.test(q.answer_comment)
    );

    if (hasMaliciousScript) {
      Swal.fire({
        icon: 'error',
        title: 'ส่งไม่สำเร็จ: กรอกสคริปต์อันตราย (Security)',
        text: 'ระบบตรวจพบแท็กหรือสคริปต์ที่เป็นอันตราย เพื่อความปลอดภัย (XSS Prevention) ไม่อนุญาตให้ส่งข้อมูลนี้',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#d33'
      });
      return;
    }

    const answers = this.displayedQuestions.map((q) => ({
      question_id: q.id,
      score_value: q.question_type === 'choice' ? q.answer_score : null,
      comment: (q.question_type === 'text' || q.question_type === 'dropdown' || q.question_type === 'dropdown_subject') 
        ? this.sanitizeText(q.answer_comment) 
        : null,
    }));

    const studentDataStr = localStorage.getItem('student_data');
    const studentId = studentDataStr ? JSON.parse(studentDataStr).student_id : null;

    const payload = {
      studentId: studentId,
      formId: this.formDetails.form_id,
      subjectId: this.selectedSubjectId || this.subjectId, // ใช้รหัสวิชาที่เลือกจากดรอปดาวน์
      instructorName: this.instructorName,
      answers: answers,
    };

    this.generalEvaluationService.submitEvaluationAnswer(payload).subscribe({
      next: (res: any) => {
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: 'ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณครับ!',
            confirmButtonText: 'ตกลง'
          }).then(() => {
            this.location.back();
          });
        }
      },
      error: (err: any) => {
        console.error('Submit error', err);

        // กรณี Server Down (เช่น HTTP 500) หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้
        if (!err.status || err.status === 0 || err.status >= 500) {
          Swal.fire({
            icon: 'error',
            title: 'ส่งไม่สำเร็จ',
            text: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้งในภายหลัง',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#d33'
          });
          return;
        }

        const msg = err.error?.message || 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้งในภายหลัง';
        const isSecurity = msg.includes('สคริปต์') || msg.includes('Security');
        Swal.fire({
          icon: 'error',
          title: isSecurity ? 'ส่งไม่สำเร็จ: กรอกสคริปต์อันตราย (Security)' : 'ส่งไม่สำเร็จ',
          text: msg,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#d33'
        });
      },
    });
  }

  goBack() {
    this.location.back();
  }
}
