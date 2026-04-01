// Type definitions for Authority Head system

export type IncidentStatus = "Open" | "In Progress" | "On Hold" | "Resolved";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Emergency";
export type WorkerStatus = "Available" | "Busy" | "Offline";

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  zone: string;
  ward: string;
  location: string;
  coordinates: { lat: number; lng: number };
  reportedBy: string;
  reportedAt: string;
  images: string[];
  mlConfidence: number;
  mlPrediction: string;
  assignedWorker?: string;
  timeSinceReported: string;
  slaDeadline: string;
  slaBreached: boolean;
  duplicateGroup?: string;
  priority: number;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  currentWorkload: number;
  performanceScore: number;
  status: WorkerStatus;
  assignedIncidents: string[];
  completedIncidents: number;
  zone: string;
}

export interface WorkerUpdate {
  id: string;
  incidentId: string;
  workerId: string;
  workerName: string;
  description: string;
  images: string[];
  timestamp: string;
  location: { lat: number; lng: number };
  locationVerified: boolean;
  status: "Pending" | "Approved" | "Rejected";
  rejectionReason?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  incidentId?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface DepartmentStats {
  totalActive: number;
  highSeverity: number;
  slaBreached: number;
  resolvedToday: number;
  avgResolutionTime: string;
  workerUtilization: number;
}
