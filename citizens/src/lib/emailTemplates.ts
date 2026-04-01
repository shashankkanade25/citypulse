/**
 * Email templates for CityPulse citizen notifications.
 */

interface ComplaintFiledParams {
  name: string;
  title: string;
  category: string;
  description: string;
  department: string;
  priority: string;
  date: string;
  imageUrl?: string;
}

interface StatusUpdateParams {
  name: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  remark?: string;
  updatedAt: string;
}

/**
 * Email sent when a citizen successfully files a complaint.
 */
export function complaintFiledTemplate(params: ComplaintFiledParams) {
  const subject = `✅ Complaint Registered — "${params.title}"`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F4F5F7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #00bcd4; color: #fff; padding: 32px 36px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 8px 0 0; opacity: 0.92; font-size: 15px; font-weight: 400; }
    .body { padding: 32px 36px; color: #131C15; }
    .body p { line-height: 1.65; margin: 0 0 16px; font-size: 15px; }
    .body strong { color: #131C15; font-weight: 600; }
    .info-card { background: #F4F5F7; border-radius: 16px; padding: 20px 24px; margin: 24px 0; }
    .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid rgba(19,28,21,0.08); }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 11px; font-weight: 700; color: #00bcd4; text-transform: uppercase; letter-spacing: 0.08em; min-width: 120px; margin-bottom: 4px; }
    .info-value { font-size: 15px; font-weight: 600; color: #131C15; flex: 1; }
    .badge { display: inline-block; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; }
    .badge-open { background: rgba(251,191,36,0.12); color: #f59e0b; }
    .description-box { background: #F4F5F7; border-radius: 16px; padding: 20px 24px; margin: 20px 0; border-left: 4px solid #00bcd4; }
    .description-box p { margin: 0; font-size: 15px; line-height: 1.65; color: #131C15; }
    .image-section { margin: 24px 0; text-align: center; }
    .image-label { font-size: 12px; font-weight: 700; color: #00bcd4; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
    .image-wrapper { border-radius: 16px; overflow: hidden; border: 1px solid rgba(19,28,21,0.08); box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: inline-block; max-width: 100%; }
    .image-wrapper img { display: block; max-width: 100%; max-height: 400px; }
    .footer-note { background: rgba(0,188,212,0.05); border-radius: 12px; padding: 16px 20px; margin: 24px 0 0; font-size: 14px; color: #131C15; opacity: 0.75; }
    .footer { background: #F4F5F7; padding: 20px 36px; text-align: center; font-size: 12px; color: #131C15; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ CityPulse — Complaint Registered</h1>
      <p>Your report has been successfully filed and is under review</p>
    </div>
    <div class="body">
      <p>Dear <strong>${params.name}</strong>,</p>
      <p>Thank you for reporting this issue. Your complaint has been registered with our system and will be reviewed by the <strong>${params.department}</strong> department shortly.</p>

      <div class="info-card">
        <div class="info-row">
          <div style="flex: 1;">
            <div class="info-label">Issue Title</div>
            <div class="info-value">${params.title}</div>
          </div>
        </div>
        <div class="info-row">
          <div style="flex: 1;">
            <div class="info-label">Category</div>
            <div class="info-value">${params.category}</div>
          </div>
          <div style="flex: 1;">
            <div class="info-label">Priority</div>
            <div class="info-value" style="text-transform: capitalize;">${params.priority}</div>
          </div>
        </div>
        <div class="info-row">
          <div style="flex: 1;">
            <div class="info-label">Department</div>
            <div class="info-value">${params.department}</div>
          </div>
          <div style="flex: 1;">
            <div class="info-label">Status</div>
            <div class="info-value"><span class="badge badge-open">PENDING</span></div>
          </div>
        </div>
        <div class="info-row">
          <div style="flex: 1;">
            <div class="info-label">Filed On</div>
            <div class="info-value">${params.date}</div>
          </div>
        </div>
      </div>

      <div class="description-box">
        <p><strong style="color: #00bcd4;">Description:</strong><br/><br/>${params.description}</p>
      </div>

      ${params.imageUrl ? `
      <div class="image-section">
        <div class="image-label">📷 Uploaded Photo</div>
        <div class="image-wrapper">
          <img src="${params.imageUrl}" alt="Report Photo" />
        </div>
      </div>
      ` : ''}

      <div class="footer-note">
        💡 You will receive automatic email updates whenever the status of your complaint changes. No further action is required from your side at this moment.
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
 * Email sent when the status of a complaint is updated by authority.
 */
export function statusUpdateTemplate(params: StatusUpdateParams) {
  const statusColors: Record<string, string> = {
    Active: "#f59e0b",
    "In Progress": "#f59e0b",
    in_progress: "#f59e0b",
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
    .status-update-card { background: #F4F5F7; border-radius: 16px; padding: 24px 28px; margin: 24px 0; border-left: 4px solid ${statusColor}; }
    .status-flow { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .status-badge { padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; }
    .status-old { background: rgba(19,28,21,0.08); color: rgba(19,28,21,0.5); text-decoration: line-through; }
    .status-new { background: ${statusColor}20; color: ${statusColor}; }
    .arrow { font-size: 24px; color: #00bcd4; font-weight: 700; }
    .status-label { font-size: 11px; font-weight: 700; color: #00bcd4; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
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
      <p>Dear <strong>${params.name}</strong>,</p>
      <p>Good news! The status of your complaint <strong>"${params.title}"</strong> has been updated by the concerned department.</p>

      <div class="status-update-card">
        <div class="status-label">Status Changed</div>
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
