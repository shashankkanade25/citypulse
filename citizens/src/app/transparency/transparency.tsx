"use client";

import { useState } from "react";
import Link from "next/link";

export default function TransparencyDashboard() {
  const [selectedZone, setSelectedZone] = useState("all");
  const [timeRange, setTimeRange] = useState("week");

  const cityStats = {
    totalIncidents: 1247,
    resolved: 892,
    inProgress: 245,
    open: 110,
    avgResolutionTime: "18 hours",
    slaBreaches: 34
  };

  const departmentPerformance = [
    { name: "Power Dept", total: 342, resolved: 298, avgTime: "16h", slaCompliance: 92 },
    { name: "Water Dept", total: 278, resolved: 245, avgTime: "14h", slaCompliance: 95 },
    { name: "Roads Dept", total: 425, resolved: 315, avgTime: "22h", slaCompliance: 85 },
    { name: "Sanitation Dept", total: 202, resolved: 178, avgTime: "19h", slaCompliance: 88 },
  ];

  const hotspotZones = [
    { zone: "Zone A - Ward 12", incidents: 87, severity: "High", trend: "↑ 15%" },
    { zone: "Zone B - Ward 8", incidents: 64, severity: "Medium", trend: "↓ 8%" },
    { zone: "Zone C - Ward 15", incidents: 92, severity: "High", trend: "↑ 22%" },
    { zone: "Zone D - Ward 20", incidents: 45, severity: "Low", trend: "→ 2%" },
  ];

  const recentResolutions = [
    { id: "INC-2401", category: "Power Outage", zone: "Zone A", resolvedIn: "4h 23m", rating: 4.5 },
    { id: "INC-2398", category: "Water Leakage", zone: "Zone B", resolvedIn: "6h 15m", rating: 4.8 },
    { id: "INC-2395", category: "Road Damage", zone: "Zone C", resolvedIn: "18h 42m", rating: 3.9 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-semibold text-gray-900">CityPulse</Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link href="/my-reports" className="text-gray-600 hover:text-gray-900">My Reports</Link>
              <Link href="/transparency" className="text-[#00bcd4] font-medium">Public Data</Link>
              <button className="text-gray-600 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-gray-900 mb-2">Public Transparency Dashboard</h1>
          <p className="text-gray-600">Real-time city-wide infrastructure incident insights</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone Filter</label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
              >
                <option value="all">All Zones</option>
                <option value="a">Zone A</option>
                <option value="b">Zone B</option>
                <option value="c">Zone C</option>
                <option value="d">Zone D</option>
              </select>
            </div>
          </div>
        </div>

        {/* City-wide Stats */}
        <div className="grid md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">{cityStats.totalIncidents}</div>
            <div className="text-sm text-gray-600">Total Incidents</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-green-500 mb-1">{cityStats.resolved}</div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-[#00bcd4] mb-1">{cityStats.inProgress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-orange-500 mb-1">{cityStats.open}</div>
            <div className="text-sm text-gray-600">Open</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">{cityStats.avgResolutionTime}</div>
            <div className="text-sm text-gray-600">Avg Resolution</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl font-semibold text-red-500 mb-1">{cityStats.slaBreaches}</div>
            <div className="text-sm text-gray-600">SLA Breaches</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Department Performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Department Performance</h2>
            <div className="space-y-4">
              {departmentPerformance.map((dept) => (
                <div key={dept.name} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">{dept.name}</span>
                    <span className="text-sm text-gray-600">{dept.avgTime} avg</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <span className="text-gray-600">Total: {dept.total}</span>
                    <span className="text-green-600">Resolved: {dept.resolved}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-[#00bcd4]" 
                      style={{ width: `${(dept.resolved / dept.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">SLA Compliance</span>
                    <span className={`font-semibold ${dept.slaCompliance >= 90 ? "text-green-600" : "text-orange-600"}`}>
                      {dept.slaCompliance}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hotspot Zones */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">High-Incident Zones (Hotspots)</h2>
            <div className="space-y-4">
              {hotspotZones.map((zone) => (
                <div key={zone.zone} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{zone.zone}</p>
                    <p className="text-sm text-gray-600">{zone.incidents} incidents</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      zone.severity === "High" ? "bg-red-100 text-red-700" :
                      zone.severity === "Medium" ? "bg-orange-100 text-orange-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {zone.severity}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">{zone.trend}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Incident Map Placeholder */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Live Incident Heatmap</h2>
          <div className="h-96 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="font-medium">Interactive Map</p>
              <p className="text-sm">Heatmap showing zone-wise incident density</p>
            </div>
          </div>
        </div>

        {/* Recent Resolutions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Resolutions</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolved In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentResolutions.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.zone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.resolvedIn}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-semibold">{item.rating}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
