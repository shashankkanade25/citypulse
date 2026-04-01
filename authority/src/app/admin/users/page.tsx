"use client";

import UserDirectoryPanel from "@/components/admin/UserDirectoryPanel";

export default function UserRoleManagementPage() {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: "#F4F5F7" }}>
      <main className="py-8 lg:py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: "#131C15" }}>
              Users & <span style={{ color: "#09E0F7" }}>Roles</span>
            </h1>
            <p className="text-lg" style={{ color: "#131C15", opacity: 0.7 }}>
              Assign roles and departments. No impersonation; all changes are audited.
            </p>
          </div>

          <UserDirectoryPanel />
        </div>
      </main>
    </div>
  );
}
