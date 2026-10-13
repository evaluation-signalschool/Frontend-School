import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GeneralEvaluationService } from '../../services/general-evaluation.service';
import { CourseService } from '../../services/course.service';
import Swal from 'sweetalert2';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-form-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, RouterLink],
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
    { value: 'teacher_course', label: 'แบบประเมินผู้เรียนในรายวิชา (โดยอาจารย์ผู้สอน)' },
    { value: 'director', label: 'แบบประเมินอาจารย์กำกับหลักสูตร' },
    { value: 'course', label: 'แบบประเมินหลักสูตร' },
    { value: 'committee', label: 'แบบประเมินสำหรับคณะกำกับหลักสูตร' },
    { value: 'followup_commander', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับ ผบช.)' },
    { value: 'followup_self', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (ผู้ฝึกอบรมประเมินตนเอง)' },
    { value: 'followup_colleague', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับเพื่อนร่วมงาน)' },
  ];

  formGroups = [
    {
      label: '👨‍🎓 ส่วนของนักเรียน (ผู้เรียนประเมิน)',
      types: [
        { value: 'instructor', label: 'ประเมินอาจารย์ผู้สอน' },
        { value: 'director', label: 'แบบประเมินอาจารย์กำกับหลักสูตร' },
        { value: 'course', label: 'แบบประเมินหลักสูตร' },
      ]
    },
    {
      label: '👨‍🏫 ส่วนของครู-อาจารย์ (อาจารย์ประเมินผู้เรียน)',
      types: [
        { value: 'teacher_course', label: 'แบบประเมินผู้เรียนในรายวิชา (โดยอาจารย์ผู้สอน)' },
      ]
    },
    {
      label: '👔 ส่วนคณะกำกับหลักสูตร',
      types: [
        { value: 'committee', label: 'แบบประเมินสำหรับคณะกำกับหลักสูตร' },
      ]
    },
    {
      label: '📋 ส่วนติดตามผู้สำเร็จการศึกษา (ประเมินหลังจบ)',
      types: [
        { value: 'followup_commander', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับ ผบช.)' },
        { value: 'followup_self', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (ผู้ฝึกอบรมประเมินตนเอง)' },
        { value: 'followup_colleague', label: 'แบบประเมินผู้สำเร็จการฝึกอบรม (สำหรับเพื่อนร่วมงาน)' },
      ]
    }
  ];
  availableSubjects: any[] = [];
  groupedSubjects: {
    group_name: string;
    display_label: string;
    subjects: any[];
  }[] = [];

  private readonly CANONICAL_SUBJECT_ORDER: Record<string, number> = {
    // M01
    'การส่งกำลังและซ่อมบำรุงสายสื่อสาร': 1,
    'การจัดหน่วยทหารสื่อสาร': 2,
    'การจัดหน่วยทหารสื่อสารและหน่วยสื่อสาร': 2,
    'ฝ่ายอำนวยการ': 2,
    // M02
    'วงจรไฟฟ้า': 3,
    'ระเบียบการนำหน่วย': 3,
    // M03
    'การสื่อสารทางยุทธวิธี': 4,
    'หลักนิยมการสื่อสารทางยุทธวิธี': 4,
    // M04
    'การสื่อสารประเภทวิทยุและการสงครามอิเล็กทรอนิกส์': 5,
    'การสื่อสารประเภทวิทยุ': 5,
    // M05
    'การสื่อสารประเภทสาย': 6,
    // M06
    'ภาษาอังกฤษทางทหาร': 7,
    'การอำนวยการทางการสื่อสาร': 8,
    // M07
    'การพัฒนาทักษะดิจิทัลที่จำเป็นระดับต้น': 9,
    'สงครามอิเล็กทรอนิกส์': 9,
    // MN01 / MN08
    'การรักษาความปลอดภัย': 10,
    'การป้องกันและปราบปรามการก่อความไม่สงบ': 11,
    'ระเบียบงานสารบรรณ': 12,
    // MN02 / MN09
    'แผนที่เข็มทิศ': 13,
    // S01 / S10
    'ผู้นำหน่วย': 14,
    'วิชาตามนโยบายที่กองทัพบกกำหนด': 15,
    // P01 / P11
    'ฝึกทบทวนการใช้เครื่องมือสื่อสาร': 16,
  };

  getGroupPrefixOrder(name: string): number {
    const upper = (name || '').trim().toUpperCase();
    if (upper.startsWith('M') && !upper.startsWith('MN')) return 1;
    if (upper.startsWith('MN')) return 2;
    if (upper.startsWith('S')) return 3;
    if (upper.startsWith('P')) return 4;
    return 5;
  }

  compareGroupNames(aName: string, bName: string): number {
    const a = (aName || '').trim();
    const b = (bName || '').trim();
    const orderA = this.getGroupPrefixOrder(a);
    const orderB = this.getGroupPrefixOrder(b);
    if (orderA !== orderB) return orderA - orderB;

    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    if (matchA && matchB) {
      const numA = parseInt(matchA[0], 10);
      const numB = parseInt(matchB[0], 10);
      if (numA !== numB) return numA - numB;
    }
    return a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' });
  }

  compareSubjects(a: any, b: any): number {
    const groupA = a.group_name || '';
    const groupB = b.group_name || '';
    const gComp = this.compareGroupNames(groupA, groupB);
    if (gComp !== 0) return gComp;

    const nameA = (a.subject_name || '').trim();
    const nameB = (b.subject_name || '').trim();
    const canonA = this.CANONICAL_SUBJECT_ORDER[nameA] ?? 999;
    const canonB = this.CANONICAL_SUBJECT_ORDER[nameB] ?? 999;
    if (canonA !== canonB) return canonA - canonB;

    if (a.subject_id && b.subject_id && a.subject_id !== b.subject_id) {
      return Number(a.subject_id) - Number(b.subject_id);
    }
    return nameA.localeCompare(nameB, 'th', { numeric: true, sensitivity: 'base' });
  }

  getGroupDisplayLabel(groupName: string): string {
    if (!groupName || groupName === 'ทั่วไป') return 'รายวิชาทั่วไป';
    const nameUpper = groupName.trim().toUpperCase();
    let type = '';
    if (nameUpper.startsWith('MN')) type = 'วิชารอง';
    else if (nameUpper.startsWith('M')) type = 'วิชาหลัก';
    else if (nameUpper.startsWith('S')) type = 'วิชาประกอบ';
    else if (nameUpper.startsWith('P')) type = 'ภาคปฏิบัติ';

    const hasGroupWord = groupName.includes('กลุ่ม') || groupName.includes('หมวด');
    const prefix = hasGroupWord ? '' : 'กลุ่มวิชา ';
    const typeText = type ? ` (${type})` : '';
    return `${prefix}${groupName}${typeText}`;
  }

  getInstructorList(instructorName: string): string[] {
    if (!instructorName) return [];
    return instructorName
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  isScoreRating(value: any): boolean {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    return /^[1-5]$/.test(str);
  }

  selectedCourse: string = '';
  selectedBatch: string | number = '';
  selectedFormType: string = '';
  selectedSubject: string | number = '';
  selectedFormId: string | number = '';

  questions: any[] = [];
  submissions: any[] = [];
  isLoading = false;

  isFullscreen = false;
  @ViewChild('resultsCard') resultsCard?: ElementRef<HTMLDivElement>;
  @ViewChild('tableWrapper') tableWrapper?: ElementRef<HTMLDivElement>;

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = Boolean(document.fullscreenElement);
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isFullscreen) {
      this.toggleFullscreen();
    }
  }

  toggleFullscreen(): void {
    const el = this.resultsCard?.nativeElement || (document.querySelector('.results-card') as HTMLElement);
    if (!this.isFullscreen) {
      if (el && el.requestFullscreen) {
        el.requestFullscreen()
          .then(() => {
            this.isFullscreen = true;
            this.cdr.detectChanges();
          })
          .catch(() => {
            this.isFullscreen = !this.isFullscreen;
            this.cdr.detectChanges();
          });
      } else {
        this.isFullscreen = !this.isFullscreen;
        this.cdr.detectChanges();
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            this.isFullscreen = false;
            this.cdr.detectChanges();
          })
          .catch(() => {
            this.isFullscreen = false;
            this.cdr.detectChanges();
          });
      } else {
        this.isFullscreen = false;
        this.cdr.detectChanges();
      }
    }
  }

  scrollTable(direction: 'left' | 'right'): void {
    if (this.tableWrapper?.nativeElement) {
      const el = this.tableWrapper.nativeElement;
      const amount = direction === 'left' ? -380 : 380;
      el.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }

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
    this.groupedSubjects = [];
    
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
    this.groupedSubjects = [];
    this.filterForms();
  }

  onFormTypeChange(): void {
    this.selectedSubject = '';
    this.selectedFormId = '';
    this.availableSubjects = [];
    this.groupedSubjects = [];
    
    if (this.selectedFormType === 'instructor' && this.selectedBatch) {
      this.courseService.getSubjectsByBatch(this.selectedBatch).subscribe({
        next: (res: any) => {
          if (res?.success && res.data && res.data.length > 0) {
            const groups: { group_name: string; display_label: string; subjects: any[] }[] = [];
            let allSubjects: any[] = [];

            res.data.forEach((group: any) => {
              const gName = (group.group_name || 'ทั่วไป').trim();
              const subs = (group.subjects || []).map((s: any) => ({
                ...s,
                group_name: gName,
              }));

              if (subs.length > 0) {
                const uniqueSubs = subs.filter(
                  (sub: any, idx: number, arr: any[]) =>
                    idx === arr.findIndex((t: any) => t.subject_id === sub.subject_id)
                );
                uniqueSubs.sort((a: any, b: any) => this.compareSubjects(a, b));

                groups.push({
                  group_name: gName,
                  display_label: this.getGroupDisplayLabel(gName),
                  subjects: uniqueSubs,
                });

                allSubjects = allSubjects.concat(uniqueSubs);
              }
            });

            // เรียงลำดับกลุ่มวิชาตาม M -> MN -> S -> P
            groups.sort((a, b) => this.compareGroupNames(a.group_name, b.group_name));

            // กรองวิชาซ้ำทั้งหมดและจัดเรียงตามลำดับโครงสร้างหลักสูตร
            const uniqueAll = allSubjects.filter(
              (subject, index, self) =>
                index === self.findIndex((t) => t.subject_id === subject.subject_id)
            );
            uniqueAll.sort((a, b) => this.compareSubjects(a, b));

            this.groupedSubjects = groups;
            this.availableSubjects = uniqueAll;
          } else {
            this.groupedSubjects = [];
            this.availableSubjects = [];
          }
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error loading subjects:', err);
          this.groupedSubjects = [];
          this.availableSubjects = [];
          this.cdr.detectChanges();
        }
      });
    } else {
      this.groupedSubjects = [];
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
        // ประเมินอาจารย์: ถ้าเลือกรายวิชาแล้ว ให้ดึงประเมินล่าสุดมาใช้และค้นหาเลย
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

  async onExport(): Promise<void> {
    if (!this.submissions || this.submissions.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูล',
        text: 'ไม่มีข้อมูลแบบประเมินสำหรับส่งออกไฟล์ Excel',
        confirmButtonColor: '#6b21a8',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ระบบประเมินผลการศึกษา';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('ข้อมูลแบบประเมิน');

      const courseName = this.selectedCourse || '-';
      const foundBatch = this.batches.find((b) => String(b.batch_id) === String(this.selectedBatch));
      const batchName = foundBatch
        ? foundBatch.batch_name
        : this.selectedBatch
          ? `รุ่นที่ ${this.selectedBatch}`
          : '-';

      let formTypeLabel = '';
      for (const g of this.formGroups) {
        const t = g.types.find((item) => item.value === this.selectedFormType);
        if (t) {
          formTypeLabel = t.label;
          break;
        }
      }
      if (!formTypeLabel) {
        const t = this.formTypes.find((item) => item.value === this.selectedFormType);
        formTypeLabel = t ? t.label : (this.selectedFormType || 'แบบประเมิน');
      }

      let subjectName = '';
      if (this.selectedSubject) {
        const foundSub = this.availableSubjects.find(
          (s) => String(s.subject_id) === String(this.selectedSubject),
        );
        subjectName = foundSub ? foundSub.subject_name : '';
      }

      const totalCols = 5 + (this.questions ? this.questions.length : 0);
      const lastColLetter = this.getColumnLetter(totalCols);

      // 1. หัวเรื่องหลัก (Title)
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `รายงานการตอบแบบประเมิน: ${formTypeLabel}`;
      titleCell.font = { name: 'Sarabun', size: 15, bold: true, color: { argb: 'FF4A0E4E' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E8FF' }, // ม่วงพาสเทล
      };
      worksheet.getRow(1).height = 36;

      // 2. ข้อมูลหลักสูตรและรุ่น (Subtitle 1)
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const subCell1 = worksheet.getCell('A2');
      subCell1.value = `หลักสูตร: ${courseName} | รุ่น: ${batchName}${subjectName ? ' | รายวิชา: ' + subjectName : ''}`;
      subCell1.font = { name: 'Sarabun', size: 11, bold: true };
      subCell1.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 24;

      // 3. ข้อมูลวันที่พิมพ์และจำนวนข้อมูล (Subtitle 2)
      worksheet.mergeCells(`A3:${lastColLetter}3`);
      const subCell2 = worksheet.getCell('A3');
      const nowStr = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      subCell2.value = `ส่งออกข้อมูลเมื่อ: ${nowStr} | จำนวนผู้ตอบทั้งหมด: ${this.submissions.length} รายการ`;
      subCell2.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF6B7280' } };
      subCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(3).height = 20;

      worksheet.addRow([]); // Blank row (แถว 4)
      worksheet.getRow(4).height = 12;

      // 4. ส่วนหัวตาราง (Table Header - แถว 5)
      const headers = ['ลำดับ', 'ประทับเวลา', 'รหัสนักเรียน', 'ผู้ตอบแบบประเมิน', 'ครู-อาจารย์ผู้สอน'];
      this.questions.forEach((q) => {
        headers.push(`${q.order_num}. ${q.question_text}`);
      });

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 34;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF7C3AED' }, // สีม่วงเข้มสวยงาม
        };
        cell.alignment = {
          horizontal: colNumber <= 3 ? 'center' : 'left',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'medium', color: { argb: 'FF5B21B6' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });

      // 5. ข้อมูลในแต่ละแถว (Data Rows)
      this.submissions.forEach((sub, idx) => {
        let formattedDate = '-';
        if (sub.submittedAt) {
          const d = new Date(sub.submittedAt);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear() + 543;
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;
          } else {
            formattedDate = String(sub.submittedAt);
          }
        }

        const rowValues: any[] = [
          idx + 1,
          formattedDate,
          sub.studentCode || '-',
          sub.name || '-',
          sub.instructorName || '-',
        ];

        this.questions.forEach((q) => {
          const ans = sub.answers ? sub.answers['q_' + q.id] : '';
          rowValues.push(ans !== undefined && ans !== null && ans !== '' ? ans : '-');
        });

        const row = worksheet.addRow(rowValues);
        row.height = 24;

        const isEven = idx % 2 === 1;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Sarabun', size: 10 };
          if (isEven) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9FAFB' },
            };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };

          if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        });
      });

      // 6. กำหนดความกว้างคอลัมน์ (Column Widths)
      worksheet.getColumn(1).width = 8;  // ลำดับ
      worksheet.getColumn(2).width = 20; // ประทับเวลา
      worksheet.getColumn(3).width = 16; // รหัสนักเรียน
      worksheet.getColumn(4).width = 25; // ผู้ตอบแบบประเมิน
      worksheet.getColumn(5).width = 25; // ครู-อาจารย์ผู้สอน

      for (let c = 6; c <= totalCols; c++) {
        worksheet.getColumn(c).width = 35; // แต่ละข้อคำถาม
      }

      // 7. ดาวน์โหลดไฟล์
      const safeCourse = (courseName || 'หลักสูตร').replace(/[\\/:*?"<>|]/g, '_');
      const safeBatch = (batchName || 'รุ่น').replace(/[\\/:*?"<>|]/g, '_');
      const safeType = (formTypeLabel || 'แบบประเมิน').replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `รายงานผลการประเมิน_${safeCourse}_${safeBatch}_${safeType}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, fileName);

      Swal.fire({
        icon: 'success',
        title: 'ส่งออกข้อมูลสำเร็จ',
        text: `ดาวน์โหลดไฟล์ ${fileName} เรียบร้อยแล้ว`,
        confirmButtonColor: '#7c3aed',
        confirmButtonText: 'ตกลง',
        timer: 2500,
      });
    } catch (err) {
      console.error('Error exporting Excel:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่งออกข้อมูลเป็นไฟล์ Excel ได้',
        confirmButtonColor: '#ef4444',
      });
    }
  }

  private getColumnLetter(colIndex: number): string {
    let temp = '';
    let letter = '';
    while (colIndex > 0) {
      temp = String.fromCharCode(((colIndex - 1) % 26) + 65);
      letter = temp + letter;
      colIndex = Math.floor((colIndex - 1) / 26);
    }
    return letter || 'A';
  }

  goBack(): void {
    this.location.back();
  }

  getSelectedBatchName(): string {
    if (!this.selectedBatch) return '';
    const found = this.batches.find((b) => String(b.batch_id) === String(this.selectedBatch));
    return found ? found.batch_name : `รุ่นที่ ${this.selectedBatch}`;
  }

  getSelectedFormTypeLabel(): string {
    if (!this.selectedFormType) return '';
    const found = this.formTypes.find((t) => t.value === this.selectedFormType);
    return found ? found.label : this.selectedFormType;
  }

  getSelectedSubjectName(): string {
    if (!this.selectedSubject) return '';
    const found = this.availableSubjects.find((s) => String(s.subject_id) === String(this.selectedSubject));
    return found ? found.subject_name : '';
  }

  isFilterComplete(): boolean {
    if (!this.selectedCourse || !this.selectedBatch || !this.selectedFormType) {
      return false;
    }
    if (this.selectedFormType === 'instructor' && !this.selectedSubject) {
      return false;
    }
    return true;
  }
}
