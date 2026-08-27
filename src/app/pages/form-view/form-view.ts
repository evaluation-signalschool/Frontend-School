import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';
import { CourseService } from '../../services/course.service';

@Component({
  selector: 'app-form-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './form-view.html',
  styleUrl: './form-view.scss',
})
export class FormView implements OnInit {
  courseGroups: any[] = [];
  batches: any[] = [];
  allForms: any[] = [];
  filteredForms: any[] = [];

  formTypes = [
    { value: 'instructor', label: 'ประเมินอาจารย์ผู้สอน' },
    { value: 'director', label: 'แบบประเมินอาจารย์กำกับหลักสูตร' },
    { value: 'course', label: 'แบบประเมินหลักสูตร' },
    { value: 'committee', label: 'แบบประเมินสำหรับคณะกำกับหลักสูตร' },
    { value: 'followup_commander', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับ ผบช.)' },
    { value: 'followup_self', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (ผู้ฝึกอบรมประเมินตนเอง)' },
    { value: 'followup_colleague', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับเพื่อนร่วมงาน)' },
  ];
  availableSubjects: any[] = [];

  selectedCourse: string = '';
  selectedBatch: string | number = '';
  selectedFormType: string = '';
  selectedSubject: string | number = '';
  selectedFormId: string | number = '';

  questions: any[] = [];
  submissions: any[] = [];
  isLoading = false;

  constructor(
    private evalService: GeneralEvaluationService,
    private courseService: CourseService,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadCourses();
    this.loadForms();
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.courseGroups = res.data;
        }
      },
      error: (err: any) => console.error('Error loading courses:', err)
    });
  }

  loadForms(): void {
    this.evalService.getAllForms().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.allForms = res.data;
          this.filterForms();
        }
      },
      error: (err: any) => console.error('Error loading forms:', err)
    });
  }

  onCourseChange(): void {
    this.selectedBatch = '';
    this.selectedFormType = '';
    this.selectedSubject = '';
    this.selectedFormId = '';
    this.batches = [];
    this.availableSubjects = [];
    
    if (this.selectedCourse) {
      const selectedGroup = this.courseGroups.find(
        (g) => g.course_name === this.selectedCourse
      );
      if (selectedGroup && selectedGroup.batches) {
        this.batches = selectedGroup.batches;
      }
    }
    this.filterForms();
  }

  onBatchChange(): void {
    this.selectedFormType = '';
    this.selectedSubject = '';
    this.selectedFormId = '';
    this.availableSubjects = [];
    this.filterForms();
  }

  onFormTypeChange(): void {
    this.selectedSubject = '';
    this.selectedFormId = '';
    
    if (this.selectedFormType === 'instructor' && this.selectedBatch) {
      this.courseService.getSubjectsByBatch(this.selectedBatch).subscribe({
        next: (res: any) => {
          if (res.success && res.data.length > 0) {
            let allSubjects: any[] = [];
            res.data.forEach((group: any) => {
              if (group.subjects && group.subjects.length > 0) {
                allSubjects = allSubjects.concat(group.subjects);
              }
            });
            // กรองวิชาที่ซ้ำกันออกที่ฝั่งหน้าเว็บ (Frontend) เพื่อแก้ปัญหาวิชาซ้ำ
            this.availableSubjects = allSubjects.filter(
              (subject, index, self) =>
                index === self.findIndex((t) => t.subject_id === subject.subject_id)
            );
          } else {
            this.availableSubjects = [];
          }
        },
        error: (err: any) => {
          console.error('Error loading subjects:', err);
          this.availableSubjects = [];
        }
      });
    } else {
      this.availableSubjects = [];
    }
    this.filterForms();
  }

  onSubjectChange(): void {
    this.selectedFormId = '';
    this.filterForms();
  }

  filterForms(): void {
    this.filteredForms = this.allForms;

    if (this.selectedBatch) {
      this.filteredForms = this.filteredForms.filter(f => f.batch_id == this.selectedBatch);
    }
    
    if (this.selectedFormType) {
      this.filteredForms = this.filteredForms.filter(f => f.evaluation_type === this.selectedFormType);
    }

    if (this.selectedFormType === 'instructor') {
      if (this.selectedSubject && this.filteredForms.length > 0) {
        // ประเมินอาจารย์: ถ้าเลือกรายวิชาแล้ว ให้ดึงฟอร์มล่าสุดมาใช้และค้นหาเลย
        const form = this.filteredForms[0];
        this.selectedFormId = form.id;
        this.onSearch();
      } else {
        // ถ้ายกเลิกการเลือกรายวิชา ให้เคลียร์ข้อมูล
        this.selectedFormId = '';
        this.submissions = [];
        this.questions = [];
      }
    } else {
      // แบบประเมินประเภทอื่น
      if (this.selectedFormType && this.filteredForms.length > 0) {
        const form = this.filteredForms[0];
        this.selectedFormId = form.id;
        if (form.subject_id) {
          this.selectedSubject = form.subject_id;
        }
        this.onSearch();
      } else {
        this.selectedFormId = '';
        this.submissions = [];
        this.questions = [];
      }
    }
  }

  onSearch(): void {
    if (!this.selectedFormId) return;
    this.isLoading = true;
    this.cdr.detectChanges(); // บังคับให้ UI โชว์คำว่ากำลังโหลดทันที

    this.evalService.getFormSubmissions(this.selectedFormId, this.selectedSubject).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.questions = res.data.questions;
          this.submissions = res.data.submissions;
        }
        this.isLoading = false;
        this.cdr.detectChanges(); // บังคับให้ Angular วาดตารางข้อมูลทันที!
      },
      error: (err: any) => {
        console.error('Error fetching submissions:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onExport(): void {
    if (this.submissions.length === 0) return;
    console.log('Exporting data...', this.submissions);
    alert('ระบบกำลังพัฒนาส่วน Export');
  }

  goBack(): void {
    this.location.back();
  }
}
