"use client";

import { useState } from "react";
import Link from "next/link";

export default function MyReports() {
  const [filter, setFilter] = useState("all");

  const reports = [
    { id: "INC-2401", category: "Power Outage", status: "In Progress", severity: "High", confidence: 0.92, date: "2026-02-05", location: "Zone A, Ward 12", assignedTo: "Power Dept", worker: "John Doe", eta: "4 hours", lastUpdate: "2 hours ago", progress: 60 },
    { id: "INC-2398", category: "Water Leakage", status: "Resolved", severity: "Medium", confidence: 0.88, date: "2026-02-03", location: "Zone B, Ward 8", assignedTo: "Water Dept", worker: "Jane Smith", eta: "Completed", lastUpdate: "1 day ago", progress: 100 },
    { id: "INC-2395", category: "Road Damage", status: "Open", severity: "Low", confidence: 0.75, date: "2026-02-02", location: "Zone C, Ward 15", assignedTo: "Roads Dept", worker: "Not Assigned", eta: "Pending", lastUpdate: "3 hours ago", progress: 0 },
    { id: "INC-2390", category: "Sewage Issue", status: "On Hold", severity: "High", confidence: 0.95, date: "2026-02-01", location: "Zone A, Ward 10", assignedTo: "Sanitation Dept", worker: "Mike Johnson", eta: "12 hours", lastUpdate: "6 hours ago", progress: 30 },
    { id: "INC-2385", category: "Street Light", status: "Resolved", severity: "Low", confidence: 0.82, date: "2026-01-30", location: "Zone D, Ward 20", assignedTo: "Electrical Dept", worker: "Sarah Lee", eta: "Completed", lastUpdate: "3 days ago", progress: 100 },
  ];

  const filteredReports = filter === "all" ? reports : reports.filter(r => r.status.toLowerCase().replace(" ", "-") === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-semibold text-gray-900">CityPulse</Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link href="/my-reports" className="text-[#00bcd4] font-medium">My Reports</Link>
              <Link href="/transparency" className="text-gray-600 hover:text-gray-900">Public Data</Link>
              <button className="text-gray-600 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">My Reports</h1>
          <p className="text-gray-600">Track all your submitted infrastructure incident reports</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["all", "open", "in-progress", "on-hold", "resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium capitalize whitespace-nowrap ${
                filter === status
                  ? "bg-[#00bcd4] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {status.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Reports Grid */}
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Section */}
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-16 rounded-full ${
                      report.severity === "High" ? "bg-red-500" :
                      report.severity === "Medium" ? "bg-orange-500" : "bg-green-500"
                    }`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{report.id}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          report.status === "Resolved" ? "bg-green-100 text-green-700" :
                          report.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                          report.status === "On Hold" ? "bg-yellow-100 text-yellow-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {report.status}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          report.severity === "High" ? "bg-red-100 text-red-700" :
                          report.severity === "Medium" ? "bg-orange-100 text-orange-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {report.severity} Severity
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{report.category}</p>
                      <p className="text-sm text-gray-600 mb-2">{report.location}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>📅 {report.date}</span>
                        <span>🏢 {report.assignedTo}</span>
                        <span>👤 {report.worker}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Section */}
                <div className="lg:w-80 space-y-3">
                  {/* ML Confidence */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>ML Confidence Score</span>
                      <span className="font-semibold">{(report.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${report.confidence >= 0.9 ? "bg-green-500" : report.confidence >= 0.7 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${report.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{report.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00bcd4]" style={{ width: `${report.progress}%` }}></div>
                    </div>
                  </div>

                  {/* ETA */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">ETA:</span>
                    <span className="font-semibold text-gray-900">{report.eta}</span>
                  </div>

                  {/* Last Update */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Last Update:</span>
                    <span className="text-gray-700">{report.lastUpdate}</span>
                  </div>

                  {/* Action Button */}
                  <Link 
                    href={`/report/${report.id}`}
                    className="block w-full text-center px-4 py-2 bg-[#00bcd4] hover:bg-[#00acc1] text-white rounded-lg font-medium transition-colors"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No reports found for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
