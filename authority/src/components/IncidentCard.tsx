import Link from "next/link";
import { Incident } from "@/types";

interface IncidentCardProps {
  incident: Incident;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

export default function IncidentCard({ incident, onSelect, isSelected }: IncidentCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Emergency": return "#EF4444";
      case "High": return "#F59E0B";
      case "Medium": return "#09E0F7";
      case "Low": return "#10B981";
      default: return "#6B7280";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved": return "#10B981";
      case "In Progress": return "#09E0F7";
      case "On Hold": return "#F59E0B";
      case "Open": return "#EF4444";
      default: return "#6B7280";
    }
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 hover:shadow-lg transition-all"
      style={{
        border: `2px solid ${isSelected ? '#09E0F7' : 'transparent'}`,
        backgroundColor: isSelected ? 'rgba(9, 224, 247, 0.05)' : '#FFFFFF'
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(incident.id)}
              className="w-5 h-5 rounded cursor-pointer"
              style={{ accentColor: '#09E0F7' }}
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: getSeverityColor(incident.severity) }}
              >
                {incident.severity}
              </div>
              <div
                className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: getStatusColor(incident.status) }}
              >
                {incident.status}
              </div>
              {incident.slaBreached && (
                <div className="px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-600">
                  ⚠ SLA Breached
                </div>
              )}
            </div>
            <h3 
              className="text-lg font-bold" 
              style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
            >
              {incident.title}
            </h3>
            <p className="text-sm mt-1" style={{ color: '#131C15', opacity: 0.6 }}>
              ID: {incident.id}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-sm" style={{ color: '#131C15' }}>
        <div className="flex items-center gap-2">
          <span style={{ opacity: 0.6 }}>📍</span>
          <span>{incident.zone}, {incident.ward}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ opacity: 0.6 }}>⏰</span>
          <span>Reported {incident.timeSinceReported}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ opacity: 0.6 }}>🎯</span>
          <span>ML Confidence: {incident.mlConfidence}%</span>
        </div>
        {incident.assignedWorker && (
          <div className="flex items-center gap-2">
            <span style={{ opacity: 0.6 }}>👷</span>
            <span>Assigned to {incident.assignedWorker}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/incidents/${incident.id}`}
          className="flex-1 text-center px-4 py-2 rounded-xl font-semibold text-sm transition-all"
          style={{ backgroundColor: '#09E0F7', color: '#FFFFFF' }}
        >
          View Details
        </Link>
        {!incident.assignedWorker && (
          <button
            className="px-4 py-2 rounded-xl font-semibold text-sm transition-all border-2"
            style={{ borderColor: '#131C15', color: '#131C15' }}
          >
            Assign
          </button>
        )}
      </div>
    </div>
  );
}
