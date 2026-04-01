"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminPanel() {
  const [selectedTab, setSelectedTab] = useState<"incidents" | "confidence" | "audit" | "analytics">("incidents");

  const allIncidents = [
    { id: "INC-2401", category: "Power Outage", status: "Open", confidence: 0.92, reporter: "John Citizen", zone: "Zone A", date: "2026-02-05 14:30", flagged: false },
    { id: "INC-2402", category: "Water Leakage", status: "In Progress", confidence: 0.88, reporter: "Jane Doe", zone: "Zone B", date: "2026-02-05 12:45", flagged: false },
    { id: "INC-2403", category: "Road Damage", status: "Open", confidence: 0.45, reporter: "Sam Smith", zone: "Zone C", date: "2026-02-05 10:15", flagged: true },
    { id: "INC-2404", category: "Other", status: "Under Review", confidence: 0.32, reporter: "Alice Brown", zone: "Zone A", date: "2026-02-04 18:20", flagged: true },
  ];

  const auditLogs = [
    { id: "LOG-5401", action: "Incident Assigned", user: "Authority Head (John)", entity: "INC-2402", timestamp: "2026-02-05 14:35:22", details: "Assigned to Mike Johnson" },
    { id: "LOG-5402", action: "Status Updated", user: "Worker (Mike Johnson)", entity: "INC-2389", timestamp: "2026-02-05 13:20:15", details: "Status: Open → In Progress" },
    { id: "LOG-5403", action: "Incident Flagged", user: "Admin (System)", entity: "INC-2403", timestamp: "2026-02-05 10:18:45", details: "Low confidence score: 45%" },
    { id: "LOG-5404", action: "Incident Resolved", user: "Authority Head (Sarah)", entity: "INC-2398", timestamp: "2026-02-04 16:45:33", details: "Verified and marked resolved" },
    { id: "LOG-5405", action: "User Reported", user: "Admin (You)", entity: "USER-1234", timestamp: "2026-02-04 12:15:10", details: "Spam reporting flagged" },
  ];

  const systemAnalytics = {
    totalUsers: 20453,
    totalIncidents: 1247,
    avgConfidence: 0.87,
    falseReports: 42,
    systemUptime: "99.8%",
    avgResponseTime: "18h"
  };

  const handleFlagIncident = (id: string) => {
    alert(`Incident ${id} flagged for review. Audit log created.`);
  };

  const handleDiscardIncident = (id: string) => {
    const reason = prompt("Enter reason for discarding this incident:");
    if (reason) {
      alert(`Incident ${id} discarded. Reason: "${reason}". Action logged to audit trail.`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-semibold text-gray-900">CityPulse Admin</Link>
            <div className="flex items-center gap-6">
              <button className="text-gray-600 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">System-wide monitoring, audit logs, and analytics</p>
        </div>

        {/* System Stats */}
        <div className="grid md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">{systemAnalytics.totalUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">{systemAnalytics.totalIncidents.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Incidents</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-[#00bcd4] mb-1">{(systemAnalytics.avgConfidence * 100).toFixed(0)}%</div>
            <div className="text-sm text-gray-600">Avg Confidence</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-red-500 mb-1">{systemAnalytics.falseReports}</div>
            <div className="text-sm text-gray-600">False Reports</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-green-500 mb-1">{systemAnalytics.systemUptime}</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">{systemAnalytics.avgResponseTime}</div>
            <div className="text-sm text-gray-600">Avg Response</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {[
            { id: "incidents", label: "All Incidents" },
            { id: "confidence", label: "Low Confidence Reports" },
            { id: "audit", label: "Audit Logs" },
            { id: "analytics", label: "Analytics" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? "border-[#00bcd4] text-[#00bcd4]"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* All Incidents Tab */}
        {selectedTab === "incidents" && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">System-wide Incident List</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reporter</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{incident.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{incident.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{incident.reporter}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{incident.zone}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          incident.status === "Open" ? "bg-orange-100 text-orange-700" :
                          incident.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {incident.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          incident.confidence >= 0.7 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {(incident.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{incident.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="text-[#00bcd4] hover:underline text-sm font-medium">View</button>
                          {incident.confidence < 0.7 && !incident.flagged && (
                            <button 
                              onClick={() => handleFlagIncident(incident.id)}
                              className="text-orange-600 hover:underline text-sm font-medium"
                            >
                              Flag
                            </button>
                          )}
                          {incident.flagged && (
                            <button 
                              onClick={() => handleDiscardIncident(incident.id)}
                              className="text-red-600 hover:underline text-sm font-medium"
                            >
                              Discard
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Low Confidence Tab */}
        {selectedTab === "confidence" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Low Confidence Reports (Requires Review)</h2>
            <div className="space-y-4">
              {allIncidents.filter(i => i.confidence < 0.7).map((incident) => (
                <div key={incident.id} className="border border-red-200 rounded-lg p-6 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{incident.id}</h3>
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          {(incident.confidence * 100).toFixed(0)}% Confidence
                        </span>
                        {incident.flagged && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 mb-1">{incident.category}</p>
                      <p className="text-sm text-gray-600">Reporter: {incident.reporter} | {incident.zone} | {incident.date}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-[#00bcd4] hover:bg-[#00acc1] text-white rounded-lg text-sm font-medium">
                        Review Details
                      </button>
                      <button 
                        onClick={() => handleDiscardIncident(incident.id)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs Tab */}
        {selectedTab === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Immutable Audit Logs</h2>
              <p className="text-sm text-gray-600">Append-only • No deletions allowed</p>
            </div>
            <div className="divide-y divide-gray-200">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-gray-500">{log.id}</span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-gray-900 mb-1"><strong>User:</strong> {log.user}</p>
                      <p className="text-sm text-gray-600 mb-1"><strong>Entity:</strong> {log.entity}</p>
                      <p className="text-sm text-gray-600">{log.details}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {log.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {selectedTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Performance Analytics</h2>
              <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">📊 Charts and graphs will be rendered here</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Reporters</h3>
                <div className="space-y-3">
                  {["John Citizen (42 reports)", "Jane Doe (38 reports)", "Sam Smith (35 reports)"].map((user, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-700">{user}</span>
                      <button className="text-sm text-[#00bcd4] hover:underline">View</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Efficiency</h3>
                <div className="space-y-3">
                  {[
                    { dept: "Water Dept", score: 95 },
                    { dept: "Power Dept", score: 92 },
                    { dept: "Roads Dept", score: 85 }
                  ].map((item) => (
                    <div key={item.dept}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{item.dept}</span>
                        <span className="font-semibold">{item.score}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00bcd4]" style={{ width: `${item.score}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
