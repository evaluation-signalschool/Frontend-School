import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SubjectItem {
  no?: number | string;
  name: string;
  credit?: number | string; // รองรับทั้งตัวเลข และข้อความวงเล็บ เช่น '(3)'
  grade?: string; // รองรับข้อความวงเล็บ เช่น '(รวม)' หรือเกรดปกติ
  braceSpan?: number; // จำนวนแถวที่ปีกกาจะครอบ (เช่น 3)
  braceCredit?: string; // หน่วยกิตรวมที่จะแสดงตรงกลางปีกกา (เช่น '2')
  braceGrade?: string; // เกรดรวมที่จะแสดงตรงกลางปีกกา (เช่น '4')
  skipMerge?: boolean; // ข้ามการสร้าง td ช่องหน่วยกิต/เกรด สำหรับแถวถัดไปที่โดนผสาน
}

export interface SubjectGroup {
  categoryName: string;
  items: SubjectItem[];
}

interface CellItem {
  no?: number;
  name: string;
  isHeader?: boolean;
  groupSize?: number;
  inGroup?: boolean;
  credit?: number | string;
  grade?: number | string;
}

interface RowData {
  left?: CellItem | null;
  right?: CellItem | null;
}

@Component({
  selector: 'app-transcript',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transcript.html',
  styleUrls: ['./transcript.scss'],
})
export class Transcript {
  readonly rowHeightPx = 28;

  student = {
    nameTh: '',
    nameEn: '',
    studentId: '',
    degree: '',
    faculty: '',
    major: '',
    issueDate: '',
    status: '',
  };

  // ⚠️ กลุ่มที่มีปีกกาต้องมี credit/grade แค่ "แถวแรก" เท่านั้น
  // แถวที่เหลือ (inGroup:true) ห้ามใส่ credit/grade เด็ดขาด ไม่งั้นซ้ำ/หลุด
  displayRows: RowData[] = [
    // --- Header วิชาหลัก / วิชา 25 ---
    {
      left: { isHeader: true, name: 'วิชาหลัก' },
      right: { no: 25, name: 'เหล่าทหาร', credit: 2, grade: 4 },
    },

    // วิชาหลัก 1 (เดี่ยว) / วิชารอง 26-30 (กลุ่ม 5 แถว)
    {
      left: { no: 1, name: 'ฝ่ายอำนวยการ', credit: 2, grade: 4 },
      right: { no: 26, name: 'การต่อต้านการก่อการร้าย', groupSize: 5, credit: 10, grade: 4 },
    },

    // --- วิชาหลัก 2-4 (กลุ่ม 3 แถว) ---
    {
      left: { no: 2, name: 'ฝ่ายอำนวยการทางการสื่อสาร', groupSize: 3, credit: 6, grade: 4 },
      right: { no: 27, name: 'การปฏิบัติการเพื่อสันติภาพ', inGroup: true },
    },
    {
      left: { no: 3, name: 'หลักพื้นฐานการรบและโครงร่างสนามรบ', inGroup: true },
      right: { no: 28, name: 'กองทัพเรือ,กองทัพอากาศ', inGroup: true },
    },
    {
      left: { no: 4, name: 'ระเบียบการนำหน่วย', inGroup: true },
      right: { no: 29, name: 'การปฏิบัติการร่วม/ผสม', inGroup: true },
    },

    // --- วิชาหลัก 5-8 (กลุ่ม 4 แถว) ---
    {
      left: { no: 5, name: 'องค์แทนการสื่อสาร', groupSize: 4, credit: 8, grade: 4 },
      right: { no: 30, name: 'การบินทหารบก', inGroup: true },
    },
    {
      left: { no: 6, name: 'หลักนิยมการสื่อสารทางยุทธวิธี', inGroup: true },
      right: { isHeader: true, name: 'วิชาประกอบ' },
    },
    {
      left: { no: 7, name: 'การปฏิบัติงานของพัน ส.พล.ทางยุทธวิธี', inGroup: true },
      right: { no: 31, name: 'ระเบียบงานสารบรรณ', credit: 2, grade: 4 },
    },
    {
      left: { no: 8, name: 'การสื่อสารทางยุทธวิธีระดับกองพล', inGroup: true },
      right: { no: 32, name: 'ประมุขศิลป์', groupSize: 8, credit: 16, grade: 4 },
    },

    // --- วิชาหลัก 9-13 (เดี่ยว 5 แถว) / วิชาประกอบ 33-37 ---
    {
      left: { no: 9, name: 'การส่งกำลังและซ่อมบำรุงสายสื่อสาร', credit: 2, grade: 4 },
      right: { no: 33, name: 'อุดมการณ์ทหาร', inGroup: true },
    },
    {
      left: { no: 10, name: 'การสื่อสารประเภทวิทยุ', credit: 2, grade: 4 },
      right: { no: 34, name: 'อุดมการณ์ความรักชาติ', inGroup: true },
    },
    {
      left: { no: 11, name: 'การสื่อสารประเภทสาย', credit: 2, grade: 4 },
      right: { no: 35, name: 'การศาสนาและศีลธรรม', inGroup: true },
    },
    {
      left: { no: 12, name: 'สงครามอิเล็กทรอนิกส์', credit: 2, grade: 4 },
      right: { no: 36, name: 'กฎหมายที่เกี่ยวข้องกับทหาร', inGroup: true },
    },
    {
      left: { no: 13, name: 'การพัฒนาทักษะดิจิทัลที่จำเป็นระดับสูง', credit: 2, grade: 4 },
      right: { no: 37, name: 'ค่านิยม 12 ประการ', inGroup: true },
    },

    // --- วิชาหลัก 14-16 (กลุ่ม 3 แถว) / วิชาประกอบ 38-39 & 40-43 (กลุ่ม 4 แถว) ---
    {
      left: { no: 14, name: 'การบบรยายสรุปทางการ', groupSize: 3, credit: 6, grade: 4 },
      right: { no: 38, name: 'ครูทหาร', inGroup: true },
    },
    {
      left: { no: 15, name: 'อิเล็กทรอนิกส์ และ IOT เบื้องต้น', inGroup: true },
      right: { no: 39, name: 'หน้าที่พลเมืองดี', inGroup: true },
    },
    {
      left: { no: 16, name: 'การจัดการฝึก', inGroup: true },
      right: { no: 40, name: 'พื้นฐานการวิจัย', groupSize: 4, credit: 8, grade: 4 },
    },

    // --- วิชาหลัก 17-19 (กลุ่ม 3 แถว) / วิชาประกอบ 41-43 ---
    {
      left: { no: 17, name: 'การปฏิบัติการที่ใช้เครือข่ายเป็นศูนย์กลาง', groupSize: 3, credit: 6, grade: 4 },
      right: { no: 41, name: 'จิตอาสา', inGroup: true },
    },
    {
      left: { no: 18, name: 'กิจการกระจายเสียงและกิจการโทรทัศน์ของ ทบ. ', inGroup: true },
      right: { no: 42, name: 'ต่อต้านการทุจริต', inGroup: true },
    },
    {
      left: { no: 19, name: 'การปฏิบัติการสานสนเทศ', inGroup: true },
      right: { no: 43, name: 'ประวัติศาสตร์ทหาร', inGroup: true },
    },

    // --- วิชาหลัก 20 / วิชาประกอบ 44 ---
    {
      left: { no: 20, name: 'ภาษาอังกฤษทางทหาร', credit: 2, grade: 4 },
      right: { no: 44, name: 'การจัดกองทัพบก', credit: 2, grade: 4 },
    },

    // --- วิชารอง อยู่บรรทัดเดียวกับวิชาประกอบ 45 ---
    {
      left: { isHeader: true, name: 'วิชารอง' },
      right: { no: 45, name: 'การบรรยายโดยผู้ทรงคุณวุฒิ', credit: 2, grade: 4 },
    },

    // 📌 ย้ายวิชารอง 21 ขึ้นมาฝั่ง left ให้ตรงกับบรรทัด 'ภาคปฏิบัติ'
    {
      left: { no: 21, name: 'แผนที่เข็มทิศ', groupSize: 4, credit: 8, grade: 4 },
      right: { isHeader: true, name: 'ภาคปฏิบัติ' },
    },

    // --- วิชารอง 22-24 (inGroup) / ภาคปฏิบัติ 46-47 ---
    {
      left: { no: 22, name: 'การป้องกันปราบปรามการก่อความไม่สงบ', inGroup: true },
      right: { no: 46, name: 'การเรียน/ฝึกร่วมระหว่างเหล่า ร., ม., ป., ช., ส.', credit: 2, grade: 4 },
    },
    {
      left: { no: 23, name: 'ปลัดบัญชี', inGroup: true },
      right: { no: 47, name: 'การฝึกภาคสนามการสื่อสารทางยุทธวิธี', credit: 2, grade: 4 },
    },
    {
      left: { no: 24, name: 'การรักษาความปลอดภัย', inGroup: true },
      right: null,
    },
  ];

  summaryData = {
    trainingTimePercent: '',
    examTimePercent: '',
    conductScore: '',
    rank: '',
    totalCredits: '',
    gpa: '',
    gradeCriteria: '',
    result: '',
  };

  qualifications: string[] = ['2.1', '2.2', '2.3', '2.4', '2.5'];

  signature1 = {
    rank: 'ร.ต.อ.', // หรือใส่ยศที่ต้องการ (หากไม่มี ให้ใส่เป็น stringว่าง '')
    name: 'สมชาย เข็มกลัด',
    position1: 'ตำแหน่งที่ 1',
    position2: 'ตำแหน่งที่ 2',
    date: '1 มกราคม 2569',
  };

  signature2 = {
    rank: 'พ.ต.ท.',
    name: 'สมหญิง รักดี',
    position1: 'ตำแหน่งที่ 1',
    position2: 'ตำแหน่งที่ 2',
    date: '1 มกราคม 2569',
  };

  leftBottomInfo: string[] = [];
  rightBottomInfo: string[] = [];

  braceHeight(groupSize: number | undefined): number {
    return (groupSize || 1) * this.rowHeightPx;
  }

  printTranscript() {
    window.print();
  }
}
