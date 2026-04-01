/**
 * Email templates for CityPulse authority notifications.
 */

interface StatusUpdateParams {
  citizenEmail: string;
  citizenName: string;
  title: string;
  incidentId: string;
  oldStatus: string;
  newStatus: string;
  remark?: string;
  updatedAt: string;
}

interface ModerationActionParams {
  citizenEmail: string;
  citizenName: string;
  title: string;
  incidentId: string;
  action: string;
  remark?: string;
  updatedAt: string;
}

/**
 * Email sent when an incident's status changes (e.g., assigned to worker → Active).
 */
export function statusUpdateTemplate(params: StatusUpdateParams) {
  const statusColors: Record<string, string> = {
    Active: "#f59e0b",
    Resolved: "#15803d",
    resolved: "#15803d",
    Rejected: "#ef4444",
    rejected: "#ef4444",
    "On Hold": "#64748b",
    approved: "#15803d",
    pending: "#f59e0b",
    OPEN: "#00bcd4",
  };

  const statusColor = statusColors[params.newStatus] || "#00bcd4";

  const subject = `🔔 Status Update — "${params.title}" is now ${params.newStatus}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F4F5F7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #7dd3c0; color: #fff; padding: 32px 36px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 8px 0 0; opacity: 0.92; font-size: 15px; font-weight: 400; }
    .body { padding: 32px 36px; color: #131C15; }
    .body p { line-height: 1.65; margin: 0 0 16px; font-size: 15px; }
    .body strong { color: #131C15; font-weight: 600; }
    .info-card { background: #F4F5F7; border-radius: 16px; padding: 20px 24px; margin: 20px 0; }
    .info-row { padding: 10px 0; border-bottom: 1px solid rgba(19,28,21,0.08); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 11px; font-weight: 700; color: #00bcd4; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .info-value { font-size: 15px; font-weight: 600; color: #131C15; }
    .status-update-card { background: #F4F5F7; border-radius: 16px; padding: 24px 28px; margin: 24px 0; border-left: 4px solid ${statusColor}; }
    .status-flow { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .status-badge { padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; }
    .status-old { background: rgba(19,28,21,0.08); color: rgba(19,28,21,0.5); text-decoration: line-through; }
    .status-new { background: ${statusColor}20; color: ${statusColor}; }
    .arrow { font-size: 24px; color: #00bcd4; font-weight: 700; }
    .remark-box { background: rgba(251,191,36,0.08); border-left: 4px solid #f59e0b; border-radius: 0 12px 12px 0; padding: 18px 22px; margin: 20px 0; }
    .remark-box p { margin: 0; font-size: 15px; line-height: 1.65; color: #131C15; }
    .remark-box strong { color: #f59e0b; }
    .meta-info { background: rgba(0,188,212,0.05); border-radius: 12px; padding: 14px 18px; margin: 20px 0 0; font-size: 14px; color: #131C15; opacity: 0.75; }
    .footer { background: #F4F5F7; padding: 20px 36px; text-align: center; font-size: 12px; color: #131C15; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 CityPulse — Status Update</h1>
      <p>Your complaint status has been updated by the department</p>
    </div>
    <div class="body">
      <p>Dear <strong>${params.citizenName || "Citizen"}</strong>,</p>
      <p>Good news! The status of your complaint <strong>"${params.title}"</strong> has been updated by the concerned department.</p>

      <div class="info-card">
        <div class="info-row">
          <div class="info-label">Incident ID</div>
          <div class="info-value">${params.incidentId}</div>
        </div>
      </div>

      <div class="status-update-card">
        <div class="info-label">Status Changed</div>
        <div class="status-flow">
          <div>
            <div class="status-badge status-old">${params.oldStatus}</div>
          </div>
          <div class="arrow">→</div>
          <div>
            <div class="status-badge status-new">${params.newStatus}</div>
          </div>
        </div>
        <div style="font-size: 13px; color: rgba(19,28,21,0.6);">
          <strong>Updated:</strong> ${params.updatedAt}
        </div>
      </div>

      ${
        params.remark
          ? `<div class="remark-box">
        <p><strong>💬 Message from Authority:</strong><br/><br/>${params.remark}</p>
      </div>`
          : ""
      }

      <div class="meta-info">
        💡 You will continue to receive automatic updates as your complaint progresses. Thank you for helping us improve the city!
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} CityPulse · Automated Notification · Do Not Reply
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

/**
 * Email sent when a moderation action (Approved/Rejected/Flagged) is taken on an incident.
 */
export function moderationActionTemplate(params: ModerationActionParams) {
  const actionColors: Record<string, string> = {
    Approved: "#15803d",
    Rejected: "#ef4444",
    "Citizen flagged": "#f59e0b",
  };

  const actionColor = actionColors[params.action] || "#00bcd4";
  const actionEmoji = params.action === "Approved" ? "✅" : params.action === "Rejected" ? "❌" : "⚠️";

  const subject = `${actionEmoji} Complaint ${params.action} — "${params.title}"`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F4F5F7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: ${actionColor}; color: #fff; padding: 32px 36px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 8px 0 0; opacity: 0.92; font-size: 15px; font-weight: 400; }
    .body { padding: 32px 36px; color: #131C15; }
    .body p { line-height: 1.65; margin: 0 0 16px; font-size: 15px; }
    .body strong { color: #131C15; font-weight: 600; }
    .info-card { background: #F4F5F7; border-radius: 16px; padding: 20px 24px; margin: 20px 0; border-left: 4px solid ${actionColor}; }
    .info-row { padding: 10px 0; border-bottom: 1px solid rgba(19,28,21,0.08); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 11px; font-weight: 700; color: #00bcd4; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .info-value { font-size: 15px; font-weight: 600; color: #131C15; }
    .action-badge { display: inline-block; padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; background: ${actionColor}20; color: ${actionColor}; }
    .remark-box { background: rgba(251,191,36,0.08); border-left: 4px solid #f59e0b; border-radius: 0 12px 12px 0; padding: 18px 22px; margin: 20px 0; }
    .remark-box p { margin: 0; font-size: 15px; line-height: 1.65; color: #131C15; }
    .remark-box strong { color: #f59e0b; }
    .outcome-box { background: ${actionColor}10; border-radius: 12px; padding: 16px 20px; margin: 20px 0; font-size: 14px; line-height: 1.65; color: #131C15; }
    .footer { background: #F4F5F7; padding: 20px 36px; text-align: center; font-size: 12px; color: #131C15; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${actionEmoji} CityPulse — Complaint ${params.action}</h1>
      <p>A moderation decision has been made on your complaint</p>
    </div>
    <div class="body">
      <p>Dear <strong>${params.citizenName || "Citizen"}</strong>,</p>
      <p>Your complaint <strong>"${params.title}"</strong> has been reviewed by the CityPulse authority team.</p>

      <div class="info-card">
        <div class="info-row">
          <div class="info-label">Incident ID</div>
          <div class="info-value">${params.incidentId}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Decision</div>
          <div class="info-value"><span class="action-badge">${params.action}</span></div>
        </div>
        <div class="info-row">
          <div class="info-label">Updated On</div>
          <div class="info-value">${params.updatedAt}</div>
        </div>
      </div>

      ${
        params.remark
          ? `<div class="remark-box">
        <p><strong>💬 Message from Authority:</strong><br/><br/>${params.remark}</p>
      </div>`
          : ""
      }

      <div class="outcome-box">
        ${
          params.action === "Approved"
            ? "✅ Your complaint has been approved and will be addressed by the concerned department. You'll receive further updates as work progresses."
            : params.action === "Rejected"
              ? "❌ Your complaint has been rejected after careful review. If you believe this is an error, please file a new complaint with additional supporting details."
              : "⚠️ Your account has been flagged for review due to policy violations. Please contact support if you believe this is an error."
        }
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} CityPulse · Automated Notification · Do Not Reply
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}
