'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  totalIncidents: {
    today: number;
    week: number;
    month: number;
  };
  incidentsByStatus: {
    open: number;
    inProgress: number;
    onHold: number;
    resolved: number;
  };
  highSeverityUnresolved: number;
  slaBreaches: number;
  lowConfidenceReports: number;
  departmentPerformance: Array<{
    departmentName: string;
    totalIncidents: number;
    resolved: number;
    avgResolutionTime: number;
    performanceScore: number;
  }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch dashboard stats');
      }
      
      setStats(data);
    } catch (error: any) {
      console.error('Failed to fetch dashboard stats:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-500 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">SYSTEM DASHBOARD</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor platform health and performance</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Time-based Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Today"
          value={stats?.totalIncidents.today || 0}
          subtitle="Incidents reported"
        />
        <StatCard
          title="This Week"
          value={stats?.totalIncidents.week || 0}
          subtitle="Incidents reported"
        />
        <StatCard
          title="This Month"
          value={stats?.totalIncidents.month || 0}
          subtitle="Incidents reported"
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatusCard
          title="Open"
          value={stats?.incidentsByStatus.open || 0}
          tone="info"
        />
        <StatusCard
          title="In Progress"
          value={stats?.incidentsByStatus.inProgress || 0}
          tone="warning"
        />
        <StatusCard
          title="On Hold"
          value={stats?.incidentsByStatus.onHold || 0}
          tone="muted"
        />
        <StatusCard
          title="Resolved"
          value={stats?.incidentsByStatus.resolved || 0}
          tone="success"
        />
      </div>

      {/* Critical Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AlertCard
          title="High Severity Unresolved"
          value={stats?.highSeverityUnresolved || 0}
          severity="critical"
        />
        <AlertCard
          title="SLA Breaches"
          value={stats?.slaBreaches || 0}
          severity="warning"
        />
        <AlertCard
          title="Low Confidence Reports"
          value={stats?.lowConfidenceReports || 0}
          severity="info"
        />
      </div>

      {/* Department Performance */}
      <div className="bg-white border border-slate-200 rounded p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6 uppercase tracking-wide">Department Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Resolved</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Avg Time (hrs)</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody>
              {stats?.departmentPerformance.map((dept, index) => (
                <tr key={index} className={`border-b border-slate-200 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{dept.departmentName}</td>
                  <td className="text-center py-3 px-4 text-sm text-slate-600">{dept.totalIncidents}</td>
                  <td className="text-center py-3 px-4">
                    <span className="text-sm font-semibold text-emerald-700">{dept.resolved}</span>
                  </td>
                  <td className="text-center py-3 px-4 text-sm text-slate-600">
                    {dept.avgResolutionTime.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-4">
                    <ScoreBadge score={dept.performanceScore} />
                  </td>
                </tr>
              ))}
              {(!stats?.departmentPerformance || stats.departmentPerformance.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                    No department data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-6">
      <div className="flex flex-col">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <p className="text-4xl font-bold text-slate-900 mt-3 mb-1 tabular-nums">{value}</p>
        <p className="text-slate-400 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: 'info' | 'warning' | 'muted' | 'success';
}) {
  const toneClass =
    tone === 'info'
      ? 'border-blue-600'
      : tone === 'warning'
        ? 'border-amber-600'
        : tone === 'success'
          ? 'border-emerald-600'
          : 'border-slate-400';

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${toneClass} rounded p-6`}>
      <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-3">{title}</p>
      <p className="text-4xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function AlertCard({ title, value, severity }: { title: string; value: number; severity: 'critical' | 'warning' | 'info' }) {
  const severityClass =
    severity === 'critical'
      ? 'bg-red-50 border-red-600 text-red-800'
      : severity === 'warning'
        ? 'bg-amber-50 border-amber-600 text-amber-800'
        : 'bg-blue-50 border-blue-600 text-blue-800';

  return (
    <div className={`border-2 rounded p-6 ${severityClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3">{title}</p>
      <p className="text-4xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const className =
    score >= 90
      ? 'bg-emerald-600 text-white'
      : score >= 75
        ? 'bg-blue-600 text-white'
        : score >= 60
          ? 'bg-amber-600 text-white'
          : score >= 40
            ? 'bg-orange-500 text-white'
            : 'bg-red-600 text-white';

  return (
    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded ${className}`}>
      <span className="tabular-nums">{score}%</span>
    </span>
  );
}
