'use client';

import { useEffect, useMemo, useState } from 'react';

type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_STATUS_CHANGED'
  | 'IMAGE_UPLOADED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'ROLE_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | string;

type AuditLogUser = {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  role?: string;
};

type AuditLog = {
  _id: string;
  userId: string | AuditLogUser;
  action: AuditAction;
  tableName: string;
  recordId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [tableFilter, setTableFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/audit-logs?limit=200');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.action);
    return Array.from(set).sort();
  }, [logs]);

  const tables = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.tableName);
    return Array.from(set).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
      if (tableFilter !== 'ALL' && l.tableName !== tableFilter) return false;
      return true;
    });
  }, [logs, actionFilter, tableFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto" />
          <p className="mt-4 text-slate-500 text-sm font-medium">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AUDIT LOGS</h1>
          <p className="text-slate-500 text-sm mt-1">Complete system activity trail (latest 200 events)</p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded hover:bg-slate-800 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 bg-white border border-slate-200 rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Table
            </label>
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-full border border-slate-200 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">All Tables</option>
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900 tabular-nums">{filteredLogs.length}</span> of{' '}
            <span className="font-semibold text-slate-900 tabular-nums">{logs.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Table</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Record</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr
                  key={log._id}
                  className={`border-b border-slate-200 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                >
                  <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700 font-medium whitespace-nowrap">
                    {log.tableName}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {log.recordId ? <span className="font-mono text-xs">{log.recordId}</span> : <span className="text-slate-400 italic">-</span>}
                  </td>
                  <td className="py-3 px-4">
                    <ActorCell user={log.userId} />
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                    {log.ipAddress ? <span className="font-mono text-xs">{log.ipAddress}</span> : <span className="text-slate-400 italic">-</span>}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    No audit logs found
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

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function ActionBadge({ action }: { action: string }) {
  const className =
    action.includes('DELETED')
      ? 'bg-red-100 text-red-800'
      : action.includes('CREATED')
        ? 'bg-emerald-100 text-emerald-800'
        : action.includes('UPDATED') || action.includes('CHANGED')
          ? 'bg-blue-100 text-blue-800'
          : 'bg-slate-100 text-slate-700';

  return <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${className}`}>{action}</span>;
}

function ActorCell({ user }: { user: AuditLog['userId'] }) {
  if (!user) {
    return <span className="text-sm text-slate-400 italic">-</span>;
  }

  if (typeof user === 'string') {
    return <span className="text-sm text-slate-600 font-mono text-xs">{user}</span>;
  }

  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{user.name || user.username || 'Unknown'}</div>
      <div className="text-xs text-slate-500">{user.email || user.role || ''}</div>
    </div>
  );
}
