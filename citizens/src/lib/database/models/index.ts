// Database Models Index
// Re-export all models for easy imports

export { default as User } from './user.model';
export { default as Department } from './department.model';
export { default as Incident } from './incident.model';
export { default as IncidentImage } from './incident-image.model';
export { default as IncidentStatusHistory } from './incident-status-history.model';
export { default as AuditLog } from './audit-log.model';

// Export types
export type { IUser, UserRole } from './user.model';
export type { IDepartment } from './department.model';
export type { IIncident, IncidentCategory, IncidentSeverity } from './incident.model';
export type { IIncidentImage } from './incident-image.model';
export type { IIncidentStatusHistory, IncidentStatus } from './incident-status-history.model';
export type { IAuditLog, AuditAction } from './audit-log.model';
