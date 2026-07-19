import { describe, expect, it } from 'vitest';
import {
  demoManagerStaff,
  summarizeManagerStaff,
  summarizeStaffTeams,
} from '@/src/data/demo-manager-staff';

describe('demo manager staff', () => {
  it('provides a visible human workforce demo without agent or model records', () => {
    expect(demoManagerStaff.length).toBeGreaterThanOrEqual(8);
    expect(demoManagerStaff.every((member) => member.name.includes('(Demo)'))).toBe(true);
    expect(demoManagerStaff.every((member) => member.capacity >= member.activeCases)).toBe(true);
    expect(demoManagerStaff.some((member) => member.pendingApprovals > 0)).toBe(true);
    expect(demoManagerStaff.some((member) => member.status === 'support-needed')).toBe(true);
  });

  it('summarizes workload, performance and teams consistently', () => {
    const summary = summarizeManagerStaff(demoManagerStaff);
    const teams = summarizeStaffTeams(demoManagerStaff);

    expect(summary.total).toBe(demoManagerStaff.length);
    expect(summary.activeCases).toBe(
      demoManagerStaff.reduce((sum, member) => sum + member.activeCases, 0),
    );
    expect(summary.pendingApprovals).toBeGreaterThan(0);
    expect(summary.averageSlaPercent).toBeGreaterThanOrEqual(80);
    expect(teams.reduce((sum, team) => sum + team.members, 0)).toBe(demoManagerStaff.length);
  });
});
