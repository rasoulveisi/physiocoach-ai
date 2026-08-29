import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  CornerDownRight,
  CreditCard,
  Dumbbell,
  ExternalLink,
  Filter,
  Flame,
  HeartPulse,
  Key,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Ticket,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { apiClient } from '../services/api-client';

export interface CoachMessage {
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

export interface CoachPainAlert {
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

export const CLINICAL_DIRECTIVE_TEMPLATES = [
  {
    label: 'Tendon Deload Protocol',
    directive: 'Apply Tendon Deload Protocol: Cease dynamic eccentric loading immediately. Perform 5 sets of 45-second isometric holds at 60° joint angle. Deload volume by 40% for 48 hours.',
  },
  {
    label: 'Switch to Isometric Hold',
    directive: 'Switch to Pain-Relieving Isometric Holds: Replace compound heavy sets with static isometric contraction (3-4 sets of 30-45s, RPE <= 5) to modulate tendon pain without adding shear stress.',
  },
  {
    label: 'Rest 48h & Active Recovery',
    directive: 'Active Recovery & 48h Deload: Discontinue provocative loading for 48 hours. Focus on light non-weightbearing mobility and gentle tissue flush. Resume only when morning stiffness is < 2/10.',
  },
  {
    label: 'Reduce Load 30% & Cap RPE 6',
    directive: 'Load Regulation Directive: Reduce working weight by 30% and cap intensity at RPE 6. Focus on controlled 3-second concentric tempo without ballistic acceleration.',
  },
  {
    label: 'Progress to Isotonic Phase',
    directive: 'Progression Cleared: Pain tolerance is verified. Progress from isometric holds to controlled tempo isotonic loading with 3-second lowering phase.',
  },
];

export interface CoachClient {
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
    clinicalNotes?: string | null;
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

export interface CoachStats {
  totalPatients: number;
  activePatients: number;
  adherenceRate: number;
  painAlertsCount: number;
  graduatedCount: number;
  clinicName: string;
}

export interface CoachInvite {
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

export interface WholesaleTier {
  tier: 'starter_5' | 'pro_10' | 'clinic_25';
  name: string;
  seats: number;
  priceMonthly: number;
  pricePerSeat: number;
  badge?: string;
  features: string[];
}

export interface CoachSeatSummary {
  licenseId: string;
  tier: 'starter_5' | 'pro_10' | 'clinic_25';
  tierName: string;
  priceMonthly: number;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  inviteCode: string;
  status: 'active' | 'past_due' | 'canceled';
  invites: CoachInvite[];
  pricingTiers: WholesaleTier[];
}

export interface AdherenceTelemetry {
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

const COMMON_DIAGNOSES = [
  'Patellar Tendinopathy (Right)',
  'Post-Op ACL Reconstruction (Left)',
  'Lumbar Disc Herniation (L5-S1)',
  'Subacromial Shoulder Impingement',
  'Achilles Tendinopathy (Insertional)',
  'Post-Op Meniscus Repair (Lateral)',
  'Rotator Cuff Supraspinatus Strain',
  'Cervical Spine Radiculopathy',
  'Plantar Fasciitis',
  'Hamstring Proximal Tendinopathy',
];

const CLINICAL_REHAB_TEMPLATES = [
  {
    id: 'plan-patellar-hsr',
    title: 'Patellar Tendon Heavy Slow Resistance (HSR)',
    focus: 'Knee Extensor Load & Isometric Tendon Remodeling',
    days: 3,
    notes: 'Keep RPE <= 7. 3-second eccentric tempo. Stop set immediately if sharp anterior knee pain > 3/10 occurs.',
  },
  {
    id: 'plan-acl-return-sport',
    title: 'ACL Return-to-Sport Phase 3 (Rotational & Plyo)',
    focus: 'Dynamic Quad Symmetry, Valgus Control & Deceleration',
    days: 4,
    notes: 'Ensure limb symmetry index > 90%. Focus on soft, hip-dominant landings on all jump-downs.',
  },
  {
    id: 'plan-lumbar-mcgill',
    title: 'Spine-Safe Core & Hip Hinge Protocol',
    focus: 'Neutral Spine Stability & Posterior Chain Loading',
    days: 3,
    notes: 'McGill Big 3 daily. Zero spinal flexion under load. Neutral spine Romanian deadlifts only.',
  },
  {
    id: 'plan-shoulder-cuff',
    title: 'Rotator Cuff & Scapular Stability Protocol',
    focus: 'Subacromial Decompression & Serratus Anterior Activation',
    days: 3,
    notes: 'Neutral grip pressing only. High-volume face pulls with external rotation at peak contraction.',
  },
  {
    id: 'plan-achilles-soleus',
    title: 'Isometric Soleus & Flat-Surface Calf Loading',
    focus: 'Achilles Tendon Capacity & Plantarflexion Strength',
    days: 3,
    notes: 'Avoid dorsiflexion below neutral until insertional tenderness resolves.',
  },
  {
    id: 'plan-desk-worker-posture',
    title: 'Desk Worker Postural & Thoracic Decompression',
    focus: 'Thoracic Extension, Upper Back Tone & Glute Drive',
    days: 3,
    notes: '2:1 pull-to-push volume ratio. Emphasis on thoracic mobilization before compound rows.',
  },
];

export function CoachDashboardPage() {
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [seatsSummary, setSeatsSummary] = useState<CoachSeatSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'graduated' | 'paused'>('all');
  const [activeViewTab, setActiveViewTab] = useState<'roster' | 'seats'>('roster');
  const [inviteFilter, setInviteFilter] = useState<'all' | 'pending' | 'redeemed' | 'revoked'>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modals & Drawer State
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isAssignPlanOpen, setIsAssignPlanOpen] = useState(false);
  const [isPurchaseSeatsOpen, setIsPurchaseSeatsOpen] = useState(false);
  const [isGenerateInviteOpen, setIsGenerateInviteOpen] = useState(false);
  const [selectedClientForAssign, setSelectedClientForAssign] = useState<CoachClient | null>(null);
  const [selectedClientForDrawer, setSelectedClientForDrawer] = useState<CoachClient | null>(null);
  const [telemetryData, setTelemetryData] = useState<AdherenceTelemetry | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Pain Alerts State
  const [alerts, setAlerts] = useState<CoachPainAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [selectedAlertForReview, setSelectedAlertForReview] = useState<CoachPainAlert | null>(null);
  const [alertDirectiveNote, setAlertDirectiveNote] = useState('');
  const [sendDirectiveToChat, setSendDirectiveToChat] = useState(true);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // Async Messaging Drawer State
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [selectedClientForMessaging, setSelectedClientForMessaging] = useState<CoachClient | null>(null);
  const [chatMessages, setChatMessages] = useState<CoachMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);

  // Form States - Add Patient
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [newPatientDiagnosis, setNewPatientDiagnosis] = useState('');
  const [newPatientDischargeDate, setNewPatientDischargeDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPatientNotes, setNewPatientNotes] = useState('');
  const [selectedTemplateForNewPatient, setSelectedTemplateForNewPatient] = useState(CLINICAL_REHAB_TEMPLATES[0].id);
  const [isSubmittingPatient, setIsSubmittingPatient] = useState(false);

  // Form States - Assign Plan
  const [selectedPlanTemplateId, setSelectedPlanTemplateId] = useState(CLINICAL_REHAB_TEMPLATES[0].id);
  const [assignClinicalNotes, setAssignClinicalNotes] = useState(CLINICAL_REHAB_TEMPLATES[0].notes);
  const [assignFrequencyDays, setAssignFrequencyDays] = useState(3);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Form States - Seat Wholesale Purchase
  const [selectedWholesaleTier, setSelectedWholesaleTier] = useState<'starter_5' | 'pro_10' | 'clinic_25'>('pro_10');
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Form States - Generate Patient Invite
  const [inviteClientName, setInviteClientName] = useState('');
  const [inviteClientEmail, setInviteClientEmail] = useState('');
  const [inviteDiagnosis, setInviteDiagnosis] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [newlyGeneratedInvite, setNewlyGeneratedInvite] = useState<CoachInvite | null>(null);

  // Load clients & stats
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>('coach/clients');
      const rootData = res?.data || res;
      const clientList = Array.isArray(rootData) ? rootData : (rootData?.data || []);
      setClients(clientList);

      if (res?.stats) {
        setStats(res.stats);
      } else {
        const total = clientList.length;
        const active = clientList.filter((c: CoachClient) => c.status === 'active').length;
        const graduated = clientList.filter((c: CoachClient) => c.status === 'graduated').length;
        const painAlerts = clientList.filter(
          (c: CoachClient) => (c.lastSession?.painScore ?? 0) >= 3 || c.complianceScore < 60,
        ).length;
        const avgCompliance =
          total > 0
            ? Math.round(
                clientList.reduce((sum: number, c: CoachClient) => sum + (c.complianceScore || 0), 0) / total,
              )
            : 88;

        setStats({
          totalPatients: total,
          activePatients: active,
          adherenceRate: avgCompliance,
          painAlertsCount: painAlerts,
          graduatedCount: graduated,
          clinicName: 'Apex Physical Therapy & Sports Rehab',
        });
      }
    } catch (error) {
      console.warn('Failed to load coach clients from API, using fallback', error);
    } finally {
      setLoading(false);
    }
  };

  // Load seat licensing telemetry
  const fetchSeatsData = async () => {
    try {
      setLoadingSeats(true);
      const res = await apiClient.get<any>('coach/seats');
      const rootData = res?.data || res;
      if (rootData) {
        setSeatsSummary(rootData);
      }
    } catch (error) {
      console.warn('Failed to load coach seat licensing info', error);
    } finally {
      setLoadingSeats(false);
    }
  };

  // Load pain alerts
  const fetchAlertsData = async () => {
    try {
      setLoadingAlerts(true);
      const res = await apiClient.get<any>('coach/alerts?status=active');
      const rootData = res?.data || res;
      const alertList = Array.isArray(rootData) ? rootData : (rootData?.data || []);
      setAlerts(alertList);
    } catch (error) {
      console.warn('Failed to load coach pain alerts', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchSeatsData();
    fetchAlertsData();
  }, []);

  // Open Pain Alert Review Modal
  const openAlertTriage = (alert: CoachPainAlert) => {
    setSelectedAlertForReview(alert);
    setAlertDirectiveNote(CLINICAL_DIRECTIVE_TEMPLATES[0].directive);
    setSendDirectiveToChat(true);
  };

  // Submit Alert Resolution
  const handleResolveAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForReview) return;
    setIsSubmittingResolve(true);
    try {
      const res = await apiClient.post<any>(`coach/alerts/${selectedAlertForReview.id}/resolve`, {
        status: 'resolved',
        clinicalNote: alertDirectiveNote.trim() || 'Reviewed by Physical Therapist with load adjustments.',
        sendFeedbackMessage: sendDirectiveToChat,
        directiveMessage: alertDirectiveNote.trim(),
      });

      if (res?.success) {
        setToastMessage({
          text: `Pain alert for ${selectedAlertForReview.clientName} resolved and directive transmitted.`,
          type: 'success',
        });
        setSelectedAlertForReview(null);
        fetchAlertsData();
        fetchDashboardData();
      }
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to resolve pain alert.',
        type: 'error',
      });
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Open Async Messaging Drawer
  const openMessagingDrawer = async (client: CoachClient) => {
    setSelectedClientForMessaging(client);
    setIsMessagingOpen(true);
    setLoadingMessages(true);
    try {
      const res = await apiClient.get<any>(`coach/messages/${client.id}?markRead=true`);
      const rootData = res?.data || res;
      const msgs = Array.isArray(rootData) ? rootData : (rootData?.data || []);
      setChatMessages(msgs);
    } catch (error) {
      console.warn('Failed to load chat messages', error);
      setChatMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedClientForMessaging || !newChatMessage.trim()) return;

    const msgText = newChatMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: CoachMessage = {
      id: tempId,
      coachId: selectedClientForMessaging.coachId,
      clientId: selectedClientForMessaging.id,
      senderRole: 'coach',
      senderName: 'Dr. Alex Vance, DPT',
      message: msgText,
      isRead: true,
      isPainAlert: false,
      painScore: null,
      jointRegion: null,
      relatedSessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setNewChatMessage('');
    setIsSubmittingMessage(true);

    try {
      const res = await apiClient.post<any>('coach/messages', {
        clientId: selectedClientForMessaging.id,
        message: msgText,
        senderRole: 'coach',
        senderName: 'Dr. Alex Vance, DPT',
      });

      if (res?.success && res?.data) {
        setChatMessages((prev) => prev.map((m) => (m.id === tempId ? res.data : m)));
      }
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to send message.',
        type: 'error',
      });
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  // Fetch telemetry when drawer opens
  const openPatientDrawer = async (client: CoachClient) => {
    setSelectedClientForDrawer(client);
    setLoadingTelemetry(true);
    try {
      const res = await apiClient.get<any>(`coach/clients/${client.id}/adherence`);
      const tele = res?.data || res;
      setTelemetryData(tele);
    } catch {
      setTelemetryData(null);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  // Open assign plan modal
  const openAssignModal = (client: CoachClient) => {
    setSelectedClientForAssign(client);
    const matched = CLINICAL_REHAB_TEMPLATES.find((t) =>
      client.injuryDiagnosis.toLowerCase().includes(t.title.toLowerCase().split(' ')[0]),
    );
    const chosen = matched || CLINICAL_REHAB_TEMPLATES[0];
    setSelectedPlanTemplateId(chosen.id);
    setAssignClinicalNotes(chosen.notes);
    setAssignFrequencyDays(chosen.days);
    setIsAssignPlanOpen(true);
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesStatus =
        statusFilter === 'all' ? true : client.status.toLowerCase() === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        client.clientName.toLowerCase().includes(q) ||
        client.injuryDiagnosis.toLowerCase().includes(q) ||
        client.clientEmail.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [clients, statusFilter, searchQuery]);

  // Filter invites
  const filteredInvites = useMemo(() => {
    const list = seatsSummary?.invites || [];
    return list.filter((inv) => {
      const matchesStatus =
        inviteFilter === 'all' ? true : inv.status.toLowerCase() === inviteFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        inv.inviteToken.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [seatsSummary, inviteFilter, searchQuery]);

  // Copy helper
  const handleCopyText = async (text: string, identifier: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedToken(identifier);
      setToastMessage({ text: 'Link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      setToastMessage({ text: 'Failed to copy to clipboard.', type: 'error' });
    }
  };

  // Handle Add Patient Submission
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newPatientEmail.trim() || !newPatientDiagnosis.trim()) {
      setToastMessage({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setIsSubmittingPatient(true);
    try {
      const template = CLINICAL_REHAB_TEMPLATES.find((t) => t.id === selectedTemplateForNewPatient);
      const payload = {
        clientName: newPatientName.trim(),
        clientEmail: newPatientEmail.trim(),
        injuryDiagnosis: newPatientDiagnosis.trim(),
        dischargeDate: newPatientDischargeDate,
        status: 'active',
        complianceScore: 100,
        clinicalNotes: newPatientNotes.trim() || template?.notes || null,
        assignedPlanId: template?.id || null,
        assignedPlanTitle: template?.title || null,
      };

      const res = await apiClient.post<any>('coach/clients', payload);
      const created = res?.data || res;

      setClients((prev) => [created, ...prev]);
      setToastMessage({
        text: `Patient ${created.clientName} enrolled successfully.`,
        type: 'success',
      });
      setIsAddPatientOpen(false);
      setNewPatientName('');
      setNewPatientEmail('');
      setNewPatientDiagnosis('');
      setNewPatientNotes('');
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to enroll patient.',
        type: 'error',
      });
    } finally {
      setIsSubmittingPatient(false);
    }
  };

  // Handle Assign Plan Submission
  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForAssign) return;

    setIsSubmittingAssign(true);
    try {
      const template = CLINICAL_REHAB_TEMPLATES.find((t) => t.id === selectedPlanTemplateId);
      const payload = {
        clientId: selectedClientForAssign.id,
        workoutPlanId: selectedPlanTemplateId,
        planTitle: template?.title || 'Prescribed Rehab Protocol',
        clinicalNotes: assignClinicalNotes.trim() || null,
        targetFrequencyDays: assignFrequencyDays,
      };

      await apiClient.post('coach/clients/assign-plan', payload);

      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClientForAssign.id
            ? {
                ...c,
                currentPlan: {
                  id: selectedPlanTemplateId,
                  title: template?.title || 'Prescribed Rehab Protocol',
                  assignedAt: new Date().toISOString(),
                  clinicalNotes: assignClinicalNotes,
                },
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );

      setToastMessage({
        text: `Prescribed "${template?.title}" to ${selectedClientForAssign.clientName}.`,
        type: 'success',
      });
      setIsAssignPlanOpen(false);

      if (selectedClientForDrawer?.id === selectedClientForAssign.id) {
        openPatientDrawer({
          ...selectedClientForAssign,
          currentPlan: {
            id: selectedPlanTemplateId,
            title: template?.title || 'Prescribed Rehab Protocol',
            assignedAt: new Date().toISOString(),
            clinicalNotes: assignClinicalNotes,
          },
        });
      }
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to assign plan.',
        type: 'error',
      });
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Handle Purchase Seats Checkout
  const handlePurchaseSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPurchase(true);
    try {
      const res = await apiClient.post<any>('coach/seats/checkout', {
        tier: selectedWholesaleTier,
      });

      if (res?.success) {
        setToastMessage({
          text: `Wholesale ${res.tierName || selectedWholesaleTier} activated (${res.totalSeats} seats allocated).`,
          type: 'success',
        });
        setIsPurchaseSeatsOpen(false);
        fetchSeatsData();
      }
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to initiate seat upgrade.',
        type: 'error',
      });
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Handle Generate Patient Invite
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteClientName.trim() || !inviteClientEmail.trim()) {
      setToastMessage({ text: 'Client name and email are required.', type: 'error' });
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await apiClient.post<any>('coach/invites/generate', {
        clientName: inviteClientName.trim(),
        clientEmail: inviteClientEmail.trim(),
        injuryDiagnosis: inviteDiagnosis.trim() || 'Post-Discharge Rehab',
      });

      if (res?.success && res.invite) {
        setNewlyGeneratedInvite(res.invite);
        setToastMessage({
          text: `Generated invite for ${res.invite.clientName}.`,
          type: 'success',
        });
        fetchSeatsData();
      }
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to generate patient invite link.',
        type: 'error',
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handle Revoke Invite
  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this patient activation link?')) return;
    try {
      await apiClient.post('coach/invites/revoke', { inviteId });
      setToastMessage({ text: 'Invite revoked.', type: 'success' });
      fetchSeatsData();
    } catch (error) {
      setToastMessage({
        text: error instanceof Error ? error.message : 'Failed to revoke invite.',
        type: 'error',
      });
    }
  };

  const getStatusBadge = (status: 'active' | 'graduated' | 'paused') => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-extrabold text-lime-400">
            <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
            Active Rehab
          </span>
        );
      case 'graduated':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-extrabold text-cyan-400">
            <CheckCircle2 className="size-3" />
            Graduated
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400">
            <AlertTriangle className="size-3" />
            Paused
          </span>
        );
    }
  };

  const getInviteStatusBadge = (status: 'pending' | 'redeemed' | 'revoked') => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Activation
          </span>
        );
      case 'redeemed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-extrabold text-lime-400">
            <CheckCircle2 className="size-3" />
            Redeemed & Linked
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-extrabold text-zinc-400">
            <X className="size-3" />
            Revoked
          </span>
        );
    }
  };

  const seatPct = useMemo(() => {
    if (!seatsSummary || seatsSummary.totalSeats === 0) return 60;
    return Math.min(100, Math.round((seatsSummary.usedSeats / seatsSummary.totalSeats) * 100));
  }, [seatsSummary]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#090D15] text-slate-100 selection:bg-lime-400 selection:text-zinc-950">
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        {/* Toast Alert */}
      {toastMessage && (
        <Toast
          type={toastMessage.type}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Top Clinic Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-lime-400 text-zinc-950 font-black shadow-sm">
              <UserCheck className="h-5 w-5 stroke-[2.5]" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Physical Therapist Portal
              </h1>
              <p className="text-xs font-bold text-zinc-400">
                {stats?.clinicName || 'Apex Physical Therapy & Sports Rehab'} · Remote Monitoring & Protocol Management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            pill={true}
            onClick={() => {
              setNewlyGeneratedInvite(null);
              setIsGenerateInviteOpen(true);
            }}
            className="text-xs sm:text-sm font-extrabold border-zinc-700 bg-zinc-900/60"
          >
            <UserPlus className="h-4 w-4 text-lime-400 mr-1" />
            Invite Client
          </Button>
          <Button
            variant="volt"
            size="md"
            pill={true}
            onClick={() => setIsAddPatientOpen(true)}
            className="shadow-lg shadow-lime-400/10 text-xs sm:text-sm font-extrabold"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            Enroll Patient
          </Button>
        </div>
      </header>

      {/* HIGH-PRIORITY PAIN ALERT BANNER */}
      {alerts && alerts.length > 0 && (
        <section className="rounded-3xl border-2 border-red-500/80 bg-gradient-to-r from-red-950/90 via-[#180d14] to-[#121722] p-5 sm:p-6 shadow-2xl shadow-red-950/40 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0 mt-1">
                <span className="grid size-12 place-items-center rounded-2xl bg-red-600 text-white font-black shadow-lg shadow-red-600/50">
                  <ShieldAlert className="size-6 stroke-[2.5]" />
                </span>
                <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-amber-400 ring-4 ring-[#180d14] animate-ping" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-red-400 bg-red-500/20 px-2.5 py-0.5 text-[11px] font-mono font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-red-400 animate-ping" />
                    PAIN ALERT ({alerts.length} ACTIVE)
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-400">
                    Clinical Review & Directive Needed
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-black text-white">
                  {alerts[0].clientName} reported pain spike ({alerts[0].painScore}/10)
                </h2>

                <p className="text-xs text-zinc-300 font-medium flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300 font-bold">
                    {alerts[0].jointRegion}
                  </span>
                  {alerts[0].exerciseName && (
                    <span className="text-zinc-400">
                      during <strong className="text-white">{alerts[0].exerciseName}</strong>
                    </span>
                  )}
                  <span className="text-zinc-500 font-mono text-[11px]">· {alerts[0].sessionDate}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="danger"
                size="md"
                pill={true}
                onClick={() => openAlertTriage(alerts[0])}
                className="bg-red-600 hover:bg-red-500 text-white font-black shadow-lg shadow-red-600/30 px-6 py-2.5 text-xs sm:text-sm"
              >
                <Sparkles className="size-4 mr-1.5" />
                Review & Triage Alert
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* SEAT LICENSING & WHOLESALE HUD */}
      <section className="rounded-3xl border border-zinc-800 bg-[#121722] p-5 sm:p-6 space-y-5 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-lime-400/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-zinc-800/80 pb-5">
          {/* Active License Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
                <Ticket className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {seatsSummary?.tierName || 'Pro 10-Seat Tier'}
                  </h2>
                  <span className="rounded-md border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400">
                    ${seatsSummary?.priceMonthly ?? 89}/mo Wholesale
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-extrabold text-lime-400 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                    <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
                    Active License
                  </span>
                </div>
                <p className="text-xs font-medium text-zinc-400 mt-0.5">
                  Wholesale seat licensing and patient activation management.
                </p>
              </div>
            </div>
          </div>

          {/* Master Clinic Invite Code & Quick CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Click to copy master clinic code */}
            <div className="flex items-center rounded-xl border border-zinc-700/80 bg-[#090D15] p-1.5 pl-3">
              <div className="flex items-center gap-2 mr-3">
                <Key className="h-3.5 w-3.5 text-zinc-400" />
                <div className="text-left">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Clinic Code</p>
                  <p className="text-xs font-mono font-black text-lime-400">
                    {seatsSummary?.inviteCode || 'APEX-PRO-10'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                pill={true}
                onClick={() =>
                  handleCopyText(seatsSummary?.inviteCode || 'APEX-PRO-10', 'master-clinic-code')
                }
                className="text-[11px] h-7 px-2.5"
              >
                {copiedToken === 'master-clinic-code' ? (
                  <Check className="h-3.5 w-3.5 text-lime-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              pill={true}
              onClick={() => setIsPurchaseSeatsOpen(true)}
              className="text-xs font-black border-lime-400/30 text-lime-400 hover:bg-lime-400/10"
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Upgrade / Add Seats
            </Button>
          </div>
        </div>

        {/* Seat Capacity Meter HUD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-[#090D15] p-4.5 rounded-2xl border border-zinc-800/80">
          {/* Capacity Numbers */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono tabular-nums">
                {seatsSummary?.usedSeats ?? 6}
              </span>
              <span className="text-lg font-mono font-bold text-zinc-500">
                / {seatsSummary?.totalSeats ?? 10}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 ml-1">
                Seats Utilized
              </span>
            </div>
            <p className="text-xs font-bold text-lime-400 font-mono">
              {seatsSummary?.availableSeats ?? 4} patient seats available to allocate
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-400">
              <span>Capacity Allocation</span>
              <span className="text-white font-black">{seatPct}% Utilized</span>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  seatPct >= 90
                    ? 'bg-amber-400'
                    : seatPct >= 75
                      ? 'bg-cyan-400'
                      : 'bg-lime-400'
                }`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
              <span>0 Seats</span>
              <span>Wholesale Margin: ~65% profit per enrolled client</span>
              <span>{seatsSummary?.totalSeats ?? 10} Seats</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Clinic Macro Metric HUD Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Patients */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Patients</span>
            <span className="grid size-8 place-items-center rounded-xl bg-lime-400/10 text-lime-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white tabular-nums font-mono">
              {stats?.totalPatients ?? clients.length}
            </span>
            <span className="text-xs font-bold text-zinc-500">enrolled</span>
          </div>
          <p className="mt-1 text-[11px] font-bold text-lime-400/90">
            {stats?.activePatients ?? clients.filter((c) => c.status === 'active').length} active in rehab
          </p>
        </div>

        {/* Adherence Rate */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Adherence Rate</span>
            <span className="grid size-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-400">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400 tabular-nums font-mono">
              {stats?.adherenceRate ?? 88}%
            </span>
            <span className="text-xs font-bold text-zinc-500">weekly avg</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${stats?.adherenceRate ?? 88}%` }}
            />
          </div>
        </div>

        {/* Pain Alerts */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pain Alerts</span>
            <span className="grid size-8 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums font-mono">
              {stats?.painAlertsCount ?? 2}
            </span>
            <span className="text-xs font-bold text-zinc-500">active flags</span>
          </div>
          <p className="mt-1 text-[11px] font-bold text-amber-400/90">
            Pain rating ≥ 3/10 or missed split
          </p>
        </div>

        {/* Graduated */}
        <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Graduated</span>
            <span className="grid size-8 place-items-center rounded-xl bg-lime-400/10 text-lime-400">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white tabular-nums font-mono">
              {stats?.graduatedCount ?? 1}
            </span>
            <span className="text-xs font-bold text-zinc-500">patients</span>
          </div>
          <p className="mt-1 text-[11px] font-bold text-lime-400">
            Discharged to general fitness
          </p>
        </div>
      </section>

      {/* Main Section: Tabbed Switcher between Patient Roster & Seat Licensing Invites */}
      <section className="rounded-3xl border border-zinc-800 bg-[#121722] overflow-hidden shadow-xl">
        {/* Navigation Tabs Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#181F2E]/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab('roster')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                activeViewTab === 'roster'
                  ? 'bg-lime-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Active Patients Roster</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  activeViewTab === 'roster' ? 'bg-zinc-950 text-lime-400' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {clients.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('seats')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                activeViewTab === 'seats'
                  ? 'bg-lime-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              <span>Seat Invites & Codes</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  activeViewTab === 'seats' ? 'bg-zinc-950 text-lime-400' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {seatsSummary?.invites.length ?? 6}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder={
                activeViewTab === 'roster'
                  ? 'Search by name, diagnosis, email…'
                  : 'Search by client name, email, token…'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-800 bg-[#090D15] pl-9 pr-4 text-xs font-medium text-white placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: Patient Roster Table */}
        {activeViewTab === 'roster' && (
          <div>
            {/* Status Tabs Filter */}
            <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Patients', count: clients.length },
                  {
                    id: 'active',
                    label: 'Active',
                    count: clients.filter((c) => c.status === 'active').length,
                  },
                  {
                    id: 'graduated',
                    label: 'Graduated',
                    count: clients.filter((c) => c.status === 'graduated').length,
                  },
                  {
                    id: 'paused',
                    label: 'Paused',
                    count: clients.filter((c) => c.status === 'paused').length,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-zinc-800 text-lime-400 border border-lime-400/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] font-mono text-zinc-500">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-zinc-500 font-medium">
                  <span className="inline-block animate-spin mr-2">⚙️</span> Loading patient roster…
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <p className="text-zinc-400 font-bold">No patients matching filter.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    pill={true}
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-4 sm:px-6">Patient Identity</th>
                      <th className="py-3.5 px-4">Diagnosis & Region</th>
                      <th className="py-3.5 px-4 text-center">Compliance</th>
                      <th className="py-3.5 px-4">Current Routine</th>
                      <th className="py-3.5 px-4">Last Session</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredClients.map((client) => {
                      const initials = client.clientName
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr
                          key={client.id}
                          className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                          onClick={() => openPatientDrawer(client)}
                        >
                          {/* Identity */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="grid size-9 place-items-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-black text-lime-400">
                                {initials}
                              </div>
                              <div>
                                <p className="font-extrabold text-white group-hover:text-lime-400 transition-colors">
                                  {client.clientName}
                                </p>
                                <p className="text-[11px] font-mono text-zinc-400">{client.clientEmail}</p>
                              </div>
                            </div>
                          </td>

                          {/* Diagnosis */}
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#090D15] px-2.5 py-1 text-xs font-bold text-zinc-200">
                              {client.injuryDiagnosis}
                            </span>
                          </td>

                          {/* Compliance Progress Score */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-mono text-sm font-black tabular-nums ${
                                  client.complianceScore >= 85
                                    ? 'text-lime-400'
                                    : client.complianceScore >= 70
                                      ? 'text-cyan-400'
                                      : 'text-amber-400'
                                }`}
                              >
                                {client.complianceScore}%
                              </span>
                              <span className="text-[9px] font-mono uppercase text-zinc-500">Adherence</span>
                            </div>
                          </td>

                          {/* Current Routine */}
                          <td className="py-4 px-4 max-w-[220px]">
                            {client.currentPlan ? (
                              <div>
                                <p className="truncate font-bold text-zinc-200" title={client.currentPlan.title}>
                                  {client.currentPlan.title}
                                </p>
                                <p className="text-[10px] font-mono text-zinc-500">
                                  Assigned {new Date(client.currentPlan.assignedAt).toLocaleDateString()}
                                </p>
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic text-[11px]">No routine prescribed</span>
                            )}
                          </td>

                          {/* Last Session Telemetry */}
                          <td className="py-4 px-4">
                            {client.lastSession ? (
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-zinc-300">
                                  {client.lastSession.relativeText}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-mono">
                                  <span className="text-zinc-400">RPE {client.lastSession.avgRpe}</span>
                                  <span
                                    className={`rounded px-1 font-bold ${
                                      client.lastSession.painScore >= 3
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    Pain {client.lastSession.painScore}/10
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">Pending first log</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4">{getStatusBadge(client.status)}</td>

                          {/* Action buttons */}
                          <td className="py-4 px-4 sm:px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="xs"
                                pill={true}
                                onClick={() => openMessagingDrawer(client)}
                                className="text-[11px] border-zinc-700 hover:border-lime-400/60"
                                title="Open Async Messaging Chat"
                              >
                                <MessageSquare className="h-3 w-3 text-lime-400 mr-1" />
                                Chat
                              </Button>
                              <Button
                                variant="outline"
                                size="xs"
                                pill={true}
                                onClick={() => openAssignModal(client)}
                                className="text-[11px]"
                              >
                                Prescribe
                              </Button>
                              <Button
                                variant="secondary"
                                size="xs"
                                pill={true}
                                onClick={() => openPatientDrawer(client)}
                                className="text-[11px]"
                              >
                                Telemetry
                                <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Seat Licensing & Invites Management Roster */}
        {activeViewTab === 'seats' && (
          <div>
            {/* Status Tabs Filter */}
            <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All Invites', count: seatsSummary?.invites.length ?? 0 },
                    {
                      id: 'pending',
                      label: 'Pending',
                      count: seatsSummary?.invites.filter((i) => i.status === 'pending').length ?? 0,
                    },
                    {
                      id: 'redeemed',
                      label: 'Redeemed',
                      count: seatsSummary?.invites.filter((i) => i.status === 'redeemed').length ?? 0,
                    },
                    {
                      id: 'revoked',
                      label: 'Revoked',
                      count: seatsSummary?.invites.filter((i) => i.status === 'revoked').length ?? 0,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInviteFilter(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      inviteFilter === tab.id
                        ? 'bg-zinc-800 text-lime-400 border border-lime-400/30'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500">({tab.count})</span>
                  </button>
                ))}
              </div>

              <Button
                variant="volt"
                size="xs"
                pill={true}
                onClick={() => {
                  setNewlyGeneratedInvite(null);
                  setIsGenerateInviteOpen(true);
                }}
                className="text-xs font-black shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Generate New Invite Link
              </Button>
            </div>

            {/* Invites Roster Table */}
            <div className="overflow-x-auto">
              {filteredInvites.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Ticket className="h-8 w-8 text-zinc-600 mx-auto" />
                  <p className="text-zinc-400 font-bold">No invites matching this filter.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    pill={true}
                    onClick={() => {
                      setInviteFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[11px] font-black uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-4 sm:px-6">Invited Client</th>
                      <th className="py-3.5 px-4">Direct Activation Link</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Generated / Redeemed</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredInvites.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                        {/* Client Identity */}
                        <td className="py-4 px-4 sm:px-6">
                          <div>
                            <p className="font-extrabold text-white">{inv.clientName}</p>
                            <p className="text-[11px] font-mono text-zinc-400">{inv.clientEmail}</p>
                          </div>
                        </td>

                        {/* Direct Token Link */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 max-w-sm">
                            <code className="truncate rounded-lg bg-[#090D15] border border-zinc-800 px-2.5 py-1 text-[11px] font-mono text-lime-400">
                              {inv.inviteUrl}
                            </code>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">{getInviteStatusBadge(inv.status)}</td>

                        {/* Date */}
                        <td className="py-4 px-4 text-zinc-400 font-mono text-[11px]">
                          {inv.redeemedAt ? (
                            <span className="text-lime-400 font-bold">
                              Redeemed {new Date(inv.redeemedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span>Created {new Date(inv.createdAt).toLocaleDateString()}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              pill={true}
                              onClick={() => handleCopyText(inv.inviteUrl, inv.id)}
                              className="text-[11px]"
                            >
                              {copiedToken === inv.id ? (
                                <>
                                  <Check className="h-3 w-3 text-lime-400 mr-1" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy Link
                                </>
                              )}
                            </Button>

                            {inv.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="xs"
                                pill={true}
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="text-[11px] text-red-400 hover:bg-red-500/10"
                                title="Revoke invite"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL 1: Enroll New Patient */}
      <Modal
        open={isAddPatientOpen}
        title="Enroll Post-Discharge Patient"
        onClose={() => setIsAddPatientOpen(false)}
        maxWidth="lg"
      >
        <form onSubmit={handleAddPatient} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Patient Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Taylor"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Patient Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. jordan.taylor@example.com"
              value={newPatientEmail}
              onChange={(e) => setNewPatientEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Primary Diagnosis / Joint Region *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Patellar Tendinopathy (Right)"
              value={newPatientDiagnosis}
              onChange={(e) => setNewPatientDiagnosis(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
            />
            {/* Quick preset diagnosis tags */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_DIAGNOSES.slice(0, 5).map((diag) => (
                <button
                  key={diag}
                  type="button"
                  onClick={() => setNewPatientDiagnosis(diag)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400/50 hover:text-lime-400 transition-colors"
                >
                  + {diag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Discharge Date
              </label>
              <input
                type="date"
                value={newPatientDischargeDate}
                onChange={(e) => setNewPatientDischargeDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white focus:border-lime-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Initial Routine Protocol
              </label>
              <select
                value={selectedTemplateForNewPatient}
                onChange={(e) => setSelectedTemplateForNewPatient(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-xs font-medium text-white focus:border-lime-400 focus:outline-none"
              >
                {CLINICAL_REHAB_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Therapist Clinical Directives & Safe Load Cues
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Progressive overload active. Keep RPE <= 7. Pause set if anterior joint pain exceeds 3/10."
              value={newPatientNotes}
              onChange={(e) => setNewPatientNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-[#090D15] p-3 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddPatientOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="volt"
              size="sm"
              loading={isSubmittingPatient}
              pill={true}
            >
              Enroll & Prescribe Routine
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Assign Rehab Plan */}
      <Modal
        open={isAssignPlanOpen}
        title="Prescribe Rehabilitation Protocol"
        onClose={() => setIsAssignPlanOpen(false)}
        maxWidth="lg"
      >
        {selectedClientForAssign && (
          <form onSubmit={handleAssignPlan} className="space-y-4">
            {/* Patient banner */}
            <div className="rounded-xl border border-zinc-800 bg-[#090D15] p-3.5 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-sm text-white">
                  {selectedClientForAssign.clientName}
                </p>
                <p className="text-xs font-bold text-lime-400">
                  {selectedClientForAssign.injuryDiagnosis}
                </p>
              </div>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-mono text-zinc-300">
                Compliance: {selectedClientForAssign.complianceScore}%
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Select Clinical Protocol Template
              </label>
              <div className="grid gap-2 max-h-56 overflow-y-auto pr-1">
                {CLINICAL_REHAB_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedPlanTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedPlanTemplateId(tmpl.id);
                        setAssignClinicalNotes(tmpl.notes);
                        setAssignFrequencyDays(tmpl.days);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-lime-400 bg-lime-400/10 text-white'
                          : 'border-zinc-800 bg-[#090D15] text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-extrabold text-xs">{tmpl.title}</p>
                        <span className="text-[10px] font-mono font-bold text-lime-400">
                          {tmpl.days} Days / Wk
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{tmpl.focus}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Weekly Split Frequency (Days)
              </label>
              <div className="flex items-center gap-2">
                {[2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAssignFrequencyDays(d)}
                    className={`size-10 rounded-xl font-mono text-xs font-black transition-all ${
                      assignFrequencyDays === d
                        ? 'bg-lime-400 text-zinc-950 font-black shadow-sm'
                        : 'border border-zinc-800 bg-[#090D15] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Clinical Therapist Directives & Rules for Patient
              </label>
              <textarea
                rows={3}
                required
                value={assignClinicalNotes}
                onChange={(e) => setAssignClinicalNotes(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-[#090D15] p-3 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAssignPlanOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="volt"
                size="sm"
                loading={isSubmittingAssign}
                pill={true}
              >
                Confirm & Push to Patient App
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: PURCHASE WHOLESALE SEATS (3 TIERS) */}
      <Modal
        open={isPurchaseSeatsOpen}
        title="Wholesale Seat Licensing Packages"
        onClose={() => setIsPurchaseSeatsOpen(false)}
        maxWidth="xl"
      >
        <form onSubmit={handlePurchaseSeats} className="space-y-5">
          <p className="text-xs text-zinc-400">
            Select a wholesale seat tier to unlock post-discharge patient licenses. Billed directly through Stripe Connect. Resell to patients or bundle into your clinic retainers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Tier 1: Starter 5 Seats */}
            <div
              onClick={() => setSelectedWholesaleTier('starter_5')}
              className={`p-4.5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedWholesaleTier === 'starter_5'
                  ? 'border-lime-400 bg-lime-400/10 shadow-lg shadow-lime-400/5'
                  : 'border-zinc-800 bg-[#090D15] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                  Solo PT
                </span>
                <span className="text-[10px] font-mono text-zinc-400">$9.80/seat</span>
              </div>
              <h3 className="text-base font-black text-white mt-2">Starter 5 Seats</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white font-mono">$49</span>
                <span className="text-xs font-bold text-zinc-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  5 Active Patient Seats
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  Remote Adherence Telemetry
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  Pain Spike Alerts
                </li>
              </ul>
            </div>

            {/* Tier 2: Pro 10 Seats (Highlighted) */}
            <div
              onClick={() => setSelectedWholesaleTier('pro_10')}
              className={`p-4.5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedWholesaleTier === 'pro_10'
                  ? 'border-lime-400 bg-lime-400/10 shadow-xl shadow-lime-400/10 ring-1 ring-lime-400'
                  : 'border-zinc-800 bg-[#090D15] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-lime-400 text-zinc-950 font-black px-2 py-0.5 text-[10px]">
                  Most Popular
                </span>
                <span className="text-[10px] font-mono text-lime-400">$8.90/seat</span>
              </div>
              <h3 className="text-base font-black text-white mt-2">Pro 10 Seats</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-lime-400 font-mono">$89</span>
                <span className="text-xs font-bold text-zinc-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                <li className="flex items-center gap-1.5 text-zinc-200">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  10 Active Patient Seats
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  Priority Flare-Up Alerts
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  Custom Protocol Prescriber
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime-400 shrink-0" />
                  Branded Clinic Codes
                </li>
              </ul>
            </div>

            {/* Tier 3: Clinic 25 Seats */}
            <div
              onClick={() => setSelectedWholesaleTier('clinic_25')}
              className={`p-4.5 rounded-2xl border transition-all cursor-pointer relative ${
                selectedWholesaleTier === 'clinic_25'
                  ? 'border-lime-400 bg-lime-400/10 shadow-lg shadow-lime-400/5'
                  : 'border-zinc-800 bg-[#090D15] hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-cyan-400 text-zinc-950 font-black px-2 py-0.5 text-[10px]">
                  Best Value
                </span>
                <span className="text-[10px] font-mono text-cyan-400">$7.96/seat</span>
              </div>
              <h3 className="text-base font-black text-white mt-2">Clinic 25 Seats</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-cyan-400 font-mono">$199</span>
                <span className="text-xs font-bold text-zinc-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                <li className="flex items-center gap-1.5 text-zinc-200">
                  <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                  25 Active Patient Seats
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                  Multi-Therapist Allocation
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                  Discharge-to-Rehab Funnel
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-cyan-400 shrink-0" />
                  Direct EHR/EMR Export
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#090D15] p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lime-400" />
              <span className="text-zinc-300 font-bold">Instant License Provisioning</span>
            </div>
            <span className="font-mono text-zinc-400">Cancel or change tiers anytime</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPurchaseSeatsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="volt"
              size="sm"
              loading={isSubmittingPurchase}
              pill={true}
            >
              Activate Wholesale License
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: GENERATE PATIENT INVITE LINK */}
      <Modal
        open={isGenerateInviteOpen}
        title="Generate Patient Activation Invite"
        onClose={() => {
          setIsGenerateInviteOpen(false);
          setNewlyGeneratedInvite(null);
        }}
        maxWidth="lg"
      >
        {newlyGeneratedInvite ? (
          <div className="space-y-4 text-left">
            <div className="rounded-2xl border border-lime-400/40 bg-lime-400/10 p-4.5 text-center space-y-2">
              <span className="grid size-10 place-items-center rounded-full bg-lime-400 text-zinc-950 font-black mx-auto">
                <Check className="h-5 w-5 stroke-[3]" />
              </span>
              <h3 className="text-base font-black text-white">
                Activation Link Ready for {newlyGeneratedInvite.clientName}
              </h3>
              <p className="text-xs text-zinc-300">
                Share this secure link with your patient. When they tap it, their PhysioCoach account is automatically linked to your clinic portal.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Direct Activation URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newlyGeneratedInvite.inviteUrl}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 font-mono text-xs text-lime-400 focus:outline-none"
                />
                <Button
                  variant="volt"
                  size="md"
                  pill={true}
                  onClick={() => handleCopyText(newlyGeneratedInvite.inviteUrl, 'modal-invite-link')}
                  className="shrink-0 font-extrabold text-xs"
                >
                  {copiedToken === 'modal-invite-link' ? (
                    <>
                      <Check className="h-4 w-4 mr-1" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick SMS / Email text preview */}
            <div className="rounded-xl border border-zinc-800 bg-[#090D15] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Ready-to-Send Patient Message
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(
                      `Hi ${newlyGeneratedInvite.clientName}, your physical therapist has prescribed your post-discharge rehab routine on PhysioCoach AI. Activate your profile here: ${newlyGeneratedInvite.inviteUrl}`,
                      'modal-invite-msg',
                    )
                  }
                  className="text-[11px] font-bold text-lime-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  {copiedToken === 'modal-invite-msg' ? 'Copied Message!' : 'Copy Text'}
                </button>
              </div>
              <p className="text-xs text-zinc-300 italic font-mono bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                "Hi {newlyGeneratedInvite.clientName}, your physical therapist has prescribed your post-discharge rehab routine on PhysioCoach AI. Activate your profile here: {newlyGeneratedInvite.inviteUrl}"
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                variant="volt"
                size="sm"
                pill={true}
                onClick={() => {
                  setIsGenerateInviteOpen(false);
                  setNewlyGeneratedInvite(null);
                  setActiveViewTab('seats');
                }}
              >
                Done & View Roster
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-[#090D15] p-3 flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-bold">Remaining Available Seats:</span>
              <span className="font-mono font-black text-lime-400">
                {seatsSummary?.availableSeats ?? 4} Seats Available
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maya Lin"
                value={inviteClientName}
                onChange={(e) => setInviteClientName(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Patient Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="e.g. maya.lin@example.com"
                value={inviteClientEmail}
                onChange={(e) => setInviteClientEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Primary Diagnosis / Target Region
              </label>
              <input
                type="text"
                placeholder="e.g. ACL Reconstruction Phase 2"
                value={inviteDiagnosis}
                onChange={(e) => setInviteDiagnosis(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COMMON_DIAGNOSES.slice(0, 4).map((diag) => (
                  <button
                    key={diag}
                    type="button"
                    onClick={() => setInviteDiagnosis(diag)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400/50 hover:text-lime-400 transition-colors"
                  >
                    + {diag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsGenerateInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="volt"
                size="sm"
                loading={isSubmittingInvite}
                pill={true}
              >
                Generate Activation Link
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DRAWER: Patient Detail & Telemetry Slide-over */}
      {selectedClientForDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedClientForDrawer(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-[#121722] border-l border-zinc-800 p-5 sm:p-6 overflow-y-auto space-y-6 shadow-2xl animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">
                    {selectedClientForDrawer.clientName}
                  </h2>
                  {getStatusBadge(selectedClientForDrawer.status)}
                </div>
                <p className="text-xs font-bold text-lime-400 mt-0.5">
                  {selectedClientForDrawer.injuryDiagnosis}
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  {selectedClientForDrawer.clientEmail} · Discharged {selectedClientForDrawer.dischargeDate || 'N/A'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClientForDrawer(null)}
                className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="volt"
                size="sm"
                pill={true}
                onClick={() => openAssignModal(selectedClientForDrawer)}
                className="flex-1 text-xs font-black"
              >
                <ClipboardList className="h-4 w-4 stroke-[2.5]" />
                Prescribe New Protocol
              </Button>
              <Button
                variant="outline"
                size="sm"
                pill={true}
                onClick={() => {
                  const target = selectedClientForDrawer;
                  setSelectedClientForDrawer(null);
                  openMessagingDrawer(target);
                }}
                className="text-xs font-extrabold border-zinc-700 hover:border-lime-400/60"
              >
                <MessageSquare className="h-4 w-4 text-lime-400 mr-1" />
                Async Chat
              </Button>
            </div>

            {/* Telemetry HUD */}
            {loadingTelemetry ? (
              <div className="p-8 text-center text-zinc-500 font-medium">
                Loading clinical telemetry…
              </div>
            ) : (
              <div className="space-y-6">
                {/* Clinical Flags Alert */}
                {telemetryData?.clinicalFlags && telemetryData.clinicalFlags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      Clinical Alerts & Milestones
                    </h3>
                    <div className="space-y-2">
                      {telemetryData.clinicalFlags.map((flag, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            flag.severity === 'high'
                              ? 'border-red-500/40 bg-red-500/10 text-red-300'
                              : flag.severity === 'medium'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                : 'border-lime-400/40 bg-lime-400/10 text-lime-300'
                          }`}
                        >
                          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="font-extrabold">{flag.message}</p>
                            <p className="text-[10px] font-mono opacity-80 mt-0.5">{flag.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4-Week Adherence Bar Chart */}
                <div className="rounded-2xl border border-zinc-800 bg-[#090D15] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                      4-Week Adherence History
                    </h3>
                    <span className="font-mono text-xs font-black text-lime-400">
                      Overall: {selectedClientForDrawer.complianceScore}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(telemetryData?.weeklyAdherence || [
                      { week: 'Week 1', sessionsPlanned: 3, sessionsCompleted: 3, adherencePct: 100 },
                      { week: 'Week 2', sessionsPlanned: 3, sessionsCompleted: 3, adherencePct: 100 },
                      { week: 'Week 3', sessionsPlanned: 3, sessionsCompleted: 2, adherencePct: 67 },
                      { week: 'Week 4', sessionsPlanned: 3, sessionsCompleted: 3, adherencePct: 100 },
                    ]).map((w) => (
                      <div key={w.week} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-zinc-400">{w.week}</span>
                          <span className="font-mono text-white">
                            {w.sessionsCompleted}/{w.sessionsPlanned} sessions ({w.adherencePct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              w.adherencePct >= 80 ? 'bg-lime-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${w.adherencePct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RPE & Pain Score Trends */}
                <div className="rounded-2xl border border-zinc-800 bg-[#090D15] p-4 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    Logged RPE & Pain Score Progression
                  </h3>

                  <div className="space-y-2">
                    {(telemetryData?.rpeTrend || [
                      { date: '2026-08-28', sessionName: 'HSR Loading Day 3', avgRpe: 6.5, painLevel: 2, completedSets: 12, notes: 'Felt strong throughout' },
                      { date: '2026-08-25', sessionName: 'HSR Loading Day 2', avgRpe: 7.0, painLevel: 2, completedSets: 12, notes: 'Controlled tempo' },
                      { date: '2026-08-21', sessionName: 'HSR Loading Day 1', avgRpe: 7.5, painLevel: 3, completedSets: 11, notes: 'Mild anterior knee sensitivity' },
                    ]).map((sess, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white">{sess.sessionName}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{sess.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="text-zinc-300">RPE: <strong className="text-white">{sess.avgRpe}</strong></span>
                          <span className={`${sess.painLevel >= 3 ? 'text-amber-400' : 'text-lime-400'}`}>
                            Pain: <strong>{sess.painLevel}/10</strong>
                          </span>
                          <span className="text-zinc-400">{sess.completedSets} sets</span>
                        </div>
                        {sess.notes && (
                          <p className="text-[11px] text-zinc-400 italic mt-1 bg-[#090D15] p-2 rounded-lg border border-zinc-800">
                            "{sess.notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current Prescribed Routine Summary */}
                {selectedClientForDrawer.currentPlan && (
                  <div className="rounded-2xl border border-zinc-800 bg-[#090D15] p-4 space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                      Active Clinical Protocol
                    </h3>
                    <p className="font-extrabold text-sm text-lime-400">
                      {selectedClientForDrawer.currentPlan.title}
                    </p>
                    {selectedClientForDrawer.currentPlan.clinicalNotes && (
                      <p className="text-xs text-zinc-300 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                        {selectedClientForDrawer.currentPlan.clinicalNotes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FEATURE 4.3: MODAL - Pain Alert Review & Triage */}
      <Modal
        open={Boolean(selectedAlertForReview)}
        title="Pain Alert Review & Triage"
        onClose={() => setSelectedAlertForReview(null)}
        maxWidth="lg"
      >
        {selectedAlertForReview && (
          <form onSubmit={handleResolveAlertSubmit} className="space-y-5">
            {/* Patient & Alert Macro Header */}
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      {selectedAlertForReview.clientName}
                    </h3>
                    <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider animate-pulse">
                      High Priority Flare-Up
                    </span>
                  </div>
                  <p className="text-xs font-bold text-red-300 mt-0.5">
                    Joint / Region: {selectedAlertForReview.jointRegion}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {selectedAlertForReview.exerciseName ? `Exercise: ${selectedAlertForReview.exerciseName} · ` : ''}
                    Logged on {selectedAlertForReview.sessionDate}
                  </p>
                </div>

                <div className="text-right">
                  <div className="font-mono text-3xl font-black text-red-400">
                    {selectedAlertForReview.painScore}
                    <span className="text-sm text-zinc-500">/10</span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-red-300">
                    Pain Severity Rating
                  </span>
                </div>
              </div>

              {/* 0-10 Visual Pain Meter */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-400">
                  <span>0 No Pain</span>
                  <span>4 Tolerable</span>
                  <span className="text-red-400 font-black">10 Severe</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-lime-400 via-amber-400 to-red-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, selectedAlertForReview.painScore * 10)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Directive Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                1-Click Quick Clinical Directives
              </label>
              <div className="flex flex-wrap gap-2">
                {CLINICAL_DIRECTIVE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => setAlertDirectiveNote(tmpl.directive)}
                    className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-lime-400 hover:text-lime-400 transition-all text-left"
                  >
                    + {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clinical Directive Textarea */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Therapist Clinical Directive & Instructions *
              </label>
              <textarea
                rows={4}
                required
                value={alertDirectiveNote}
                onChange={(e) => setAlertDirectiveNote(e.target.value)}
                placeholder="Enter specific instructions, load modifications, or isometric deload protocols..."
                className="w-full rounded-xl border border-zinc-800 bg-[#090D15] p-3.5 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none"
              />
            </div>

            {/* Send to Chat Checkbox */}
            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendDirectiveToChat}
                onChange={(e) => setSendDirectiveToChat(e.target.checked)}
                className="size-4 rounded border-zinc-700 bg-zinc-900 text-lime-400 focus:ring-lime-400"
              />
              <span>Send clinical directive directly to patient async messaging thread</span>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAlertForReview(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="volt"
                size="sm"
                loading={isSubmittingResolve}
                pill={true}
                className="font-black px-6"
              >
                <Check className="size-4 mr-1 stroke-[3]" />
                Resolve Alert & Transmit Directive
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* FEATURE 4.3: DRAWER - Async Therapist-Client Messaging */}
      {isMessagingOpen && selectedClientForMessaging && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMessagingOpen(false)}
        >
          <div
            className="w-full max-w-lg h-full bg-[#121722] border-l border-zinc-800 flex flex-col shadow-2xl animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/60">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {selectedClientForMessaging.clientName}
                  </h2>
                  <span className="rounded-md border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-lime-400">
                    2-Way Async Review
                  </span>
                </div>
                <p className="text-xs font-bold text-lime-400">
                  {selectedClientForMessaging.injuryDiagnosis}
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  {selectedClientForMessaging.clientEmail}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMessagingOpen(false)}
                className="rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Directive Templates Bar */}
            <div className="p-3 border-b border-zinc-800/80 bg-[#090D15] overflow-x-auto flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap pl-1 mr-1">
                Quick Directives:
              </span>
              {CLINICAL_DIRECTIVE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  onClick={() => setNewChatMessage(tmpl.directive)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-300 hover:border-lime-400 hover:text-lime-400 transition-all whitespace-nowrap"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingMessages ? (
                <div className="p-12 text-center text-zinc-500 font-medium">
                  Loading message history…
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <MessageSquare className="size-10 text-zinc-600 mx-auto" />
                  <p className="text-sm font-bold text-zinc-400">No previous messages in thread.</p>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    Send clinical guidance, load adjustments, or answers to patient questions.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isCoach = msg.senderRole === 'coach';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCoach ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-zinc-400">
                          {msg.senderName}
                        </span>
                        {isCoach && (
                          <span className="rounded bg-lime-400/20 px-1 text-[9px] font-black uppercase text-lime-400">
                            Therapist
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-medium space-y-1.5 ${
                          isCoach
                            ? 'bg-zinc-800 border border-lime-400/30 text-white rounded-tr-none'
                            : msg.isPainAlert
                              ? 'bg-red-500/15 border border-red-500/40 text-red-200 rounded-tl-none'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                        }`}
                      >
                        {msg.isPainAlert && (
                          <div className="flex items-center gap-1.5 pb-1 border-b border-red-500/20 text-red-400 font-extrabold text-[11px]">
                            <ShieldAlert className="size-3.5 shrink-0" />
                            <span>
                              Pain Alert: {msg.painScore ? `${msg.painScore}/10` : 'Reported'}
                              {msg.jointRegion ? ` (${msg.jointRegion})` : ''}
                            </span>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Input Box */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 bg-[#090D15] space-y-2">
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type clinical guidance or reply… (Enter to send)"
                  className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-lime-400 focus:outline-none resize-none"
                />
                <Button
                  type="submit"
                  variant="volt"
                  size="md"
                  pill={true}
                  disabled={!newChatMessage.trim() || isSubmittingMessage}
                  loading={isSubmittingMessage}
                  className="h-11 px-4 font-black shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  </div>
);
}
