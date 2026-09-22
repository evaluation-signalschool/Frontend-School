import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-news-management',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule, FormsModule],
  templateUrl: './news-management.html',
  styleUrl: './news-management.scss'
})
export class NewsManagement implements OnInit {
  newsList: any[] = [];
  isLoading = true;
  
  formData: any = {
    title: '',
    type: 'announce',
    news_date: '',
    description: ''
  };
  selectedFile: File | null = null;
  isSubmitting = false;
  editMode = false;
  editId: number | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.fetchNews();
  }

  fetchNews() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.http.get<any>(`${environment.apiUrl}/news`).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.newsList = res.data;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        console.error(err);
      }
    });
  }

  getTypeLabel(type: string): string {
    switch(type) {
      case 'announce': return '📣 ประกาศ';
      case 'news': return '📰 ข่าวสาร';
      case 'activity': return '🎓 กิจกรรม';
      default: return '📣 ประกาศ';
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onSubmit() {
    try {
      this.isSubmitting = true;
      const formData = new FormData();
      formData.append('title', this.formData.title || '');
      formData.append('type', this.formData.type || 'announce');
      formData.append('description', this.formData.description || '');
      
      if (this.formData.news_date) {
        formData.append('news_date', this.formData.news_date);
      }
      if (this.selectedFile) {
        formData.append('file', this.selectedFile);
      }

      if (this.editMode && this.editId) {
        this.http.put<any>(`${environment.apiUrl}/news/${this.editId}`, formData).subscribe({
          next: (res) => {
            this.isSubmitting = false;
            if (res.success) {
              Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แก้ไขข่าวสารเรียบร้อยแล้ว', confirmButtonText: 'ตกลง', confirmButtonColor: '#28a745' }).then(() => {
                window.location.reload();
              });
            } else {
              Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: res.message || 'ไม่สามารถบันทึกข้อมูลได้', confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
            }
          },
          error: (err) => {
            this.isSubmitting = false;
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: (err.error && err.error.message) ? err.error.message : 'ไม่สามารถบันทึกข้อมูลได้ (อาจจะยังไม่ได้อัปเดต Backend บน Render)', confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
          }
        });
      } else {
        this.http.post<any>(`${environment.apiUrl}/news`, formData).subscribe({
          next: (res) => {
            this.isSubmitting = false;
            if (res.success) {
              Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'เพิ่มข่าวสารเรียบร้อยแล้ว', confirmButtonText: 'ตกลง', confirmButtonColor: '#28a745' }).then(() => {
                window.location.reload();
              });
            } else {
              Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: res.message || 'ไม่สามารถบันทึกข้อมูลได้', confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
            }
          },
          error: (err) => {
            this.isSubmitting = false;
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: (err.error && err.error.message) ? err.error.message : 'ไม่สามารถบันทึกข้อมูลได้', confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
          }
        });
      }
    } catch (e) {
      this.isSubmitting = false;
      console.error(e);
      Swal.fire({ icon: 'error', title: 'System Error', text: 'เกิดข้อผิดพลาดในระบบ', confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
    }
  }

  deleteNews(id: number) {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณต้องการลบข่าวสารนี้ใช่หรือไม่? (ไม่สามารถกู้คืนได้)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete<any>(`${environment.apiUrl}/news/${id}`).subscribe({
          next: (res) => {
            if (res.success) {
              Swal.fire('ลบสำเร็จ!', 'ข่าวสารได้ถูกลบออกแล้ว', 'success');
              this.fetchNews();
            }
          },
          error: (err) => {
            Swal.fire('ผิดพลาด', 'ไม่สามารถลบข่าวสารได้', 'error');
          }
        });
      }
    });
  }

  resetForm() {
    this.formData = {
      title: '',
      type: 'announce',
      news_date: '',
      description: ''
    };
    this.selectedFile = null;
    this.editMode = false;
    this.editId = null;
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  editNews(item: any) {
    this.editMode = true;
    this.editId = item.id;
    this.formData = {
      title: item.title,
      type: item.type,
      news_date: item.news_date ? new Date(item.news_date).toISOString().split('T')[0] : '',
      description: item.description
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.resetForm();
  }

  getBackendUrl() {
    return environment.apiUrl.replace(/\/api\/?$/, '');
  }

  getFileUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return this.getBackendUrl() + url;
  }
}
