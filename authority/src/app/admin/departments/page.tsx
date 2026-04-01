'use client';

import { useEffect, useState } from 'react';

interface Department {
  _id: string;
  name: string;
  category: 'POWER' | 'WATER' | 'ROAD';
  headId: {
    _id: string;
    name: string;
    email: string;
  } | null;
  workers: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  createdAt: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch departments');
      }
      
      setDepartments(data.departments || []);
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
          <p className="mt-4 text-slate-500 text-sm font-medium">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">DEPARTMENTS</h1>
        <p className="text-slate-500 text-sm mt-1">Manage system departments and assignments</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <DepartmentCard key={dept._id} department={dept} />
        ))}
      </div>

      {departments.length === 0 && !error && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded">
          <p className="text-slate-400 text-sm">No departments found</p>
        </div>
      )}
    </div>
  );
}

function DepartmentCard({ department }: { department: Department }) {
  const categoryClass =
    department.category === 'POWER'
      ? 'bg-amber-50 text-amber-800 border-amber-600'
      : department.category === 'WATER'
        ? 'bg-blue-50 text-blue-800 border-blue-600'
        : 'bg-indigo-50 text-indigo-800 border-indigo-600';

  return (
    <div className="bg-white border border-slate-200 rounded p-6 hover:border-slate-300 transition-colors">
      <div className="mb-4">
        <div className={`inline-block px-3 py-1 text-xs font-semibold mb-3 border-l-4 ${categoryClass}`}>
          {department.category}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{department.name}</h3>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department Head</p>
          {department.headId ? (
            <div>
              <p className="text-sm font-medium text-slate-900">{department.headId.name}</p>
              <p className="text-xs text-slate-500">{department.headId.email}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No head assigned</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Workers</p>
          <div className="flex flex-wrap gap-2">
            {department.workers.length > 0 ? (
              department.workers.map((worker) => (
                <div
                  key={worker._id}
                  className="px-2 py-1 bg-slate-100 text-xs text-slate-600 border border-slate-200 rounded"
                  title={worker.email}
                >
                  {worker.name}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">No workers assigned</p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Created: {new Date(department.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
