import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Issue from "@/lib/models/Issue";

/**
 * GET /api/reports/stats — Aggregate department statistics from MongoDB
 * Returns department-wise breakdown for transparency dashboard
 */
export async function GET() {
    try {
        await connectDB();

        // Get all issues
        const issues = await Issue.find({})
            .select("category status priority severityLevel department createdAt")
            .lean();

        // Aggregate by category/department
        const departmentMap: Record<string, {
            name: string;
            total: number;
            resolved: number;
            pending: number;
            inProgress: number;
        }> = {};

        const categoryToDept: Record<string, string> = {
            roads: "Roads & Transportation",
            water: "Water Supply",
            electricity: "Electricity",
            streetlights: "Street Lights",
            drainage: "Drainage",
            waste: "Waste Management",
            other: "Other Services",
        };

        for (const issue of issues) {
            const deptName = issue.department || categoryToDept[issue.category?.toLowerCase()] || "Other Services";

            if (!departmentMap[deptName]) {
                departmentMap[deptName] = {
                    name: deptName,
                    total: 0,
                    resolved: 0,
                    pending: 0,
                    inProgress: 0,
                };
            }

            departmentMap[deptName].total++;

            const status = issue.status?.toLowerCase();
            if (status === "resolved") {
                departmentMap[deptName].resolved++;
            } else if (status === "in-progress") {
                departmentMap[deptName].inProgress++;
            } else {
                departmentMap[deptName].pending++;
            }
        }

        const departments = Object.values(departmentMap).sort((a, b) => b.total - a.total);

        // Calculate totals
        const totals = {
            total: issues.length,
            resolved: issues.filter((i: any) => i.status?.toLowerCase() === "resolved").length,
            pending: issues.filter((i: any) => i.status?.toLowerCase() === "pending" || i.status?.toLowerCase() === "open").length,
            inProgress: issues.filter((i: any) => i.status?.toLowerCase() === "in-progress").length,
        };

        // Get recent resolutions (last 5 resolved issues)
        const recentResolutions = await Issue.find({ status: { $regex: /resolved/i } })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select("title department category updatedAt")
            .lean();

        return NextResponse.json({
            success: true,
            data: {
                departments,
                totals,
                recentResolutions: recentResolutions.map((r: any) => ({
                    title: r.title,
                    department: r.department || categoryToDept[r.category?.toLowerCase()] || "Other",
                    time: getTimeAgo(r.updatedAt),
                })),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch stats";
        console.error("Stats error:", error);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return "Just now";
}
