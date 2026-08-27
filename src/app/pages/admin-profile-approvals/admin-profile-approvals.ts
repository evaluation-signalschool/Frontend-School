import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-profile-approvals',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './admin-profile-approvals.html',
  styleUrl: './admin-profile-approvals.scss'
})
export class AdminProfileApprovals implements OnInit {
  requests: any[] = [];
  isLoading: boolean = true;
  apiUrl = environment.apiUrl;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;

  constructor(private http: HttpClient, private location: Location, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchRequests();
  }

  fetchRequests(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/edit-profile/requests`).subscribe({
      next: (res) => {
        this.requests = res;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching requests', err);
        this.isLoading = false;
        this.cdr.detectChanges();
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลคำร้องได้', 'error');
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.requests.length / this.pageSize);
  }

  get paginatedRequests(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.requests.slice(startIndex, startIndex + this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  viewDocument(documentPath: string): void {
    if (!documentPath) {
      Swal.fire('ไม่มีเอกสาร', 'ผู้ใช้นี้ไม่ได้แนบเอกสารมาด้วย', 'info');
      return;
    }
    
    let url = '';
    try {
      const docData = JSON.parse(documentPath);
      if (docData && docData.url) {
        url = docData.url;
      } else {
        throw new Error('Invalid JSON format');
      }
    } catch (e) {
      const backendBaseUrl = this.apiUrl.replace('/api', '');
      url = `${backendBaseUrl}/uploads/${documentPath}`;
    }
    
    window.open(url, '_blank');
  }

  updateStatus(id: number, status: 'approved' | 'rejected'): void {
    const actionText = status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ';
    const confirmColor = status === 'approved' ? '#4caf50' : '#f44336';

    Swal.fire({
      title: `ยืนยันการ${actionText}?`,
      text: `คุณต้องการ${actionText}คำร้องนี้ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#757575',
      confirmButtonText: `ยืนยัน${actionText}`,
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.put(`${this.apiUrl}/edit-profile/requests/${id}`, { status }).subscribe({
          next: () => {
            Swal.fire('สำเร็จ!', `ทำรายการ${actionText}เรียบร้อยแล้ว`, 'success');
            this.fetchRequests();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('ข้อผิดพลาด', `ไม่สามารถ${actionText}ได้`, 'error');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  deleteRequest(id: number): void {
    Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณต้องการลบข้อมูลคำร้องนี้ออกจากระบบใช่หรือไม่? (ลบแล้วกู้คืนไม่ได้)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#757575',
      confirmButtonText: 'ยืนยันลบ',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${this.apiUrl}/edit-profile/requests/${id}`).subscribe({
          next: () => {
            Swal.fire('ลบสำเร็จ!', 'ข้อมูลคำร้องถูกลบออกจากระบบแล้ว', 'success');
            this.fetchRequests();
          },
          error: (err) => {
            console.error(err);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้', 'error');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}
