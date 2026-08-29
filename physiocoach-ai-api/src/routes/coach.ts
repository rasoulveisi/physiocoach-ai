import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  coachAssignedPlans,
  coachClientInvites,
  coachClients,
  coachMessages,
  coachPainAlerts,
  coachSeatLicenses,
} from '../db/schema';
import { handleRouteError, notFound } from '../shared/errors/api';
import { getApiRouteContext } from './context';
import { createExpressRouter } from './express-adapter';
import { parseJsonPayload } from './validation';

export interface CoachMessageDto {
  id: string;
  coachId: string;
  clientId: string;
  senderRole: 'coach' | 'client';
  senderName: string;
  message: string;
  isRead: boolean;
  isPainAlert: boolean;
  painScore: number | null;
  jointRegion: string | null;
  relatedSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachPainAlertDto {
  id: string;
  coachId: string;
  clientId: string;
  clientName: string;
  painScore: number;
  jointRegion: string;
  exerciseName: string | null;
  sessionDate: string;
  status: 'active' | 'resolved' | 'investigating';
  clinicalNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface CoachClientDto {
  id: string;
  coachId: string;
  clientUserId: string | null;
  clientName: string;
  clientEmail: string;
  injuryDiagnosis: string;
  dischargeDate: string | null;
  status: 'active' | 'graduated' | 'paused';
  complianceScore: number;
  currentPlan: {
    id: string;
    title: string;
    assignedAt: string;
    clinicalNotes?: string | null | undefined;
  } | null;

  lastSession: {
    date: string;
    relativeText: string;
    avgRpe: number;
    painScore: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachDashboardStats {
  totalPatients: number;
  activePatients: number;
  adherenceRate: number;
  painAlertsCount: number;
  graduatedCount: number;
  clinicName: string;
}

export interface AdherenceTelemetryDto {
  clientId: string;
  clientName: string;
  injuryDiagnosis: string;
  complianceScore: number;
  status: 'active' | 'graduated' | 'paused';
  currentPlanTitle: string;
  weeklyAdherence: Array<{
    week: string;
    sessionsPlanned: number;
    sessionsCompleted: number;
    adherencePct: number;
  }>;
  rpeTrend: Array<{
    date: string;
    sessionName: string;
    avgRpe: number;
    painLevel: number;
    completedSets: number;
    notes: string | null;
  }>;
  recentSessions: Array<{
    id: string;
    date: string;
    workoutName: string;
    durationMinutes: number;
    completed: boolean;
    rpe: number;
    painReported: number;
    exercisesSummary: string;
  }>;
  clinicalFlags: Array<{
    type: 'pain_spike' | 'missed_session' | 'progress_milestone';
    message: string;
    date: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface CoachSeatLicenseDto {
  id: string;
  coachId: string;
  tier: 'starter_5' | 'pro_10' | 'clinic_25';
  totalSeats: number;
  usedSeats: number;
  inviteCode: string;
  stripeCheckoutSessionId: string | null;
  status: 'active' | 'past_due' | 'canceled';
  createdAt: string;
  updatedAt: string;
}

export interface CoachInviteDto {
  id: string;
  licenseId: string;
  coachId: string;
  clientEmail: string;
  clientName: string;
  injuryDiagnosis?: string | null;
  inviteToken: string;
  inviteUrl: string;
  status: 'pending' | 'redeemed' | 'revoked';
  redeemedAt: string | null;
  redeemedUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WholesaleTierDto {
  tier: 'starter_5' | 'pro_10' | 'clinic_25';
  name: string;
  seats: number;
  priceMonthly: number;
  pricePerSeat: number;
  badge?: string;
  features: string[];
}

export interface CoachSeatSummaryDto {
  licenseId: string;
  tier: 'starter_5' | 'pro_10' | 'clinic_25';
  tierName: string;
  priceMonthly: number;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  inviteCode: string;
  status: 'active' | 'past_due' | 'canceled';
  invites: CoachInviteDto[];
  pricingTiers: WholesaleTierDto[];
}

export const WHOLESALE_TIERS: WholesaleTierDto[] = [
  {
    tier: 'starter_5',
    name: 'Starter 5-Seat Tier',
    seats: 5,
    priceMonthly: 49,
    pricePerSeat: 9.8,
    badge: 'Solo PT',
    features: [
      '5 Active Post-Discharge Patient Seats',
      'Remote Adherence Telemetry',
      'Pain Spike & Flare-Up Notifications',
      'Direct Patient Activation Links',
    ],
  },
  {
    tier: 'pro_10',
    name: 'Pro 10-Seat Tier',
    seats: 10,
    priceMonthly: 89,
    pricePerSeat: 8.9,
    badge: 'Most Popular',
    features: [
      '10 Active Post-Discharge Patient Seats',
      'Priority RPE & Pain Flare-Up Alerts',
      'Custom Clinical Rehab Protocol Builder',
      'Branded Clinic Invite Codes',
      'Weekly Adherence Reports & Exports',
    ],
  },
  {
    tier: 'clinic_25',
    name: 'Clinic 25-Seat Tier',
    seats: 25,
    priceMonthly: 199,
    pricePerSeat: 7.96,
    badge: 'Best Value',
    features: [
      '25 Active Post-Discharge Patient Seats',
      'Multi-Therapist Staff Allocation',
      'Automated Discharge-to-Rehab Funnel',
      'Dedicated Account Manager',
      'Direct EHR / EMR Integration Export',
    ],
  },
];

const DEFAULT_WHOLESALE_TIER: WholesaleTierDto = {
  tier: 'pro_10',
  name: 'Pro 10-Seat Tier',
  seats: 10,
  priceMonthly: 89,
  pricePerSeat: 8.9,
  badge: 'Most Popular',
  features: [
    '10 Active Post-Discharge Patient Seats',
    'Priority RPE & Pain Flare-Up Alerts',
    'Custom Clinical Rehab Protocol Builder',
    'Branded Clinic Invite Codes',
    'Weekly Adherence Reports & Exports',
  ],
};

export function getWholesaleTierConfig(tier?: string | null): WholesaleTierDto {
  return WHOLESALE_TIERS.find((t) => t.tier === tier) ?? DEFAULT_WHOLESALE_TIER;
}

// In-memory fallback repository for local/testing without full DB seed
export const inMemoryCoachClients = new Map<string, CoachClientDto>();
export const inMemoryCoachPlans = new Map<
  string,
  {
    id: string;
    coachId: string;
    clientId: string;
    workoutPlanId: string;
    planTitle?: string;
    clinicalNotes?: string | null;
    assignedAt: string;
    status: string;
  }
>();
export const inMemoryCoachLicenses = new Map<string, CoachSeatLicenseDto>();
export const inMemoryCoachInvites = new Map<string, CoachInviteDto>();
export const inMemoryCoachMessages = new Map<string, CoachMessageDto>();
export const inMemoryCoachAlerts = new Map<string, CoachPainAlertDto>();

export const DEFAULT_DEMO_ALERTS: CoachPainAlertDto[] = [
  {
    id: 'alert-patellar-001',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientId: 'pt-client-001',
    clientName: 'Sarah Jenkins',
    painScore: 6,
    jointRegion: 'Patellar Tendon (Right)',
    exerciseName: 'Barbell Back Squat (Heavy Eccentric)',
    sessionDate: '2026-08-28',
    status: 'active',
    clinicalNote: null,
    resolvedAt: null,
    createdAt: '2026-08-28T17:45:00Z',
    updatedAt: '2026-08-28T17:45:00Z',
  },
  {
    id: 'alert-lumbar-002',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientId: 'pt-client-003',
    clientName: 'Elena Rostova',
    painScore: 5,
    jointRegion: 'Lumbar Spine (L5-S1)',
    exerciseName: 'Romanian Deadlift',
    sessionDate: '2026-08-26',
    status: 'active',
    clinicalNote: null,
    resolvedAt: null,
    createdAt: '2026-08-26T12:30:00Z',
    updatedAt: '2026-08-26T12:30:00Z',
  },
];

export const DEFAULT_DEMO_MESSAGES: CoachMessageDto[] = [
  {
    id: 'msg-sarah-001',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientId: 'pt-client-001',
    senderRole: 'client',
    senderName: 'Sarah Jenkins',
    message: 'Felt sharp patellar tendon irritation (6/10) during set 3 of squats as I approached parallel.',
    isRead: false,
    isPainAlert: true,
    painScore: 6,
    jointRegion: 'Patellar Tendon',
    relatedSessionId: 'sess-pt-client-001-01',
    createdAt: '2026-08-28T17:45:00Z',
    updatedAt: '2026-08-28T17:45:00Z',
  },
  {
    id: 'msg-coach-002',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientId: 'pt-client-001',
    senderRole: 'coach',
    senderName: 'Dr. Alex Vance, DPT',
    message: 'Understood Sarah. Pause dynamic squats immediately. Switch to 45-second Spanish Squat isometric holds at 60° knee flexion to relieve tendon shear.',
    isRead: true,
    isPainAlert: false,
    painScore: null,
    jointRegion: null,
    relatedSessionId: null,
    createdAt: '2026-08-28T18:00:00Z',
    updatedAt: '2026-08-28T18:00:00Z',
  },
  {
    id: 'msg-elena-001',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientId: 'pt-client-003',
    senderRole: 'client',
    senderName: 'Elena Rostova',
    message: 'Felt moderate lower back stiffness (5/10) on the last set of RDLs today.',
    isRead: false,
    isPainAlert: true,
    painScore: 5,
    jointRegion: 'Lumbar Spine (L5-S1)',
    relatedSessionId: 'sess-pt-client-003-01',
    createdAt: '2026-08-26T12:30:00Z',
    updatedAt: '2026-08-26T12:30:00Z',
  },
];

for (const alert of DEFAULT_DEMO_ALERTS) {
  if (!inMemoryCoachAlerts.has(alert.id)) {
    inMemoryCoachAlerts.set(alert.id, alert);
  }
}

for (const msg of DEFAULT_DEMO_MESSAGES) {
  if (!inMemoryCoachMessages.has(msg.id)) {
    inMemoryCoachMessages.set(msg.id, msg);
  }
}

const DEFAULT_DEMO_LICENSE: CoachSeatLicenseDto = {
  id: 'lic-apex-pro-10',
  coachId: '00000000-0000-4000-8000-000000000001',
  tier: 'pro_10',
  totalSeats: 10,
  usedSeats: 6,
  inviteCode: 'APEX-PRO-10',
  stripeCheckoutSessionId: 'cs_test_apex_pro_10_demo',
  status: 'active',
  createdAt: '2026-05-01T08:00:00Z',
  updatedAt: '2026-08-28T10:00:00Z',
};

const DEFAULT_DEMO_INVITES: CoachInviteDto[] = [
  {
    id: 'inv-demo-001',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'sarah.jenkins@example.com',
    clientName: 'Sarah Jenkins',
    injuryDiagnosis: 'Patellar Tendinopathy (Right)',
    inviteToken: 'pt-inv-sarahj88',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-sarahj88',
    status: 'redeemed',
    redeemedAt: '2026-07-15T09:00:00Z',
    redeemedUserId: 'usr-client-001',
    createdAt: '2026-07-15T08:30:00Z',
    updatedAt: '2026-07-15T09:00:00Z',
  },
  {
    id: 'inv-demo-002',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'marcus.vance@example.com',
    clientName: 'Marcus Vance',
    injuryDiagnosis: 'Post-Op ACL Reconstruction (Left)',
    inviteToken: 'pt-inv-marcusv94',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-marcusv94',
    status: 'redeemed',
    redeemedAt: '2026-06-30T11:00:00Z',
    redeemedUserId: 'usr-client-002',
    createdAt: '2026-06-30T10:00:00Z',
    updatedAt: '2026-06-30T11:00:00Z',
  },
  {
    id: 'inv-demo-003',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'elena.rostova@example.com',
    clientName: 'Elena Rostova',
    injuryDiagnosis: 'Lumbar Disc Herniation (L5-S1)',
    inviteToken: 'pt-inv-elenar72',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-elenar72',
    status: 'redeemed',
    redeemedAt: '2026-08-01T15:00:00Z',
    redeemedUserId: 'usr-client-003',
    createdAt: '2026-08-01T14:00:00Z',
    updatedAt: '2026-08-01T15:00:00Z',
  },
  {
    id: 'inv-demo-004',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'david.chen@example.com',
    clientName: 'David Chen',
    injuryDiagnosis: 'Subacromial Shoulder Impingement',
    inviteToken: 'pt-inv-davidc96',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-davidc96',
    status: 'redeemed',
    redeemedAt: '2026-05-20T10:00:00Z',
    redeemedUserId: 'usr-client-004',
    createdAt: '2026-05-20T09:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'inv-demo-005',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'amara.okafor@example.com',
    clientName: 'Amara Okafor',
    injuryDiagnosis: 'Achilles Tendinopathy (Insertional)',
    inviteToken: 'pt-inv-amarao50',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-amarao50',
    status: 'redeemed',
    redeemedAt: '2026-08-10T14:20:00Z',
    redeemedUserId: 'usr-client-005',
    createdAt: '2026-08-10T13:00:00Z',
    updatedAt: '2026-08-10T14:20:00Z',
  },
  {
    id: 'inv-demo-006',
    licenseId: 'lic-apex-pro-10',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientEmail: 'liam.reynolds@example.com',
    clientName: 'Liam Reynolds',
    injuryDiagnosis: 'Rotator Cuff Supraspinatus Strain',
    inviteToken: 'pt-inv-liamr42',
    inviteUrl: 'https://physiocoach.ai/invite/pt-inv-liamr42',
    status: 'pending',
    redeemedAt: null,
    redeemedUserId: null,
    createdAt: '2026-08-28T09:15:00Z',
    updatedAt: '2026-08-28T09:15:00Z',
  },
];

// Initialize default demo licenses and invites in-memory
if (!inMemoryCoachLicenses.has(DEFAULT_DEMO_LICENSE.coachId)) {
  inMemoryCoachLicenses.set(DEFAULT_DEMO_LICENSE.coachId, DEFAULT_DEMO_LICENSE);
}
for (const inv of DEFAULT_DEMO_INVITES) {
  if (!inMemoryCoachInvites.has(inv.id)) {
    inMemoryCoachInvites.set(inv.id, inv);
  }
}

// Initial high-fidelity demo roster for physical therapy post-discharge clinics
const DEFAULT_DEMO_CLIENTS: CoachClientDto[] = [
  {
    id: 'pt-client-001',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientUserId: 'usr-client-001',
    clientName: 'Sarah Jenkins',
    clientEmail: 'sarah.jenkins@example.com',
    injuryDiagnosis: 'Patellar Tendinopathy (Right)',
    dischargeDate: '2026-07-15',
    status: 'active',
    complianceScore: 88,
    currentPlan: {
      id: 'plan-patellar-hsr',
      title: 'Patellar Tendon Heavy Slow Resistance (HSR)',
      assignedAt: '2026-07-18T10:00:00Z',
      clinicalNotes: 'Isometric holds at 60° knee flexion. Progress load only when pain < 3/10.',
    },
    lastSession: {
      date: '2026-08-28',
      relativeText: 'Yesterday',
      avgRpe: 6.5,
      painScore: 2,
    },
    createdAt: '2026-07-15T09:00:00Z',
    updatedAt: '2026-08-28T18:30:00Z',
  },
  {
    id: 'pt-client-002',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientUserId: 'usr-client-002',
    clientName: 'Marcus Vance',
    clientEmail: 'marcus.vance@example.com',
    injuryDiagnosis: 'Post-Op ACL Reconstruction (Left)',
    dischargeDate: '2026-06-30',
    status: 'active',
    complianceScore: 94,
    currentPlan: {
      id: 'plan-acl-return-sport',
      title: 'ACL Return-to-Sport Phase 3 (Rotational & Plyo)',
      assignedAt: '2026-07-02T14:30:00Z',
      clinicalNotes: 'Focus on quad limb symmetry index (LSI > 90%). Maintain valgus knee discipline.',
    },
    lastSession: {
      date: '2026-08-27',
      relativeText: '2 days ago',
      avgRpe: 7.0,
      painScore: 1,
    },
    createdAt: '2026-06-30T11:00:00Z',
    updatedAt: '2026-08-27T17:45:00Z',
  },
  {
    id: 'pt-client-003',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientUserId: 'usr-client-003',
    clientName: 'Elena Rostova',
    clientEmail: 'elena.rostova@example.com',
    injuryDiagnosis: 'Lumbar Disc Herniation (L5-S1)',
    dischargeDate: '2026-08-01',
    status: 'active',
    complianceScore: 72,
    currentPlan: {
      id: 'plan-lumbar-mcgill',
      title: 'Spine-Safe Core & Hip Hinge Protocol',
      assignedAt: '2026-08-05T08:00:00Z',
      clinicalNotes: 'McGill Big 3 daily. Zero spinal flexion under load. Neutral spine Romanian deadlifts only.',
    },
    lastSession: {
      date: '2026-08-26',
      relativeText: '3 days ago',
      avgRpe: 5.5,
      painScore: 3,
    },
    createdAt: '2026-08-01T15:00:00Z',
    updatedAt: '2026-08-26T12:15:00Z',
  },
  {
    id: 'pt-client-004',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientUserId: 'usr-client-004',
    clientName: 'David Chen',
    clientEmail: 'david.chen@example.com',
    injuryDiagnosis: 'Subacromial Shoulder Impingement',
    dischargeDate: '2026-05-20',
    status: 'graduated',
    complianceScore: 96,
    currentPlan: {
      id: 'plan-shoulder-cuff',
      title: 'Rotator Cuff & Scapular Stability Protocol',
      assignedAt: '2026-05-25T16:00:00Z',
      clinicalNotes: 'Graduated from active PT. Maintain 2x weekly scapular upward rotation strength.',
    },
    lastSession: {
      date: '2026-08-22',
      relativeText: '1 week ago',
      avgRpe: 6.0,
      painScore: 0,
    },
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-08-22T09:30:00Z',
  },
  {
    id: 'pt-client-005',
    coachId: '00000000-0000-4000-8000-000000000001',
    clientUserId: 'usr-client-005',
    clientName: 'Amara Okafor',
    clientEmail: 'amara.okafor@example.com',
    injuryDiagnosis: 'Achilles Tendinopathy (Insertional)',
    dischargeDate: '2026-08-10',
    status: 'paused',
    complianceScore: 50,
    currentPlan: {
      id: 'plan-achilles-soleus',
      title: 'Isometric Soleus & Flat-Surface Calf Loading',
      assignedAt: '2026-08-12T13:00:00Z',
      clinicalNotes: 'Avoid dorsiflexion below neutral until insertional tenderness resolves.',
    },
    lastSession: {
      date: '2026-08-24',
      relativeText: '5 days ago',
      avgRpe: 8.0,
      painScore: 4,
    },
    createdAt: '2026-08-10T14:20:00Z',
    updatedAt: '2026-08-24T19:00:00Z',
  },
];

// Initialize default demo clients in-memory if empty
for (const client of DEFAULT_DEMO_CLIENTS) {
  if (!inMemoryCoachClients.has(client.id)) {
    inMemoryCoachClients.set(client.id, client);
  }
}

export const createClientSchema = z
  .object({
    clientName: z.string().min(2, 'Client name must be at least 2 characters').max(100),
    clientEmail: z.string().email('Valid email address is required'),
    injuryDiagnosis: z.string().min(2, 'Injury diagnosis is required').max(150),
    dischargeDate: z.string().optional().nullable(),
    status: z.enum(['active', 'graduated', 'paused']).optional().default('active'),
    complianceScore: z.number().min(0).max(100).optional().default(100),
    clinicalNotes: z.string().optional().nullable(),
    assignedPlanId: z.string().optional().nullable(),
    assignedPlanTitle: z.string().optional().nullable(),
  })
  .strict();

export const assignPlanSchema = z
  .object({
    clientId: z.string().min(1, 'Client ID is required'),
    workoutPlanId: z.string().min(1, 'Workout Plan ID is required'),
    planTitle: z.string().optional(),
    clinicalNotes: z.string().optional().nullable(),
    targetFrequencyDays: z.number().int().min(1).max(7).optional().default(3),
  })
  .strict();

export const seatCheckoutSchema = z
  .object({
    tier: z.enum(['starter_5', 'pro_10', 'clinic_25']),
    successUrl: z.string().optional(),
    cancelUrl: z.string().optional(),
  })
  .strict();

export const generateInviteSchema = z
  .object({
    clientName: z.string().min(2, 'Client name must be at least 2 characters').max(100),
    clientEmail: z.string().email('Valid email address is required'),
    licenseId: z.string().optional(),
    injuryDiagnosis: z.string().optional(),
  })
  .strict();

export const redeemInviteSchema = z
  .object({
    inviteToken: z.string().min(1, 'Invite token is required'),
    patientUserId: z.string().optional(),
    patientName: z.string().optional(),
    patientEmail: z.string().email('Valid email address is required').optional(),
    injuryDiagnosis: z.string().optional(),
  })
  .strict();

export const revokeInviteSchema = z
  .object({
    inviteId: z.string().min(1, 'Invite ID is required'),
  })
  .strict();

export const postCoachMessageSchema = z
  .object({
    clientId: z.string().min(1, 'Client ID is required'),
    message: z.string().min(1, 'Message cannot be empty').max(2000),
    senderRole: z.enum(['coach', 'client']).optional().default('coach'),
    senderName: z.string().optional(),
    isPainAlert: z.boolean().optional().default(false),
    painScore: z.number().int().min(0).max(10).optional().nullable(),
    jointRegion: z.string().optional().nullable(),
    exerciseName: z.string().optional().nullable(),
    relatedSessionId: z.string().optional().nullable(),
  })
  .strict();

export const resolveAlertSchema = z
  .object({
    clinicalNote: z.string().optional().nullable(),
    status: z.enum(['resolved', 'active', 'investigating']).optional().default('resolved'),
    sendFeedbackMessage: z.boolean().optional().default(true),
    directiveMessage: z.string().optional().nullable(),
  })
  .strict();

export function recordPainAlertInternal(params: {
  coachId: string;
  clientId: string;
  clientName: string;
  painScore: number;
  jointRegion?: string | null;
  exerciseName?: string | null;
  sessionDate?: string;
  sessionId?: string | null;
  note?: string | null;
}): CoachPainAlertDto {
  const alertId = `alert-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const alert: CoachPainAlertDto = {
    id: alertId,
    coachId: params.coachId,
    clientId: params.clientId,
    clientName: params.clientName,
    painScore: params.painScore,
    jointRegion: params.jointRegion || 'General Joint Discomfort',
    exerciseName: params.exerciseName || null,
    sessionDate: params.sessionDate || now.slice(0, 10),
    status: 'active',
    clinicalNote: params.note || null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryCoachAlerts.set(alertId, alert);
  return alert;
}

function generateClientAdherenceTelemetry(client: CoachClientDto): AdherenceTelemetryDto {
  const isHighPerformer = client.complianceScore >= 85;
  const isModerate = client.complianceScore >= 70 && client.complianceScore < 85;

  const weeklyAdherence = [
    {
      week: 'Week 1',
      sessionsPlanned: 3,
      sessionsCompleted: isHighPerformer ? 3 : isModerate ? 2 : 1,
      adherencePct: isHighPerformer ? 100 : isModerate ? 67 : 33,
    },
    {
      week: 'Week 2',
      sessionsPlanned: 3,
      sessionsCompleted: isHighPerformer ? 3 : isModerate ? 3 : 2,
      adherencePct: isHighPerformer ? 100 : isModerate ? 100 : 67,
    },
    {
      week: 'Week 3',
      sessionsPlanned: 3,
      sessionsCompleted: isHighPerformer ? 3 : isModerate ? 2 : 1,
      adherencePct: isHighPerformer ? 100 : isModerate ? 67 : 33,
    },
    {
      week: 'Week 4 (Current)',
      sessionsPlanned: 3,
      sessionsCompleted: isHighPerformer ? 3 : isModerate ? 2 : 1,
      adherencePct: isHighPerformer ? 100 : isModerate ? 67 : 33,
    },
  ];

  const rpeTrend = [
    {
      date: '2026-08-10',
      sessionName: 'Rehab Routine - Day 1',
      avgRpe: isHighPerformer ? 6.0 : 7.5,
      painLevel: isHighPerformer ? 1 : 3,
      completedSets: 12,
      notes: 'Good tolerance throughout. No flare up.',
    },
    {
      date: '2026-08-14',
      sessionName: 'Rehab Routine - Day 2',
      avgRpe: isHighPerformer ? 6.5 : 7.0,
      painLevel: isHighPerformer ? 1 : 2,
      completedSets: 12,
      notes: 'Increased tempo under control.',
    },
    {
      date: '2026-08-18',
      sessionName: 'Rehab Routine - Day 1',
      avgRpe: isHighPerformer ? 7.0 : 8.0,
      painLevel: isHighPerformer ? 2 : 4,
      completedSets: 11,
      notes: isHighPerformer ? 'Slight fatigue on last set.' : 'Felt mild joint pinch during final set.',
    },
    {
      date: '2026-08-22',
      sessionName: 'Rehab Routine - Day 2',
      avgRpe: isHighPerformer ? 6.5 : 6.0,
      painLevel: isHighPerformer ? 1 : 2,
      completedSets: 12,
      notes: 'Smooth movement pattern, pain decreased.',
    },
    {
      date: client.lastSession?.date ?? '2026-08-28',
      sessionName: 'Rehab Routine - Day 3',
      avgRpe: client.lastSession?.avgRpe ?? 6.5,
      painLevel: client.lastSession?.painScore ?? 2,
      completedSets: 12,
      notes: 'Completed full prescribed volume with correct tempo.',
    },
  ];

  const recentSessions = [
    {
      id: `sess-${client.id}-01`,
      date: client.lastSession?.date ?? '2026-08-28',
      workoutName: client.currentPlan?.title ?? 'Rehab Loading Day 1',
      durationMinutes: 42,
      completed: true,
      rpe: client.lastSession?.avgRpe ?? 6.5,
      painReported: client.lastSession?.painScore ?? 2,
      exercisesSummary: 'Isometric Loading (3 sets), Controlled Eccentric (3 sets), Core Stability (4 sets)',
    },
    {
      id: `sess-${client.id}-02`,
      date: '2026-08-24',
      workoutName: client.currentPlan?.title ?? 'Rehab Loading Day 2',
      durationMinutes: 38,
      completed: true,
      rpe: 6.0,
      painReported: 1,
      exercisesSummary: 'Single Leg Balance (3 sets), Scapular Retraction (3 sets), Glute Activation (4 sets)',
    },
    {
      id: `sess-${client.id}-03`,
      date: '2026-08-20',
      workoutName: client.currentPlan?.title ?? 'Rehab Loading Day 1',
      durationMinutes: 45,
      completed: true,
      rpe: 7.0,
      painReported: 2,
      exercisesSummary: 'Terminal Knee Extensions (4 sets), Romanian Deadlifts (3 sets), Step Downs (3 sets)',
    },
  ];

  const clinicalFlags: AdherenceTelemetryDto['clinicalFlags'] = [];

  if (client.lastSession && client.lastSession.painScore >= 4) {
    clinicalFlags.push({
      type: 'pain_spike',
      message: `Pain score of ${client.lastSession.painScore}/10 logged during last session. Review load progression.`,
      date: client.lastSession.date,
      severity: 'high',
    });
  }

  if (client.complianceScore < 70) {
    clinicalFlags.push({
      type: 'missed_session',
      message: 'Weekly adherence dropped below 70%. Patient may need scheduled check-in.',
      date: '2026-08-26',
      severity: 'medium',
    });
  }

  if (client.complianceScore >= 90) {
    clinicalFlags.push({
      type: 'progress_milestone',
      message: 'Excellent compliance (>90%) for 4 consecutive weeks. Candidate for progression.',
      date: '2026-08-28',
      severity: 'low',
    });
  }

  return {
    clientId: client.id,
    clientName: client.clientName,
    injuryDiagnosis: client.injuryDiagnosis,
    complianceScore: client.complianceScore,
    status: client.status,
    currentPlanTitle: client.currentPlan?.title ?? 'Custom Rehab Protocol',
    weeklyAdherence,
    rpeTrend,
    recentSessions,
    clinicalFlags,
  };
}

export function createCoachRoutes() {
  const route = createExpressRouter();

  // Helper to compute stats
  function computeStats(clients: CoachClientDto[]): CoachDashboardStats {
    const total = clients.length;
    const active = clients.filter((c) => c.status === 'active').length;
    const graduated = clients.filter((c) => c.status === 'graduated').length;
    const painAlerts = clients.filter(
      (c) => (c.lastSession?.painScore ?? 0) >= 3 || c.complianceScore < 60,
    ).length;

    const avgCompliance =
      total > 0
        ? Math.round(clients.reduce((sum, c) => sum + (c.complianceScore || 0), 0) / total)
        : 88;

    return {
      totalPatients: total,
      activePatients: active,
      adherenceRate: avgCompliance,
      painAlertsCount: painAlerts,
      graduatedCount: graduated,
      clinicName: 'Apex Physical Therapy & Sports Rehab',
    };
  }

  // GET /coach/clients (and /api/v1/coach/clients)
  route.get('/coach/clients', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const url = new URL(c.req.url, 'http://localhost');
      const statusFilter = url.searchParams.get('status')?.trim().toLowerCase();
      const searchQuery = url.searchParams.get('search')?.trim().toLowerCase();

      let clientList: CoachClientDto[] = [];

      if (db) {
        try {
          const dbRows = await db
            .select()
            .from(coachClients)
            .where(eq(coachClients.coachId, user.id))
            .orderBy(desc(coachClients.createdAt));

          if (dbRows.length > 0) {
            // Load assigned plans
            const assignedPlanRows = await db
              .select()
              .from(coachAssignedPlans)
              .where(eq(coachAssignedPlans.coachId, user.id));

            const plansByClient = new Map<string, typeof assignedPlanRows[0]>();
            for (const ap of assignedPlanRows) {
              if (ap.clientUserId && !plansByClient.has(ap.clientUserId)) {
                plansByClient.set(ap.clientUserId, ap);
              }
            }

            clientList = dbRows.map((row) => {
              const assigned = row.clientUserId ? plansByClient.get(row.clientUserId) : null;
              return {
                id: row.id,
                coachId: row.coachId,
                clientUserId: row.clientUserId,
                clientName: row.clientName,
                clientEmail: row.clientEmail,
                injuryDiagnosis: row.injuryDiagnosis,
                dischargeDate: row.dischargeDate,
                status: (row.status as 'active' | 'graduated' | 'paused') || 'active',
                complianceScore: Math.round(row.complianceScore ?? 80),
                currentPlan: assigned
                  ? {
                      id: assigned.workoutPlanId,
                      title: 'Prescribed Clinical Rehab Plan',
                      assignedAt: assigned.assignedAt,
                      clinicalNotes: assigned.clinicalNotes,
                    }
                  : null,
                lastSession: {
                  date: row.updatedAt ? row.updatedAt.slice(0, 10) : '2026-08-28',
                  relativeText: 'Recent',
                  avgRpe: 6.5,
                  painScore: 2,
                },
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
              };
            });
          }
        } catch (dbError) {
          console.warn('coach.clients.db_fetch_error', dbError);
        }
      }

      // If DB empty or not returned, combine in-memory clients
      if (clientList.length === 0) {
        clientList = Array.from(inMemoryCoachClients.values());
      } else {
        // Also include any newly created in-memory clients not yet in db
        for (const inMem of inMemoryCoachClients.values()) {
          if (!clientList.some((c) => c.id === inMem.id)) {
            clientList.unshift(inMem);
          }
        }
      }

      // Filter by status if requested
      if (statusFilter && statusFilter !== 'all') {
        clientList = clientList.filter((c) => c.status.toLowerCase() === statusFilter);
      }

      // Filter by search query
      if (searchQuery) {
        clientList = clientList.filter(
          (c) =>
            c.clientName.toLowerCase().includes(searchQuery) ||
            c.injuryDiagnosis.toLowerCase().includes(searchQuery) ||
            c.clientEmail.toLowerCase().includes(searchQuery),
        );
      }

      const stats = computeStats(Array.from(inMemoryCoachClients.values()));

      return c.json({
        data: clientList,
        stats,
        total: clientList.length,
      });
    } catch (error) {
      console.error('coach.clients.get.error', error);
      const fallbackList = Array.from(inMemoryCoachClients.values());
      return c.json({
        data: fallbackList,
        stats: computeStats(fallbackList),
        total: fallbackList.length,
      });
    }
  });

  // GET /coach/stats (and /api/v1/coach/stats)
  route.get('/coach/stats', async (c) => {
    try {
      const list = Array.from(inMemoryCoachClients.values());
      return c.json({ data: computeStats(list) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch coach statistics.');
    }
  });

  // POST /coach/clients (and /api/v1/coach/clients)
  route.post('/coach/clients', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, createClientSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const clientId = `pt-client-${crypto.randomUUID().slice(0, 8)}`;
      const clientUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;

      const newClientDto: CoachClientDto = {
        id: clientId,
        coachId: user.id,
        clientUserId,
        clientName: parsed.data.clientName,
        clientEmail: parsed.data.clientEmail,
        injuryDiagnosis: parsed.data.injuryDiagnosis,
        dischargeDate: parsed.data.dischargeDate ?? now.slice(0, 10),
        status: parsed.data.status || 'active',
        complianceScore: parsed.data.complianceScore ?? 100,
        currentPlan: parsed.data.assignedPlanId
          ? {
              id: parsed.data.assignedPlanId,
              title: parsed.data.assignedPlanTitle || 'Initial Post-Discharge Routine',
              assignedAt: now,
              clinicalNotes: parsed.data.clinicalNotes ?? null,
            }
          : null,

        lastSession: null,
        createdAt: now,
        updatedAt: now,
      };

      if (db) {
        try {
          await db.insert(coachClients).values({
            id: clientId,
            coachId: user.id,
            clientUserId,
            clientName: parsed.data.clientName,
            clientEmail: parsed.data.clientEmail,
            injuryDiagnosis: parsed.data.injuryDiagnosis,
            dischargeDate: parsed.data.dischargeDate ?? now.slice(0, 10),
            status: parsed.data.status || 'active',
            complianceScore: parsed.data.complianceScore ?? 100,
            createdAt: now,
            updatedAt: now,
          });

          if (parsed.data.assignedPlanId) {
            await db.insert(coachAssignedPlans).values({
              id: crypto.randomUUID(),
              coachId: user.id,
              clientUserId,
              workoutPlanId: parsed.data.assignedPlanId,
              clinicalNotes: parsed.data.clinicalNotes ?? null,
              assignedAt: now,
              status: 'active',
            });
          }
        } catch (dbError) {
          console.warn('coach.clients.db_insert_error', dbError);
        }
      }

      // Save in-memory
      inMemoryCoachClients.set(clientId, newClientDto);

      return c.json(
        {
          success: true,
          data: newClientDto,
        },
        201,
      );
    } catch (error) {
      return handleRouteError(c, error, 'Failed to enroll new client.');
    }
  });

  // POST /coach/clients/assign-plan (and /api/v1/coach/clients/assign-plan)
  route.post('/coach/clients/assign-plan', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, assignPlanSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const assignmentId = crypto.randomUUID();

      // Find client in-memory or DB
      let targetClient = inMemoryCoachClients.get(parsed.data.clientId);
      if (!targetClient) {
        // Search by clientUserId or ID
        for (const cl of inMemoryCoachClients.values()) {
          if (cl.id === parsed.data.clientId || cl.clientUserId === parsed.data.clientId) {
            targetClient = cl;
            break;
          }
        }
      }

      const planTitle =
        parsed.data.planTitle ||
        (targetClient ? `${targetClient.injuryDiagnosis} Targeted Routine` : 'Prescribed Rehab Protocol');

      const assignmentRecord = {
        id: assignmentId,
        coachId: user.id,
        clientId: parsed.data.clientId,
        workoutPlanId: parsed.data.workoutPlanId,
        planTitle,
        clinicalNotes: parsed.data.clinicalNotes ?? null,
        assignedAt: now,
        status: 'active',
      };

      if (db) {
        try {
          await db.insert(coachAssignedPlans).values({
            id: assignmentId,
            coachId: user.id,
            clientUserId: targetClient?.clientUserId ?? parsed.data.clientId,
            workoutPlanId: parsed.data.workoutPlanId,
            clinicalNotes: parsed.data.clinicalNotes ?? null,
            assignedAt: now,
            status: 'active',
          });
        } catch (dbError) {
          console.warn('coach.assign_plan.db_error', dbError);
        }
      }

      inMemoryCoachPlans.set(assignmentId, assignmentRecord);

      // Update client record in-memory if found
      if (targetClient) {
        targetClient.currentPlan = {
          id: parsed.data.workoutPlanId,
          title: planTitle,
          assignedAt: now,
          clinicalNotes: parsed.data.clinicalNotes ?? null,
        };

        targetClient.updatedAt = now;
        inMemoryCoachClients.set(targetClient.id, targetClient);
      }

      return c.json(
        {
          success: true,
          data: assignmentRecord,
        },
        201,
      );
    } catch (error) {
      return handleRouteError(c, error, 'Failed to assign workout plan to client.');
    }
  });

  // GET /coach/clients/:id/adherence (and /api/v1/coach/clients/:id/adherence)
  route.get('/coach/clients/:id/adherence', async (c) => {
    try {
      const clientId = c.req.param('id');
      let client = inMemoryCoachClients.get(clientId);

      if (!client) {
        for (const cl of inMemoryCoachClients.values()) {
          if (cl.id === clientId || cl.clientUserId === clientId) {
            client = cl;
            break;
          }
        }
      }

      const { db } = getApiRouteContext(c);
      if (!client && db) {
        try {
          const rows = await db
            .select()
            .from(coachClients)
            .where(eq(coachClients.id, clientId))
            .limit(1);

          if (rows[0]) {
            const row = rows[0];
            client = {
              id: row.id,
              coachId: row.coachId,
              clientUserId: row.clientUserId,
              clientName: row.clientName,
              clientEmail: row.clientEmail,
              injuryDiagnosis: row.injuryDiagnosis,
              dischargeDate: row.dischargeDate,
              status: (row.status as 'active' | 'graduated' | 'paused') || 'active',
              complianceScore: Math.round(row.complianceScore ?? 80),
              currentPlan: null,
              lastSession: null,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };
          }
        } catch (dbError) {
          console.warn('coach.client_adherence.db_error', dbError);
        }
      }

      if (!client) {
        return notFound(c, 'Client not found.');
      }

      const telemetry = generateClientAdherenceTelemetry(client);

      return c.json({
        data: telemetry,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load client adherence telemetry.');
    }
  });

  // GET /coach/seats (and /api/v1/coach/seats)
  route.get('/coach/seats', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      let activeLicense: CoachSeatLicenseDto | null = null;
      let inviteList: CoachInviteDto[] = [];

      if (db) {
        try {
          const licenseRows = await db
            .select()
            .from(coachSeatLicenses)
            .where(eq(coachSeatLicenses.coachId, user.id))
            .orderBy(desc(coachSeatLicenses.createdAt))
            .limit(1);

          if (licenseRows[0]) {
            const row = licenseRows[0];
            activeLicense = {
              id: row.id,
              coachId: row.coachId,
              tier: (row.tier as 'starter_5' | 'pro_10' | 'clinic_25') || 'pro_10',
              totalSeats: row.totalSeats,
              usedSeats: row.usedSeats,
              inviteCode: row.inviteCode || 'APEX-PRO-10',
              stripeCheckoutSessionId: row.stripeCheckoutSessionId,
              status: (row.status as 'active' | 'past_due' | 'canceled') || 'active',
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };

            const inviteRows = await db
              .select()
              .from(coachClientInvites)
              .where(eq(coachClientInvites.coachId, user.id))
              .orderBy(desc(coachClientInvites.createdAt));

            inviteList = inviteRows.map((inv) => ({
              id: inv.id,
              licenseId: inv.licenseId || row.id,
              coachId: inv.coachId,
              clientEmail: inv.clientEmail,
              clientName: inv.clientName,
              injuryDiagnosis: null,
              inviteToken: inv.inviteToken,
              inviteUrl: `https://physiocoach.ai/invite/${inv.inviteToken}`,
              status: (inv.status as 'pending' | 'redeemed' | 'revoked') || 'pending',
              redeemedAt: inv.redeemedAt,
              redeemedUserId: inv.redeemedUserId,
              createdAt: inv.createdAt,
              updatedAt: inv.updatedAt,
            }));
          }
        } catch (dbError) {
          console.warn('coach.seats.db_error', dbError);
        }
      }

      if (!activeLicense) {
        // Fallback to in-memory store
        activeLicense = inMemoryCoachLicenses.get(user.id) || DEFAULT_DEMO_LICENSE;
        inviteList = Array.from(inMemoryCoachInvites.values()).filter(
          (inv) => inv.coachId === user.id || inv.coachId === activeLicense?.coachId,
        );
        if (inviteList.length === 0) {
          inviteList = Array.from(inMemoryCoachInvites.values());
        }
      }

      const matchedTier = getWholesaleTierConfig(activeLicense.tier);
      const totalSeats = activeLicense.totalSeats;
      const nonRevokedInvites = inviteList.filter((inv) => inv.status !== 'revoked');
      const usedSeats = nonRevokedInvites.length > 0 ? nonRevokedInvites.length : activeLicense.usedSeats;
      const availableSeats = Math.max(0, totalSeats - usedSeats);

      const responseData: CoachSeatSummaryDto = {
        licenseId: activeLicense.id,
        tier: activeLicense.tier,
        tierName: matchedTier.name,
        priceMonthly: matchedTier.priceMonthly,
        totalSeats,
        usedSeats,
        availableSeats,
        inviteCode: activeLicense.inviteCode,
        status: activeLicense.status,
        invites: inviteList,
        pricingTiers: WHOLESALE_TIERS,
      };

      return c.json({
        data: responseData,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch coach seat licensing information.');
    }
  });

  // POST /coach/seats/checkout (and /api/v1/coach/seats/checkout)
  route.post('/coach/seats/checkout', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, seatCheckoutSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const tierConfig = getWholesaleTierConfig(parsed.data.tier);
      const licenseId = `lic-coach-${crypto.randomUUID().slice(0, 8)}`;
      const sessionId = `cs_test_${crypto.randomUUID().replace(/-/g, '')}`;
      const inviteCode = `PT-${parsed.data.tier.toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newLicense: CoachSeatLicenseDto = {
        id: licenseId,
        coachId: user.id,
        tier: parsed.data.tier,
        totalSeats: tierConfig.seats,
        usedSeats: 0,
        inviteCode,
        stripeCheckoutSessionId: sessionId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      if (db) {
        try {
          await db.insert(coachSeatLicenses).values({
            id: licenseId,
            coachId: user.id,
            tier: parsed.data.tier,
            totalSeats: tierConfig.seats,
            usedSeats: 0,
            inviteCode,
            stripeCheckoutSessionId: sessionId,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          });
        } catch (dbErr) {
          console.warn('coach.seats_checkout.db_error', dbErr);
        }
      }

      inMemoryCoachLicenses.set(user.id, newLicense);

      return c.json(
        {
          success: true,
          checkoutUrl: `https://checkout.stripe.com/c/pay/${sessionId}`,
          sessionId,
          tier: parsed.data.tier,
          tierName: tierConfig.name,
          totalSeats: tierConfig.seats,
          priceMonthly: tierConfig.priceMonthly,
          license: newLicense,
        },
        201,
      );
    } catch (error) {
      return handleRouteError(c, error, 'Failed to initiate wholesale seat checkout.');
    }
  });

  // POST /coach/invites/generate (and /api/v1/coach/invites/generate)
  route.post('/coach/invites/generate', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, generateInviteSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();

      let activeLicense = inMemoryCoachLicenses.get(user.id) || DEFAULT_DEMO_LICENSE;
      let existingInvites = Array.from(inMemoryCoachInvites.values()).filter(
        (inv) => (inv.coachId === user.id || inv.coachId === activeLicense?.coachId) && inv.status !== 'revoked',
      );

      if (db) {
        try {
          const licenseRows = await db
            .select()
            .from(coachSeatLicenses)
            .where(eq(coachSeatLicenses.coachId, user.id))
            .orderBy(desc(coachSeatLicenses.createdAt))
            .limit(1);

          if (licenseRows[0]) {
            const row = licenseRows[0];
            activeLicense = {
              id: row.id,
              coachId: row.coachId,
              tier: (row.tier as 'starter_5' | 'pro_10' | 'clinic_25') || 'pro_10',
              totalSeats: row.totalSeats,
              usedSeats: row.usedSeats,
              inviteCode: row.inviteCode || 'APEX-PRO-10',
              stripeCheckoutSessionId: row.stripeCheckoutSessionId,
              status: 'active',
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };

            const dbInvites = await db
              .select()
              .from(coachClientInvites)
              .where(eq(coachClientInvites.coachId, user.id));

            existingInvites = dbInvites
              .filter((inv) => inv.status !== 'revoked')
              .map((inv) => ({
                id: inv.id,
                licenseId: inv.licenseId || activeLicense.id,
                coachId: inv.coachId,
                clientEmail: inv.clientEmail,
                clientName: inv.clientName,
                inviteToken: inv.inviteToken,
                inviteUrl: `https://physiocoach.ai/invite/${inv.inviteToken}`,
                status: (inv.status as 'pending' | 'redeemed' | 'revoked') || 'pending',
                redeemedAt: inv.redeemedAt,
                redeemedUserId: inv.redeemedUserId,
                createdAt: inv.createdAt,
                updatedAt: inv.updatedAt,
              }));
          }
        } catch (dbErr) {
          console.warn('coach.generate_invite.db_error', dbErr);
        }
      }

      const currentUsed = existingInvites.length;
      if (currentUsed >= activeLicense.totalSeats) {
        return c.json(
          {
            error: 'Seat limit reached. Upgrade your wholesale seat license to invite more clients.',
            totalSeats: activeLicense.totalSeats,
            usedSeats: currentUsed,
            availableSeats: 0,
          },
          409,
        );
      }

      const inviteId = `inv-${crypto.randomUUID().slice(0, 8)}`;
      const inviteToken = `pt-inv-${crypto.randomUUID().slice(0, 8)}`;
      const inviteUrl = `https://physiocoach.ai/invite/${inviteToken}`;

      const newInvite: CoachInviteDto = {
        id: inviteId,
        licenseId: activeLicense.id,
        coachId: user.id,
        clientEmail: parsed.data.clientEmail,
        clientName: parsed.data.clientName,
        injuryDiagnosis: parsed.data.injuryDiagnosis ?? null,
        inviteToken,
        inviteUrl,
        status: 'pending',
        redeemedAt: null,
        redeemedUserId: null,
        createdAt: now,
        updatedAt: now,
      };

      if (db) {
        try {
          await db.insert(coachClientInvites).values({
            id: inviteId,
            licenseId: activeLicense.id,
            coachId: user.id,
            clientEmail: parsed.data.clientEmail,
            clientName: parsed.data.clientName,
            inviteToken,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          });

          await db
            .update(coachSeatLicenses)
            .set({
              usedSeats: currentUsed + 1,
              updatedAt: now,
            })
            .where(eq(coachSeatLicenses.id, activeLicense.id));
        } catch (dbErr) {
          console.warn('coach.generate_invite.insert_db_error', dbErr);
        }
      }

      // Update in-memory
      activeLicense.usedSeats = currentUsed + 1;
      inMemoryCoachLicenses.set(user.id, activeLicense);
      inMemoryCoachInvites.set(inviteId, newInvite);

      const availableSeats = Math.max(0, activeLicense.totalSeats - activeLicense.usedSeats);

      return c.json(
        {
          success: true,
          invite: newInvite,
          totalSeats: activeLicense.totalSeats,
          usedSeats: activeLicense.usedSeats,
          availableSeats,
        },
        201,
      );
    } catch (error) {
      return handleRouteError(c, error, 'Failed to generate patient activation invite.');
    }
  });

  // POST /coach/invites/redeem (and /api/v1/coach/invites/redeem)
  route.post('/coach/invites/redeem', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, redeemInviteSchema);
      if (!parsed.success) return parsed.response;

      const { db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const token = parsed.data.inviteToken.trim();

      let invite: CoachInviteDto | undefined;
      for (const inv of inMemoryCoachInvites.values()) {
        if (inv.inviteToken === token) {
          invite = inv;
          break;
        }
      }

      if (!invite && db) {
        try {
          const rows = await db
            .select()
            .from(coachClientInvites)
            .where(eq(coachClientInvites.inviteToken, token))
            .limit(1);

          if (rows[0]) {
            const r = rows[0];
            invite = {
              id: r.id,
              licenseId: r.licenseId || 'lic-apex-pro-10',
              coachId: r.coachId,
              clientEmail: r.clientEmail,
              clientName: r.clientName,
              inviteToken: r.inviteToken,
              inviteUrl: `https://physiocoach.ai/invite/${r.inviteToken}`,
              status: (r.status as 'pending' | 'redeemed' | 'revoked') || 'pending',
              redeemedAt: r.redeemedAt,
              redeemedUserId: r.redeemedUserId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            };
          }
        } catch (dbErr) {
          console.warn('coach.redeem_invite.db_error', dbErr);
        }
      }

      if (!invite) {
        return notFound(c, 'Invite token not found.');
      }

      if (invite.status === 'redeemed') {
        return c.json(
          {
            error: 'This invite token has already been redeemed.',
            status: invite.status,
            redeemedAt: invite.redeemedAt,
          },
          400,
        );
      }

      if (invite.status === 'revoked') {
        return c.json(
          {
            error: 'This invite token has been revoked by the therapist.',
            status: invite.status,
          },
          400,
        );
      }

      const patientUserId = parsed.data.patientUserId || `usr-${crypto.randomUUID().slice(0, 8)}`;
      const patientName = parsed.data.patientName || invite.clientName;
      const patientEmail = parsed.data.patientEmail || invite.clientEmail;
      const injuryDiagnosis = parsed.data.injuryDiagnosis || invite.injuryDiagnosis || 'Post-Discharge Rehab';

      // Mark invite redeemed
      invite.status = 'redeemed';
      invite.redeemedAt = now;
      invite.redeemedUserId = patientUserId;
      invite.updatedAt = now;

      if (db) {
        try {
          await db
            .update(coachClientInvites)
            .set({
              status: 'redeemed',
              redeemedAt: now,
              redeemedUserId: patientUserId,
              updatedAt: now,
            })
            .where(eq(coachClientInvites.inviteToken, token));
        } catch (dbErr) {
          console.warn('coach.redeem_invite.update_db_error', dbErr);
        }
      }

      inMemoryCoachInvites.set(invite.id, invite);

      // Create linked client in coach roster
      const clientId = `pt-client-${crypto.randomUUID().slice(0, 8)}`;
      const newClient: CoachClientDto = {
        id: clientId,
        coachId: invite.coachId,
        clientUserId: patientUserId,
        clientName: patientName,
        clientEmail: patientEmail,
        injuryDiagnosis,
        dischargeDate: now.slice(0, 10),
        status: 'active',
        complianceScore: 100,
        currentPlan: null,
        lastSession: null,
        createdAt: now,
        updatedAt: now,
      };

      if (db) {
        try {
          await db.insert(coachClients).values({
            id: clientId,
            coachId: invite.coachId,
            clientUserId: patientUserId,
            clientName: patientName,
            clientEmail: patientEmail,
            injuryDiagnosis,
            dischargeDate: now.slice(0, 10),
            status: 'active',
            complianceScore: 100,
            createdAt: now,
            updatedAt: now,
          });
        } catch (dbErr) {
          console.warn('coach.redeem.create_client_db_error', dbErr);
        }
      }

      inMemoryCoachClients.set(clientId, newClient);

      return c.json({
        success: true,
        message: 'Patient invite successfully redeemed and linked to PT coach.',
        coachId: invite.coachId,
        client: newClient,
        invite,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to redeem patient invite token.');
    }
  });

  // POST /coach/invites/revoke (and /api/v1/coach/invites/revoke)
  route.post('/coach/invites/revoke', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, revokeInviteSchema);
      if (!parsed.success) return parsed.response;

      const { db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const inviteId = parsed.data.inviteId;

      let invite = inMemoryCoachInvites.get(inviteId);
      if (!invite) {
        for (const inv of inMemoryCoachInvites.values()) {
          if (inv.id === inviteId || inv.inviteToken === inviteId) {
            invite = inv;
            break;
          }
        }
      }

      if (db) {
        try {
          await db
            .update(coachClientInvites)
            .set({
              status: 'revoked',
              updatedAt: now,
            })
            .where(eq(coachClientInvites.id, inviteId));
        } catch (dbErr) {
          console.warn('coach.revoke_invite.db_error', dbErr);
        }
      }

      if (invite) {
        invite.status = 'revoked';
        invite.updatedAt = now;
        inMemoryCoachInvites.set(invite.id, invite);
      }

      return c.json({
        success: true,
        message: 'Patient activation invite revoked.',
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to revoke patient invite.');
    }
  });

  // GET /coach/messages/:clientId (and /api/v1/coach/messages/:clientId)
  route.get('/coach/messages/:clientId', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const clientId = c.req.param('clientId');
      const url = new URL(c.req.url, 'http://localhost');
      const markRead = url.searchParams.get('markRead') !== 'false';

      let messages: CoachMessageDto[] = [];

      if (db) {
        try {
          const rows = await db
            .select()
            .from(coachMessages)
            .where(eq(coachMessages.clientId, clientId))
            .orderBy(coachMessages.createdAt);

          if (rows.length > 0) {
            messages = rows.map((r) => ({
              id: r.id,
              coachId: r.coachId,
              clientId: r.clientId,
              senderRole: (r.senderRole as 'coach' | 'client') || 'client',
              senderName: r.senderName,
              message: r.message,
              isRead: r.isRead,
              isPainAlert: r.isPainAlert,
              painScore: r.painScore,
              jointRegion: r.jointRegion,
              relatedSessionId: r.relatedSessionId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            }));
          }
        } catch (dbErr) {
          console.warn('coach.get_messages.db_error', dbErr);
        }
      }

      if (messages.length === 0) {
        for (const m of inMemoryCoachMessages.values()) {
          if (m.clientId === clientId) {
            messages.push(m);
          }
        }
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      const unreadCount = messages.filter((m) => !m.isRead && m.senderRole === 'client').length;

      if (markRead && unreadCount > 0) {
        if (db) {
          try {
            await db
              .update(coachMessages)
              .set({ isRead: true, updatedAt: new Date().toISOString() })
              .where(eq(coachMessages.clientId, clientId));
          } catch (dbErr) {
            console.warn('coach.mark_read.db_error', dbErr);
          }
        }
        for (const m of messages) {
          if (m.senderRole === 'client') {
            m.isRead = true;
            inMemoryCoachMessages.set(m.id, m);
          }
        }
      }

      return c.json({
        success: true,
        clientId,
        data: messages,
        unreadCount: markRead ? 0 : unreadCount,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch coach-client messages.');
    }
  });

  // POST /coach/messages (and /api/v1/coach/messages)
  route.post('/coach/messages', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, postCoachMessageSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();
      const messageId = `msg-${crypto.randomUUID().slice(0, 8)}`;
      const senderRole = parsed.data.senderRole || 'coach';
      const isPainAlert = Boolean(
        parsed.data.isPainAlert || (parsed.data.painScore !== null && parsed.data.painScore !== undefined && parsed.data.painScore > 4),
      );

      let senderName = parsed.data.senderName;
      if (!senderName) {
        if (senderRole === 'coach') {
          senderName = user.displayName || 'PT Coach';
        } else {
          const client = inMemoryCoachClients.get(parsed.data.clientId);
          senderName = client?.clientName || 'Patient';
        }
      }
      const finalSenderName: string = senderName || 'PT Coach';

      const messageRecord: CoachMessageDto = {
        id: messageId,
        coachId: user.id,
        clientId: parsed.data.clientId,
        senderRole,
        senderName: finalSenderName,
        message: parsed.data.message,
        isRead: senderRole === 'coach',
        isPainAlert,
        painScore: parsed.data.painScore ?? null,
        jointRegion: parsed.data.jointRegion ?? null,
        relatedSessionId: parsed.data.relatedSessionId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      let createdAlert: CoachPainAlertDto | null = null;
      if (isPainAlert && parsed.data.painScore && parsed.data.painScore > 4) {
        const client = inMemoryCoachClients.get(parsed.data.clientId);
        const alertId = `alert-${crypto.randomUUID().slice(0, 8)}`;
        createdAlert = {
          id: alertId,
          coachId: user.id,
          clientId: parsed.data.clientId,
          clientName: client?.clientName || finalSenderName,
          painScore: parsed.data.painScore,
          jointRegion: parsed.data.jointRegion || 'Joint/Tendon Area',
          exerciseName: parsed.data.exerciseName || null,
          sessionDate: now.slice(0, 10),
          status: 'active',
          clinicalNote: null,
          resolvedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        inMemoryCoachAlerts.set(alertId, createdAlert);

        if (db) {
          try {
            await db.insert(coachPainAlerts).values({
              id: alertId,
              coachId: user.id,
              clientId: parsed.data.clientId,
              clientName: createdAlert.clientName,
              painScore: createdAlert.painScore,
              jointRegion: createdAlert.jointRegion,
              exerciseName: createdAlert.exerciseName,
              sessionDate: createdAlert.sessionDate,
              status: 'active',
              createdAt: now,
              updatedAt: now,
            });
          } catch (dbErr) {
            console.warn('coach.post_message.create_alert_db_error', dbErr);
          }
        }
      }

      if (db) {
        try {
          await db.insert(coachMessages).values({
            id: messageId,
            coachId: user.id,
            clientId: parsed.data.clientId,
            senderRole,
            senderName: finalSenderName,
            message: parsed.data.message,
            isRead: messageRecord.isRead,
            isPainAlert: messageRecord.isPainAlert,
            painScore: messageRecord.painScore,
            jointRegion: messageRecord.jointRegion,
            relatedSessionId: messageRecord.relatedSessionId,
            createdAt: now,
            updatedAt: now,
          });
        } catch (dbErr) {
          console.warn('coach.post_message.insert_db_error', dbErr);
        }
      }

      inMemoryCoachMessages.set(messageId, messageRecord);

      return c.json(
        {
          success: true,
          data: messageRecord,
          alertCreated: Boolean(createdAlert),
          alert: createdAlert,
        },
        201,
      );
    } catch (error) {
      return handleRouteError(c, error, 'Failed to post coach message.');
    }
  });

  // GET /coach/alerts (and /api/v1/coach/alerts)
  route.get('/coach/alerts', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const url = new URL(c.req.url, 'http://localhost');
      const statusFilter = url.searchParams.get('status')?.trim().toLowerCase() || 'active';
      const clientId = url.searchParams.get('clientId')?.trim();

      let alerts: CoachPainAlertDto[] = [];

      if (db) {
        try {
          const rows = await db
            .select()
            .from(coachPainAlerts)
            .where(eq(coachPainAlerts.coachId, user.id))
            .orderBy(desc(coachPainAlerts.createdAt));

          if (rows.length > 0) {
            alerts = rows.map((r) => ({
              id: r.id,
              coachId: r.coachId,
              clientId: r.clientId,
              clientName: r.clientName,
              painScore: r.painScore,
              jointRegion: r.jointRegion,
              exerciseName: r.exerciseName,
              sessionDate: r.sessionDate,
              status: (r.status as 'active' | 'resolved' | 'investigating') || 'active',
              clinicalNote: r.clinicalNote,
              resolvedAt: r.resolvedAt,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            }));
          }
        } catch (dbErr) {
          console.warn('coach.get_alerts.db_error', dbErr);
        }
      }

      if (alerts.length === 0) {
        for (const a of inMemoryCoachAlerts.values()) {
          alerts.push(a);
        }
        alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      if (clientId) {
        alerts = alerts.filter((a) => a.clientId === clientId);
      }

      const totalActive = alerts.filter((a) => a.status === 'active').length;

      if (statusFilter !== 'all') {
        alerts = alerts.filter((a) => a.status === statusFilter);
      }

      return c.json({
        success: true,
        data: alerts,
        totalActive,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch coach pain alerts.');
    }
  });

  // POST /coach/alerts/:id/resolve (and /api/v1/coach/alerts/:id/resolve)
  route.post('/coach/alerts/:id/resolve', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, resolveAlertSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const alertId = c.req.param('id');
      const now = new Date().toISOString();
      const status = parsed.data.status || 'resolved';
      const clinicalNote = parsed.data.clinicalNote || null;
      const directiveMessage = parsed.data.directiveMessage || clinicalNote;

      let alert = inMemoryCoachAlerts.get(alertId);

      if (!alert && db) {
        try {
          const rows = await db
            .select()
            .from(coachPainAlerts)
            .where(eq(coachPainAlerts.id, alertId))
            .limit(1);

          if (rows[0]) {
            const r = rows[0];
            alert = {
              id: r.id,
              coachId: r.coachId,
              clientId: r.clientId,
              clientName: r.clientName,
              painScore: r.painScore,
              jointRegion: r.jointRegion,
              exerciseName: r.exerciseName,
              sessionDate: r.sessionDate,
              status: (r.status as 'active' | 'resolved' | 'investigating') || 'active',
              clinicalNote: r.clinicalNote,
              resolvedAt: r.resolvedAt,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            };
          }
        } catch (dbErr) {
          console.warn('coach.resolve_alert.db_read_error', dbErr);
        }
      }

      if (!alert) {
        return notFound(c, 'Pain alert not found.');
      }

      alert.status = status;
      alert.clinicalNote = clinicalNote;
      alert.resolvedAt = status === 'resolved' ? now : null;
      alert.updatedAt = now;

      if (db) {
        try {
          await db
            .update(coachPainAlerts)
            .set({
              status,
              clinicalNote,
              resolvedAt: alert.resolvedAt,
              updatedAt: now,
            })
            .where(eq(coachPainAlerts.id, alertId));
        } catch (dbErr) {
          console.warn('coach.resolve_alert.db_update_error', dbErr);
        }
      }

      inMemoryCoachAlerts.set(alertId, alert);

      let sentMessage: CoachMessageDto | null = null;
      if (parsed.data.sendFeedbackMessage && directiveMessage) {
        const msgId = `msg-${crypto.randomUUID().slice(0, 8)}`;
        sentMessage = {
          id: msgId,
          coachId: user.id,
          clientId: alert.clientId,
          senderRole: 'coach',
          senderName: user.displayName || 'PT Coach',
          message: `[Clinical Directive] ${directiveMessage}`,
          isRead: false,
          isPainAlert: false,
          painScore: null,
          jointRegion: alert.jointRegion,
          relatedSessionId: null,
          createdAt: now,
          updatedAt: now,
        };

        inMemoryCoachMessages.set(msgId, sentMessage);

        if (db) {
          try {
            await db.insert(coachMessages).values({
              id: msgId,
              coachId: user.id,
              clientId: alert.clientId,
              senderRole: 'coach',
              senderName: sentMessage.senderName,
              message: sentMessage.message,
              isRead: false,
              isPainAlert: false,
              jointRegion: alert.jointRegion,
              createdAt: now,
              updatedAt: now,
            });
          } catch (dbErr) {
            console.warn('coach.resolve_alert.post_message_db_error', dbErr);
          }
        }
      }

      return c.json({
        success: true,
        message: 'Pain alert directive updated and resolved.',
        alert,
        sentMessage,
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to resolve coach pain alert.');
    }
  });

  return route;
}

export const coachRouter = createCoachRoutes();
