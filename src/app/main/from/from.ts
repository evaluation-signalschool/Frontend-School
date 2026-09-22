import { CommonModule } from '@angular/common';

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CourseService, CourseGroup, BatchItem } from '../../services/course.service';
import Swal from 'sweetalert2';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';

export interface Choice {
  id?: number;
  choice_text: string;
  score_value: number;
}

export interface Question {
  id?: number;
  question_text: string;
  question_type: 'choice' | 'text' | 'dropdown' | 'dropdown_subject'; // dropdown (พิมพ์เอง) และ dropdown_subject (ดึงวิชาอัตโนมัติ)
  choices?: Choice[];
  subject_for?: string | number; // เพิ่ม: ผูกคำถามกับวิชาเฉพาะ (optional)
}

@Component({
  selector: 'app-from',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, FormsModule],
  templateUrl: './from.html',
  styleUrl: './from.scss',
})
export class From implements OnInit {
  isEditMode: boolean = false;
  selectedFormId: any = null;

  // สำหรับเก็บข้อมูลหลักสูตรและรุ่น
  courseGroups: CourseGroup[] = [];
  availableBatches: BatchItem[] = [];

  // กลุ่มผู้ประเมิน (Target Audience)
  targetGroups = [
    { value: 'student', label: 'สำหรับผู้เรียน (นักเรียน)' },
    { value: 'teacher', label: 'สำหรับครู-อาจารย์' },
    { value: 'committee', label: 'สำหรับคณะกำกับหลักสูตร' },
    { value: 'followup', label: 'สำหรับติดตามผู้สำเร็จการศึกษา' },
  ];

  // ประเภทของฟอร์ม (Form Types) แยกตาม Target Group
  formTypesMap: { [key: string]: { value: string; label: string }[] } = {
    student: [
      { value: 'instructor', label: 'ประเมินอาจารย์ผู้สอน' },
      { value: 'director', label: 'แบบประเมินอาจารย์กำกับหลักสูตร' },
      { value: 'course', label: 'แบบประเมินหลักสูตร' },
    ],
    teacher: [
      { value: 'teacher_course', label: 'แบบประเมินผู้เรียนในรายวิชา (โดยอาจารย์ผู้สอน)' },
    ],
    committee: [
      { value: 'committee', label: 'แบบประเมินสำหรับคณะกำกับหลักสูตร' },
    ],
    followup: [
      { value: 'followup_commander', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับ ผบช.)' },
      { value: 'followup_self', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (ผู้ฝึกอบรมประเมินตนเอง)' },
      { value: 'followup_colleague', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับเพื่อนร่วมงาน)' },
    ]
  };

  // ตัวแปรสำหรับเก็บประเภทแบบฟอร์มแบบ Custom ที่ผู้ใช้กดเพิ่มเอง
  customFormTypes: { value: string; label: string; targetGroup: string }[] = [];

  // โครงสร้างตัวแปรสำหรับผูกข้อมูลกับทุกช่องกรอกในฟอร์ม
  formData = {
    courseName: '',
    targetGroup: '',
    formType: '',
    formName: '',
    formDescription: '', // ✅ ใหม่: คำชี้แจง/วัตถุประสงค์
    generationId: '',
    subjectId: '',
    questions: [] as Question[],
  };

  // รายการวิชาสำหรับรุ่นนั้นๆ
  availableSubjects: any[] = [];

  // รายการแบบฟอร์มที่มี (สำหรับแสดงในตารางด้านล่าง)
  formList: any[] = [];

  constructor(
    private courseService: CourseService,
    private generalEvaluationService: GeneralEvaluationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchCourses();
    // เพิ่มคำถามตั้งต้น 1 ข้อให้เวลาเปิดหน้าจอมา
    this.addQuestion();
  }

  fetchCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.courseGroups = res.data;
          this.fetchAllForms();
        }
      },
      error: (err) => {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลหลักสูตร:', err);
        this.fetchAllForms();
      },
    });
  }

  fetchAllForms(): void {
    this.generalEvaluationService.getAllForms().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const mappedData = res.data.map((item: any) => {
            let cName = 'ไม่ระบุ';
            let gName = 'ไม่ระบุรุ่น';
            if (item.batch_id) {
              for (const group of this.courseGroups) {
                const foundBatch = group.batches?.find((b) => b.batch_id == item.batch_id);
                if (foundBatch) {
                  cName = group.course_name;
                  gName = foundBatch.batch_name;
                  break;
                }
              }
            }

            const typeLabel = this.getFormTypeLabel(item.evaluation_type);
            const tg = item.target_group || 'student';

            // ถ้าเป็นประเภทแบบฟอร์มที่แอดมินสร้างใหม่ (ไม่มีใน list พื้นฐาน) ให้เพิ่มเข้าไปใน customFormTypes อัตโนมัติ
            const existsInBase = Object.values(this.formTypesMap).flat().find(t => t.value === item.evaluation_type);
            const existsInCustom = this.customFormTypes.find(t => t.value === item.evaluation_type);
            if (!existsInBase && !existsInCustom && item.evaluation_type && item.evaluation_type.trim() !== '') {
              this.customFormTypes.push({ value: item.evaluation_type, label: item.evaluation_type, targetGroup: tg });
            }

            return {
              id: item.id,
              courseName: cName,
              targetGroup: tg,
              generationId: item.batch_id,
              generationName: gName,
              formType: item.evaluation_type,
              formTypeName: typeLabel,
              formName: item.form_name,
              formDescription: item.form_description || '',
              subjectId: item.subject_id || '',
              subjectName: item.subject_name || '-',
              isActive: item.is_active === 1 || item.is_active === true,
            };
          });

          this.formList = [...mappedData];
          this.generateTableData();

          this.cdr.detectChanges();

        } else {
          this.formList = [];
          this.generateTableData();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลแบบฟอร์ม:', err);
        this.formList = [];
        this.generateTableData();
        this.cdr.detectChanges();
      },
    });
  }

  onCourseChange(resetGen: boolean = true): void {
    const selectedGroup = this.courseGroups.find((c) => c.course_name === this.formData.courseName);
    if (selectedGroup) {
      this.availableBatches = selectedGroup.batches;
    } else {
      this.availableBatches = [];
    }

    if (resetGen) {
      this.formData.generationId = '';
      this.formData.subjectId = '';
    }
  }

  onGenerationChange(resetSubject: boolean = true): void {
    if (resetSubject) {
      this.formData.subjectId = '';
    }
    if (this.formData.generationId) {
      this.courseService.getSubjectsByBatch(this.formData.generationId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            let allSubjects: any[] = [];
            res.data.forEach((group: any) => {
              if (group.subjects && Array.isArray(group.subjects)) {
                group.subjects.forEach((s: any) => {
                  allSubjects.push({
                    id: s.id || s.subject_id || s.subjectId,
                    name: s.subject_name || s.name || 'ไม่ระบุชื่อวิชา',
                  });
                });
              }
            });
            this.availableSubjects = allSubjects;
          } else {
            this.availableSubjects = [];
          }
        },
        error: (err) => {
          console.error('เกิดข้อผิดพลาดในการดึงข้อมูลวิชา:', err);
          this.availableSubjects = [];
        },
      });
    } else {
      this.availableSubjects = [];
    }
  }

  onTypeChange(): void {
    if (this.formData.formType !== 'instructor') {
      this.formData.subjectId = '';
    }
  }

  // ใช้เป็นตัวเลือกแสดงใน Dropdown "ประเภทแบบฟอร์ม" ตาม targetGroup ที่เลือก
  get availableFormTypes(): { value: string; label: string }[] {
    if (!this.formData.targetGroup) return [];
    
    // แบบฟอร์มพื้นฐาน
    const baseTypes = this.formTypesMap[this.formData.targetGroup] || [];
    // แบบฟอร์มที่เพิ่มใหม่
    const customTypes = this.customFormTypes
      .filter((t) => t.targetGroup === this.formData.targetGroup)
      .map((t) => ({ value: t.value, label: t.label }));
      
    return [...baseTypes, ...customTypes];
  }

  // รวมประเภทฟอร์มทั้งหมดสำหรับใช้ในตัวกรองตาราง
  get allFormTypesFlat(): { value: string; label: string }[] {
    const baseTypes = Object.values(this.formTypesMap).flat();
    const customTypes = this.customFormTypes.map(t => ({ value: t.value, label: t.label }));
    
    // กรองตัวที่ซ้ำกันออก
    const all = [...baseTypes, ...customTypes];
    const unique = [];
    const seen = new Set();
    for (const item of all) {
      if (!seen.has(item.value)) {
        seen.add(item.value);
        unique.push(item);
      }
    }
    return unique;
  }

  getFormTypeLabel(value: string): string {
    if (!value) return 'ไม่ระบุ';
    const allTypes = this.allFormTypesFlat;
    const found = allTypes.find(t => t.value === value);
    return found ? found.label : value;
  }

  onTargetGroupChange(): void {
    // รีเซ็ตฟอร์มย่อยเมื่อเปลี่ยนเป้าหมาย
    this.formData.formType = '';
    this.formData.subjectId = '';
  }

  isCustomFormType(typeValue: string): boolean {
    return this.customFormTypes.some((t) => t.targetGroup === this.formData.targetGroup && t.value === typeValue);
  }

  async removeCustomFormType() {
    if (!this.formData.formType) return;

    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: `คุณต้องการลบประเภทแบบประเมินนี้ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f44336',
      cancelButtonColor: '#999',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      this.customFormTypes = this.customFormTypes.filter((t) => !(t.targetGroup === this.formData.targetGroup && t.value === this.formData.formType));
      this.formData.formType = '';
      this.onTypeChange();
      Swal.fire({
        icon: 'success',
        title: 'ลบสำเร็จ',
        showConfirmButton: false,
        timer: 1500,
      });
    }
  }

  async addNewFormType() {
    if (!this.formData.targetGroup) {
      Swal.fire({
        icon: 'warning',
        title: 'แจ้งเตือน',
        text: 'กรุณาเลือกกลุ่มเป้าหมาย (Target Group) ก่อนเพิ่มประเภทใหม่',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    const { value: newTypeLabel } = await Swal.fire({
      title: 'เพิ่มประเภทแบบประเมินใหม่',
      input: 'text',
      inputLabel: 'ชื่อประเภทแบบประเมิน',
      inputPlaceholder: 'เช่น แบบประเมินความพึงพอใจการศึกษาดูงาน',
      showCancelButton: true,
      confirmButtonText: 'เพิ่มประเภท',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value: string) => {
        if (!value || !value.trim()) {
          return 'กรุณาระบุชื่อประเภทแบบประเมิน!';
        }
        
        const existingBase = this.formTypesMap[this.formData.targetGroup]?.find((t) => t.label === value.trim() || t.value === value.trim());
        const existingCustom = this.customFormTypes.find((t) => t.targetGroup === this.formData.targetGroup && (t.label === value.trim() || t.value === value.trim()));
        
        if (existingBase || existingCustom) {
          return 'ประเภทแบบประเมินนี้มีอยู่แล้วในกลุ่มนี้!';
        }
        return null;
      },
    });

    if (newTypeLabel) {
      const newValue = newTypeLabel.trim();
      this.customFormTypes.push({ value: newValue, label: newValue, targetGroup: this.formData.targetGroup });
      this.formData.formType = newValue;
      this.onTypeChange();

      Swal.fire({
        icon: 'success',
        title: 'เพิ่มสำเร็จ',
        text: `เพิ่ม "${newValue}" เรียบร้อยแล้ว`,
        timer: 1500,
        showConfirmButton: false,
      });
    }
  }


  // ==========================================
  // ส่วนจัดการคำถาม (Dynamic Form Builder)
  // ==========================================

  addQuestion() {
    this.formData.questions.push({
      question_text: '',
      question_type: 'choice',
      choices: [
        { choice_text: '', score_value: 5 },
        { choice_text: '', score_value: 3 },
        { choice_text: '', score_value: 1 },
      ],
    });
  }

  removeQuestion(index: number) {
    this.formData.questions.splice(index, 1);
  }

  addChoice(qIndex: number) {
    if (!this.formData.questions[qIndex].choices) {
      this.formData.questions[qIndex].choices = [];
    }
    this.formData.questions[qIndex].choices!.push({ choice_text: '', score_value: 0 });
    this.cdr.detectChanges();
  }

  removeChoice(qIndex: number, cIndex: number) {
    if (this.formData.questions[qIndex].choices) {
      this.formData.questions[qIndex].choices!.splice(cIndex, 1);
      this.cdr.detectChanges();
    }
  }

  onQuestionTypeChange(qIndex: number) {
    const q = this.formData.questions[qIndex];
    if (q.question_type === 'text' || q.question_type === 'dropdown_subject') {
      // สำหรับพิมพ์ตอบ และ ดรอปดาวน์ดึงรายวิชาอัตโนมัติ ไม่ต้องมี choices
      q.choices = [];
    } else if (q.question_type === 'dropdown') {
      // สำหรับดรอปดาวน์แบบกำหนดตัวเลือกเอง
      if (!q.choices || q.choices.length === 0) {
        q.choices = [
          { choice_text: '', score_value: 0 },
          { choice_text: '', score_value: 0 },
        ];
      }
    } else {
      // choice: หลายตัวเลือก (Radio)
      if (!q.choices || q.choices.length === 0) {
        q.choices = [
          { choice_text: '', score_value: 5 },
          { choice_text: '', score_value: 3 },
          { choice_text: '', score_value: 1 },
        ];
      }
    }
  }

  // ==========================================
  // ส่วนสร้างและอัปเดตฟอร์ม (เรียก API)
  // ==========================================

  isDuplicateForm(): boolean {
    if (!this.formData.generationId || !this.formData.formType) return false;
    
    // ค้นหาว่ามีฟอร์มประเภทเดียวกันในรุ่นเดียวกันถูกสร้างไว้แล้วหรือไม่
    const existingForm = this.formList.find(
      (f) => f.generationId == this.formData.generationId && f.formType === this.formData.formType
    );
    
    return !!existingForm;
  }

  onCreateForm() {
    if (!this.formData.courseName || !this.formData.generationId || !this.formData.formType) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณาเลือกหลักสูตร รุ่น และประเภทแบบฟอร์มให้ครบถ้วน',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#673ab7',
      });
      return;
    }

    if (this.isDuplicateForm()) {
      Swal.fire({
        icon: 'error',
        title: 'สร้างไม่ได้',
        text: 'มีการสร้างแบบฟอร์มประเภทนี้สำหรับรุ่นนี้ไปแล้ว ไม่สามารถสร้างซ้ำได้',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#f44336',
      });
      return;
    }

    if (!this.formData.questions || this.formData.questions.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีคำถาม',
        text: 'กรุณาสร้างคำถามอย่างน้อย 1 ข้อ',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#673ab7',
      });
      return;
    }

    const cleanSubjectId =
      this.formData.subjectId === 'undefined' || !this.formData.subjectId
        ? null
        : this.formData.subjectId;

    const payload = {
      courseName: this.formData.courseName,
      targetGroup: this.formData.targetGroup || 'student',
      formType: this.formData.formType,
      formName: this.formData.formName,
      formDescription: this.formData.formDescription || '', // ✅ ส่งคำชี้แจงไปด้วย
      generationId: this.formData.generationId || null,
      subjectId: cleanSubjectId,
      questions: this.formData.questions,
    };

    console.log('กำลังสร้างฟอร์มใหม่ด้วยข้อมูลนี้:', payload);

    this.generalEvaluationService.createGeneralEvaluation(payload).subscribe({
      next: (res) => {
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'สร้างฟอร์มสำเร็จ!',
            text: 'แบบฟอร์มถูกบันทึกลงระบบเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false,
          });
          this.resetForm();
          this.fetchAllForms();
          this.cdr.detectChanges();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: res.message || 'ไม่สามารถสร้างฟอร์มได้',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#f44336',
          });
        }
      },
      error: (err) => {
        console.error('Error จาก Backend:', err);
        Swal.fire({
          icon: 'error',
          title: 'เซิร์ฟเวอร์ขัดข้อง',
          text: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#f44336',
        });
      },
    });
  }

  onEditAction(item: any) {
    this.isEditMode = true;
    this.selectedFormId = item.id;

    // Load header first
    this.formData = {
      courseName: item.courseName || '',
      targetGroup: item.targetGroup || 'student',
      formType: item.formType || '',
      formName: item.formName || '',
      formDescription: item.formDescription || '',
      generationId: item.generationId || '',
      subjectId: item.subjectId || '',
      questions: [], // Will populate from API
    };

    this.onCourseChange(false);
    this.onGenerationChange(false);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch real questions

    this.generalEvaluationService.getFormById(item.id).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.questions) {
          const qs = res.data.questions;
          qs.forEach((q: any) => {
            if (q.question_type === 'choice' && q.choices) {
              q.choices.forEach((c: any) => {
                if (!c.choice_text || c.choice_text.trim() === '') {
                  if (c.score_value == 5) c.choice_text = 'มาก';
                  else if (c.score_value == 3) c.choice_text = 'ปานกลาง';
                  else if (c.score_value == 1) c.choice_text = 'น้อย';
                }
              });
            } else if (q.question_type === 'dropdown') {
              if (!q.choices || q.choices.length === 0) {
                q.choices = [
                  { choice_text: '', score_value: 0 },
                  { choice_text: '', score_value: 0 },
                ];
              }
            }
          });
          this.formData.questions = qs;
          if (this.formData.questions.length === 0) {
            this.addQuestion(); // fallback if DB has empty questions
          }
        } else {
          this.addQuestion(); // fallback
        }
        this.cdr.detectChanges();
      },

      error: (err) => {
        console.error('Error fetching questions:', err);
        Swal.fire({
          icon: 'error',
          title: 'โหลดข้อมูลล้มเหลว',
          text: 'เกิดข้อผิดพลาดในการดึงชุดคำถามเดิม',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#f44336',
        });
        this.addQuestion();
      },
    });
  }

  onUpdateForm() {
    console.log('=== เริ่มทำงาน onUpdateForm ===');
  console.log('selectedFormId:', this.selectedFormId);
  console.log('questions:', this.formData?.questions);

    if (!this.selectedFormId) {
    console.warn('❌ ติดเงื่อนไข: selectedFormId เป็น null หรือ undefined');
    Swal.fire({
      icon: 'error',
      title: 'ไม่พบรหัสฟอร์ม',
      text: 'กรุณาเลือกแบบฟอร์มที่ต้องการแก้ไขใหม่อีกครั้ง',
    });
    return;
  }

  if (!this.formData.questions || this.formData.questions.length === 0) {
    console.warn('❌ ติดเงื่อนไข: ไม่มีคำถาม');
    Swal.fire({
      icon: 'warning',
      title: 'ไม่มีคำถาม',
      text: 'กรุณาสร้างคำถามอย่างน้อย 1 ข้อ',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#673ab7',
    });
    return;
    }

    const cleanSubjectId =
      this.formData.subjectId === 'undefined' || !this.formData.subjectId
        ? null
        : this.formData.subjectId;

    const payload = {
      courseName: this.formData.courseName,
      targetGroup: this.formData.targetGroup || 'student',
      formType: this.formData.formType,
      formName: this.formData.formName,
      formDescription: this.formData.formDescription || '',
      generationId: this.formData.generationId || null,
      subjectId: cleanSubjectId,
      questions: this.formData.questions,
    };

    this.generalEvaluationService.updateGeneralEvaluation(this.selectedFormId, payload).subscribe({
      next: (res) => {
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'อัปเดตสำเร็จ!',
            text: 'บันทึกการแก้ไขข้อมูลแบบฟอร์มเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false,
          }).then(() => {
            // 🟢 ย้ายมาทำตรงนี้: รอให้ SweetAlert ปิดตัวสนิทก่อนค่อยเปลี่ยนหน้า
            this.resetForm();
            this.fetchAllForms();
            
            // เลื่อนหน้าจอกลับขึ้นไปด้านบนหน้ารายการ (ถ้าจำเป็น)
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });

          this.resetForm();
          this.fetchAllForms();
          this.cdr.detectChanges();

        } else {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: res.message || 'ไม่สามารถอัปเดตฟอร์มได้',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#f44336',
          });
        }
      },
      error: (err) => {
        console.error('Error updating form:', err);
        Swal.fire({
          icon: 'error',
          title: 'ไม่สามารถบันทึกได้',
          text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์',
          confirmButtonText: 'รับทราบ',
          confirmButtonColor: '#f44336',
        });
      },
    });
  }

  onDeleteAction(id: any) {
    Swal.fire({
      title: 'ยืนยันการลบฟอร์ม?',
      text: 'คุณแน่ใจหรือไม่ว่าต้องการลบแบบฟอร์มนี้? (หากมีนักเรียนตอบแล้วจะไม่สามารถลบได้)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#f44336',
      cancelButtonColor: '#9e9e9e',
    }).then((result) => {
      if (result.isConfirmed) {
        this.generalEvaluationService.deleteGeneralEvaluation(id).subscribe({
          next: (res) => {
            if (res.success) {
            
            // 🟢 1. ตัดรายการที่ลบออกจาก formList ทันที
            this.formList = this.formList.filter((item: any) => item.id !== id);
            
            // 🟢 2. บังคับให้ป้อนข้อมูลลงตารางใหม่
            this.generateTableData();

            // 🟢 3. ถ้าฟอร์มที่ลบอยู่ คือตัวที่กำลังเปิดแก้ไข ให้รีเซ็ตฟอร์มด้วย
            if (this.selectedFormId === id) {
              this.resetForm();
            }

            // 🟢 4. บังคับ Angular อัปเดตหน้าจอทันที
            if (this.cdr) {
              this.cdr.detectChanges();
            }

            Swal.fire({
              icon: 'success',
              title: 'ลบสำเร็จ!',
              text: 'ลบแบบฟอร์มออกจากระบบเรียบร้อยแล้ว',
              timer: 1500,
              showConfirmButton: false,
            });

            // 🟢 5. ดึงข้อมูลจริงจาก Backend มาอัปเดตซ้ำอีกทีเพื่อความชัวร์
            this.fetchAllForms();

          } else {
            Swal.fire({
              icon: 'error',
              title: 'ไม่สามารถลบได้',
              text: res.message || 'เกิดข้อผิดพลาดในการลบแบบฟอร์ม',
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#f44336',
            });
          }
        },
        error: (err) => {
          console.error('Error delete:', err);
          Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถลบได้',
            text: err.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์',
            confirmButtonText: 'รับทราบ',
            confirmButtonColor: '#f44336',
          });
        },
      });
    }
  });
}

  resetForm() {
    this.isEditMode = false;
    this.selectedFormId = null;
    this.formData = {
      courseName: '',
      targetGroup: '',
      formType: '',
      formName: '',
      formDescription: '',
      generationId: '',
      subjectId: '',
      questions: [],
    };
    this.addQuestion(); // สร้างข้อว่างเตรียมไว้ให้
    this.availableBatches = [];
    this.availableSubjects = [];

    if (this.cdr) {
    this.cdr.detectChanges();
    }
  }

  // ==========================================
  // ส่วนแสดงตารางและตัวกรอง
  // ==========================================

  filterCourse: string = '';
  filterGeneration: string = '';
  filterType: string = '';

  filterBatches: BatchItem[] = [];
  displayTableData: any[] = [];

  onFilterCourseChange() {
    const selectedGroup = this.courseGroups.find((c) => c.course_name === this.filterCourse);
    if (selectedGroup) {
      this.filterBatches = selectedGroup.batches;
    } else {
      this.filterBatches = [];
    }
    this.filterGeneration = '';
    this.displayTableData = [];
  }

  onFilterGenerationChange() {
    this.displayTableData = [];
    if (this.filterGeneration) {
      this.generateTableData();
    }
  }

  onFilterTypeChange() {
    this.generateTableData();
  }

  generateTableData() {
    if (!this.filterCourse || !this.filterGeneration) {
      this.displayTableData = [];
      return;
    }

    this.displayTableData = [];

    // Determine which types to show
    let typesToShow: { value: string; label: string }[] = [];
    if (this.filterType) {
      const foundType = this.allFormTypesFlat.find(t => t.value === this.filterType);
      if (foundType) {
        typesToShow = [foundType];
      }
    } else {
      typesToShow = this.allFormTypesFlat;
    }

    // Build rows for each type
    for (const t of typesToShow) {
      const matchedForms = this.formList.filter(
        (f) => f.generationId == this.filterGeneration && f.formType === t.value
      );
      
      const form = matchedForms.length > 0 ? matchedForms[0] : null;
      
      this.displayTableData.push({
        isSubjectMode: false,
        subjectId: null,
        subjectName: t.label, // use the label of the type as the row title
        hasForm: !!form,
        formDetails: form || null,
        formType: t.value // keep track of the type for the "Add" button
      });
    }
  }

  onAddLinkAction(row: any) {
    this.formData.courseName = this.filterCourse;
    this.onCourseChange(false);

    this.formData.generationId = this.filterGeneration;
    this.onGenerationChange(false);

    // หา Target Group ของฟอร์มประเภทนี้ เพื่อให้ Dropdown ทำงานได้ถูกต้อง
    const targetType = this.allFormTypesFlat.find(t => t.value === row.formType);
    if (targetType) {
      for (const group of this.targetGroups) {
        const typesInGroup = this.formTypesMap[group.value] || [];
        if (typesInGroup.find(t => t.value === row.formType)) {
          this.formData.targetGroup = group.value;
          break;
        }
      }
      if (!this.formData.targetGroup) {
         const customType = this.customFormTypes.find(t => t.value === row.formType);
         if (customType) {
           this.formData.targetGroup = customType.targetGroup;
         }
      }
    }

    this.formData.formType = row.formType;
    this.formData.subjectId = '';

    this.formData.formName = '';
    this.isEditMode = false;
    this.selectedFormId = null;
    this.formData.questions = [];
    this.addQuestion(); // สร้างข้อแรกเตรียมไว้

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // ส่วน Preview แบบประเมินสำหรับแอดมิน
  // ==========================================
  showPreviewModal: boolean = false;
  previewData: any = {
    formName: '',
    formDescription: '',
    courseName: '',
    generationName: '',
    formType: '',
    questions: [] as Question[],
    subjects: [] as any[],
  };
  previewSelectedSubjectId: string = '';
  previewInstructorName: string = '';

  // เปิด Preview สำหรับฟอร์มที่กำลังสร้าง/แก้ไขอยู่ในปัจจุบัน
  openCurrentPreview(): void {
    if (!this.formData.questions || this.formData.questions.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'ยังไม่มีคำถาม',
        text: 'กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อเพื่อดูตัวอย่าง',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    let genName = 'รุ่นที่เลือก';
    const foundBatch = this.availableBatches.find(b => String(b.batch_id) === String(this.formData.generationId));
    if (foundBatch) genName = foundBatch.batch_name;

    this.previewData = {
      formName: this.formData.formName || 'แบบประเมินตัวอย่าง',
      formDescription: this.formData.formDescription || '',
      courseName: this.formData.courseName || 'หลักสูตรตัวอย่าง',
      generationName: genName,
      formType: this.formData.formType || 'instructor',
      questions: JSON.parse(JSON.stringify(this.formData.questions)),
      subjects: [...this.availableSubjects],
    };
    this.previewSelectedSubjectId = '';
    this.previewInstructorName = '';
    this.showPreviewModal = true;
    this.cdr.detectChanges();
  }

  // เปิด Preview สำหรับฟอร์มที่มีอยู่ในตาราง
  onPreviewFormAction(formDetails: any): void {
    if (!formDetails || !formDetails.id) return;

    this.generalEvaluationService.getFormById(formDetails.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const form = res.data;
          
          let subjects: any[] = [];
          if (form.batch_id) {
            this.courseService.getSubjectsByBatch(form.batch_id).subscribe({
              next: (subRes: any) => {
                if (subRes.success && subRes.data) {
                  let allSubjects: any[] = [];
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
                  subjects = allSubjects.filter((s, idx, self) => idx === self.findIndex(t => t.id === s.id));
                  this.previewData.subjects = subjects;
                  this.cdr.detectChanges();
                }
              }
            });
          }

          this.previewData = {
            formName: form.form_name || formDetails.formName || 'แบบประเมิน',
            formDescription: form.form_description || '',
            courseName: formDetails.courseName || 'หลักสูตร',
            generationName: formDetails.generationName || 'รุ่น',
            formType: form.evaluation_type || formDetails.formType,
            questions: form.questions || [],
            subjects: subjects,
          };
          this.previewSelectedSubjectId = '';
          this.previewInstructorName = '';
          this.showPreviewModal = true;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error fetching preview form:', err);
        Swal.fire({
          icon: 'error',
          title: 'ผิดพลาด',
          text: 'ไม่สามารถโหลดตัวอย่างแบบประเมินได้',
        });
      }
    });
  }

  closePreviewModal(): void {
    this.showPreviewModal = false;
    this.cdr.detectChanges();
  }

  get previewDisplayedQuestions(): any[] {
    if (!this.previewData || !this.previewData.questions) return [];
    return this.previewData.questions.filter((q: any) => {
      if (!q.subject_for || q.subject_for === '' || q.subject_for === 'all') {
        return true;
      }
      if (this.previewSelectedSubjectId) {
        return String(q.subject_for) === String(this.previewSelectedSubjectId);
      }
      return false;
    });
  }
}
