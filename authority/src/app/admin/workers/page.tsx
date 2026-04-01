'use client';

import { useEffect, useState } from 'react';

interface Worker {
  _id: string;
  name: string;
  email: string;
  username: string;
  phone?: string;
  departmentId: {
    _id: string;
    name: string;
    category: string;
  } | null;
  stats: {
    totalAssigned: number;
    open: number;
    inProgress: number;
    onHold: number;
    resolved: number;
    avgResolutionTime: number;
  };
  recentActivity: Array<{
    incidentId: string;
    status: string;
    updatedAt: string;
    description: string;
  }>;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/admin/workers');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch workers');
      }
      
      setWorkers(data.workers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-500 text-sm font-medium">Loading worker data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">WORKER ACTIVITY</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor field worker performance and assignments</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Workers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {workers.map((worker) => (
          <WorkerCard 
            key={worker._id} 
            worker={worker} 
            onClick={() => setSelectedWorker(worker)} 
          />
        ))}
      </div>

      {workers.length === 0 && !error && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded">
          <p className="text-slate-400 text-sm">No workers found</p>
        </div>
      )}

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <WorkerDetailModal 
          worker={selectedWorker} 
          onClose={() => setSelectedWorker(null)} 
        />
      )}
    </div>
  );
}

function WorkerCard({ worker, onClick }: { worker: Worker; onClick: () => void }) {
  const resolvedRate = worker.stats.totalAssigned > 0 
    ? ((worker.stats.resolved / worker.stats.totalAssigned) * 100).toFixed(0)
    : '0';

  return (
    <div 
      className="bg-white border border-slate-200 rounded p-6 hover:border-slate-300 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Worker Info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{worker.name}</h3>
          <p className="text-xs text-slate-500">{worker.email}</p>
          {worker.departmentId && (
            <div className="mt-2">
              <span className="inline-block px-2 py-1 bg-slate-100 text-xs text-slate-600 border border-slate-200 rounded">
                {worker.departmentId.name}
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{resolvedRate}%</p>
          <p className="text-xs text-slate-500">Resolved</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatBox label="Open" value={worker.stats.open} tone="info" />
        <StatBox label="Active" value={worker.stats.inProgress} tone="warning" />
        <StatBox label="Hold" value={worker.stats.onHold} tone="muted" />
        <StatBox label="Done" value={worker.stats.resolved} tone="success" />
      </div>

      {/* Resolution Time */}
      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Avg Resolution: <span className="font-semibold text-slate-900">
            {worker.stats.avgResolutionTime > 0 
              ? `${worker.stats.avgResolutionTime.toFixed(1)} hrs` 
              : '-'}
          </span>
        </p>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'info' | 'warning' | 'muted' | 'success';
}) {
  const toneClass =
    tone === 'info'
      ? 'text-blue-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'success'
          ? 'text-emerald-700'
          : 'text-slate-500';

  return (
    <div className="text-center p-2 border border-slate-200 rounded">
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      <p className={`text-xs ${toneClass}`}>{label}</p>
    </div>
  );
}

function WorkerDetailModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-2 border-slate-900 rounded max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{worker.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{worker.email}</p>
              {worker.phone && <p className="text-sm text-slate-500">{worker.phone}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 transition-colors text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Performance Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{worker.stats.totalAssigned}</p>
              <p className="text-xs text-slate-500 mt-1">Total Assigned</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 border border-emerald-600 rounded">
              <p className="text-2xl font-bold text-emerald-800 tabular-nums">{worker.stats.resolved}</p>
              <p className="text-xs text-emerald-800 mt-1">Resolved</p>
            </div>
            <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {worker.stats.avgResolutionTime > 0 ? worker.stats.avgResolutionTime.toFixed(1) : '-'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Avg Hours</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {worker.recentActivity.length > 0 ? (
              worker.recentActivity.map((activity, index) => (
                <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="flex items-start justify-between mb-1">
                    <StatusBadge status={activity.status} />
                    <p className="text-xs text-slate-500">
                      {new Date(activity.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{activity.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'OPEN'
      ? 'bg-blue-100 text-blue-800'
      : status === 'IN_PROGRESS'
        ? 'bg-amber-100 text-amber-800'
        : status === 'ON_HOLD'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-emerald-100 text-emerald-800';

  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${className}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
