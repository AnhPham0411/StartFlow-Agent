export type StaffStatus = 'available' | 'reviewing' | 'approval' | 'support-needed';

export interface DemoStaffMember {
  id: string;
  name: string;
  role: string;
  team: string;
  status: StaffStatus;
  activeCases: number;
  capacity: number;
  completedToday: number;
  slaPercent: number;
  pendingApprovals: number;
}

export const demoManagerStaff: DemoStaffMember[] = [
  {
    id: 'STAFF-DEMO-01',
    name: 'Nguyễn An (Demo)',
    role: 'Chuyên viên quan hệ khách hàng SME',
    team: 'Kinh doanh SME',
    status: 'available',
    activeCases: 3,
    capacity: 8,
    completedToday: 7,
    slaPercent: 98,
    pendingApprovals: 0,
  },
  {
    id: 'STAFF-DEMO-02',
    name: 'Trần Bình (Demo)',
    role: 'Chuyên viên KYC',
    team: 'Onboarding',
    status: 'reviewing',
    activeCases: 5,
    capacity: 7,
    completedToday: 11,
    slaPercent: 96,
    pendingApprovals: 1,
  },
  {
    id: 'STAFF-DEMO-03',
    name: 'Lê Chi (Demo)',
    role: 'Chuyên viên phân tích tín dụng',
    team: 'Tín dụng',
    status: 'reviewing',
    activeCases: 6,
    capacity: 7,
    completedToday: 6,
    slaPercent: 94,
    pendingApprovals: 2,
  },
  {
    id: 'STAFF-DEMO-04',
    name: 'Phạm Dũng (Demo)',
    role: 'Chuyên viên điều tra AML',
    team: 'Fraud & AML',
    status: 'support-needed',
    activeCases: 7,
    capacity: 7,
    completedToday: 4,
    slaPercent: 86,
    pendingApprovals: 1,
  },
  {
    id: 'STAFF-DEMO-05',
    name: 'Vũ Hà (Demo)',
    role: 'Chuyên viên vận hành',
    team: 'Vận hành',
    status: 'available',
    activeCases: 2,
    capacity: 8,
    completedToday: 13,
    slaPercent: 99,
    pendingApprovals: 0,
  },
  {
    id: 'STAFF-DEMO-06',
    name: 'Đỗ Minh (Demo)',
    role: 'Quản lý phê duyệt tín dụng',
    team: 'Quản lý',
    status: 'approval',
    activeCases: 4,
    capacity: 6,
    completedToday: 8,
    slaPercent: 97,
    pendingApprovals: 4,
  },
  {
    id: 'STAFF-DEMO-07',
    name: 'Hoàng Lan (Demo)',
    role: 'Chuyên viên khách hàng cá nhân',
    team: 'Bán lẻ',
    status: 'reviewing',
    activeCases: 5,
    capacity: 8,
    completedToday: 9,
    slaPercent: 95,
    pendingApprovals: 0,
  },
  {
    id: 'STAFF-DEMO-08',
    name: 'Bùi Quang (Demo)',
    role: 'Chuyên viên kiểm soát tuân thủ',
    team: 'Tuân thủ',
    status: 'reviewing',
    activeCases: 4,
    capacity: 6,
    completedToday: 5,
    slaPercent: 93,
    pendingApprovals: 2,
  },
  {
    id: 'STAFF-DEMO-09',
    name: 'Ngô Mai (Demo)',
    role: 'Chuyên viên dịch vụ khách hàng',
    team: 'Dịch vụ khách hàng',
    status: 'available',
    activeCases: 2,
    capacity: 7,
    completedToday: 12,
    slaPercent: 99,
    pendingApprovals: 0,
  },
  {
    id: 'STAFF-DEMO-10',
    name: 'Dương Sơn (Demo)',
    role: 'Trưởng nhóm tín dụng',
    team: 'Tín dụng',
    status: 'approval',
    activeCases: 5,
    capacity: 6,
    completedToday: 7,
    slaPercent: 96,
    pendingApprovals: 3,
  },
];

export function summarizeManagerStaff(staff: DemoStaffMember[]) {
  const totalCapacity = staff.reduce((sum, member) => sum + member.capacity, 0);
  const activeCases = staff.reduce((sum, member) => sum + member.activeCases, 0);

  return {
    total: staff.length,
    available: staff.filter((member) => member.status === 'available').length,
    activeCases,
    completedToday: staff.reduce((sum, member) => sum + member.completedToday, 0),
    pendingApprovals: staff.reduce((sum, member) => sum + member.pendingApprovals, 0),
    workloadPercent: totalCapacity ? Math.round((activeCases / totalCapacity) * 100) : 0,
    averageSlaPercent: staff.length
      ? Math.round(staff.reduce((sum, member) => sum + member.slaPercent, 0) / staff.length)
      : 0,
  };
}

export function summarizeStaffTeams(staff: DemoStaffMember[]) {
  return Array.from(
    staff.reduce((teams, member) => {
      const current = teams.get(member.team) ?? { members: 0, activeCases: 0, completedToday: 0 };
      current.members += 1;
      current.activeCases += member.activeCases;
      current.completedToday += member.completedToday;
      teams.set(member.team, current);
      return teams;
    }, new Map<string, { members: number; activeCases: number; completedToday: number }>()),
  ).map(([name, values]) => ({ name, ...values }));
}
