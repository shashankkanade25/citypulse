"use client";

import { useState } from "react";
import Link from "next/link";

export default function AuthorityDashboard() {
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedZone, setSelectedZone] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);

  const incidents = [
    { id: "INC-2401", category: "Power Outage", status: "Open", severity: "High", confidence: 0.92, zone: "Zone A", ward: "12", location: "MG Road Junction", reporter: "John Citizen", date: "2026-02-05 14:30", slaRemaining: "2h 15m", assignedWorker: null },
    { id: "INC-2402", category: "Water Leakage", status: "In Progress", severity: "Medium", confidence: 0.88, zone: "Zone B", ward: "8", location: "Brigade Road", reporter: "Jane Doe", date: "2026-02-05 12:45", slaRemaining: "4h 30m", assignedWorker: "Mike Johnson" },
    { id: "INC-2403", category: "Road Damage", status: "Open", severity: "High", confidence: 0.95, zone: "Zone C", ward: "15", location: "Whitefield Main", reporter: "Sam Smith", date: "2026-02-05 10:15", slaRemaining: "1h 45m", assignedWorker: null },
    { id: "INC-2404", category: "Sewage Issue", status: "On Hold", severity: "Medium", confidence: 0.82, zone: "Zone A", ward: "10", location: "Indiranagar", reporter: "Alice Brown", date: "2026-02-04 18:20", slaRemaining: "Breached", assignedWorker: "Sarah Lee" },
  ];

  const workers = [
    { id: "W-101", name: "Mike Johnson", dept: "Power", activeIssues: 3, performance: 4.7, availability: "Available" },
    { id: "W-102", name: "Sarah Lee", dept: "Water", activeIssues: 2, performance: 4.9, availability: "Busy" },
    { id: "W-103", name: "John Doe", dept: "Roads", activeIssues: 1, performance: 4.5, availability: "Available" },
    { id: "W-104", name: "Emma Wilson", dept: "Power", activeIssues: 2, performance: 4.8, availability: "Available" },
  ];

  const toggleIncidentSelection = (id: string) => {
    setSelectedIncidents(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = () => {
    if (selectedIncidents.length === 0) {
      alert("Please select at least one incident");
      return;
    }
    alert(`Assigning ${selectedIncidents.length} incidents to selected worker`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-semibold text-gray-900">CityPulse Authority</Link>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-[#00bcd4] font-medium">Dashboard</Link>
              <button className="text-gray-600 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Authority Head Dashboard</h1>
          <p className="text-gray-600">Manage, assign, and monitor incident resolution</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">45</div>
            <div className="text-sm text-gray-600">Total Incidents</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-orange-500 mb-1">12</div>
            <div className="text-sm text-gray-600">Unassigned</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-[#00bcd4] mb-1">18</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-red-500 mb-1">5</div>
            <div className="text-sm text-gray-600">SLA Breaches</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-green-500 mb-1">8</div>
            <div className="text-sm text-gray-600">Available Workers</div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
              >
                <option value="all">All Departments</option>
                <option value="power">Power Dept</option>
                <option value="water">Water Dept</option>
                <option value="roads">Roads Dept</option>
                <option value="sewage">Sanitation Dept</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone/Ward</label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
              >
                <option value="all">All Zones</option>
                <option value="a">Zone A</option>
                <option value="b">Zone B</option>
                <option value="c">Zone C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
              >
                <option value="all">All Severity</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <button
                onClick={handleBulkAssign}
                disabled={selectedIncidents.length === 0}
                className="w-full px-4 py-2 bg-[#00bcd4] hover:bg-[#00acc1] disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                Bulk Assign ({selectedIncidents.length})
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Incidents List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Incident Queue</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {incidents.map((incident) => (
                  <div key={incident.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIncidents.includes(incident.id)}
                        onChange={() => toggleIncidentSelection(incident.id)}
                        className="mt-1 w-5 h-5 text-[#00bcd4] rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{incident.id}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            incident.severity === "High" ? "bg-red-100 text-red-700" :
                            incident.severity === "Medium" ? "bg-orange-100 text-orange-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {incident.severity}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            incident.status === "Open" ? "bg-orange-100 text-orange-700" :
                            incident.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {incident.status}
                          </span>
                          {incident.slaRemaining === "Breached" && (
                            <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium">
                              SLA BREACH
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 font-medium mb-1">{incident.category}</p>
                        <p className="text-sm text-gray-600 mb-2">{incident.location} - {incident.zone}, Ward {incident.ward}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span>👤 {incident.reporter}</span>
                          <span>📅 {incident.date}</span>
                          <span>ML Confidence: {(incident.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            {incident.assignedWorker ? (
                              <span className="text-gray-700">👷 Assigned to: <strong>{incident.assignedWorker}</strong></span>
                            ) : (
                              <span className="text-orange-600 font-medium">⚠️ Not Assigned</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
                              View Details
                            </button>
                            {!incident.assignedWorker && (
                              <button className="px-3 py-1 bg-[#00bcd4] hover:bg-[#00acc1] text-white rounded-lg text-sm font-medium">
                                Assign Now
                              </button>
                            )}
                          </div>
                        </div>
                        {incident.slaRemaining !== "Breached" && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>SLA Time Remaining</span>
                              <span className="font-semibold">{incident.slaRemaining}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-[#00bcd4]" style={{ width: "65%" }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workers Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 sticky top-8">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Available Workers</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {workers.map((worker) => (
                  <div key={worker.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.id}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        worker.availability === "Available" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {worker.availability}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <p>Dept: {worker.dept}</p>
                      <p>Active Issues: {worker.activeIssues}</p>
                      <p className="flex items-center gap-1">
                        Performance: <span className="text-yellow-500">★</span> {worker.performance}
                      </p>
                    </div>
                    {worker.availability === "Available" && (
                      <button className="w-full px-3 py-2 bg-[#00bcd4] hover:bg-[#00acc1] text-white rounded-lg text-sm font-medium">
                        Assign Selected
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
