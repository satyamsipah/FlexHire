import nodemailer from 'nodemailer';

let _transport;

function getTransport() {
  if (_transport) return _transport;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — emails disabled');
    return null;
  }
  _transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return _transport;
}

async function send({ to, subject, html }) {
  try {
    const t = getTransport();
    if (!t) return;
    await t.sendMail({ from: `FlexHire <${process.env.GMAIL_USER}>`, to, subject, html });
  } catch (err) {
    // Email failures must NEVER propagate — state transitions are already committed.
    console.warn('[email] send failed:', err.message);
  }
}

function projectLink(projectId) {
  return `${process.env.CLIENT_URL || 'http://localhost:5173'}/project/${projectId}/chat`;
}

function template(heading, body, ctaText, ctaUrl) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
    <h2 style="color:#4f46e5;margin:0 0 12px">${heading}</h2>
    <p style="color:#374151;line-height:1.6">${body}</p>
    <a href="${ctaUrl}"
       style="display:inline-block;margin-top:16px;padding:10px 22px;background:#4f46e5;
              color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
      ${ctaText}
    </a>
    <p style="color:#9ca3af;font-size:11px;margin-top:32px">FlexHire — Milestone Escrow Platform</p>
  </div>`;
}

export async function emailMilestoneFunded({ freelancerEmail, projectTitle, milestoneTitle, amount, projectId }) {
  await send({
    to:      freelancerEmail,
    subject: `[FlexHire] Milestone funded — "${milestoneTitle}"`,
    html:    template(
      'A milestone has been funded',
      `<b>${projectTitle}</b>: "${milestoneTitle}" (₹${amount.toLocaleString()}) has been funded by the client. Start working when you're ready.`,
      'Open Project',
      projectLink(projectId),
    ),
  });
}

export async function emailMilestoneSubmitted({ clientEmail, projectTitle, milestoneTitle, amount, projectId }) {
  await send({
    to:      clientEmail,
    subject: `[FlexHire] Work submitted — "${milestoneTitle}"`,
    html:    template(
      'Your freelancer submitted work for review',
      `<b>${projectTitle}</b>: "${milestoneTitle}" (₹${amount.toLocaleString()}) has been submitted. Please review and approve, or raise a dispute.`,
      'Review Submission',
      projectLink(projectId),
    ),
  });
}

export async function emailMilestoneApproved({ freelancerEmail, projectTitle, milestoneTitle, amount, projectId }) {
  await send({
    to:      freelancerEmail,
    subject: `[FlexHire] Payment released — "${milestoneTitle}"`,
    html:    template(
      `₹${amount.toLocaleString()} released to your wallet`,
      `The client approved your submission for "${milestoneTitle}" in <b>${projectTitle}</b>. The payment has been credited to your FlexHire wallet.`,
      'View Project',
      projectLink(projectId),
    ),
  });
}

export async function emailMilestoneDisputed({ clientEmail, freelancerEmail, adminEmail, projectTitle, milestoneTitle, projectId }) {
  const body = `A dispute has been raised on "${milestoneTitle}" in <b>${projectTitle}</b>. An admin will review and resolve it shortly.`;
  for (const to of [clientEmail, freelancerEmail, adminEmail].filter(Boolean)) {
    await send({
      to,
      subject: `[FlexHire] Dispute raised — "${milestoneTitle}"`,
      html:    template('A dispute has been raised', body, 'View Project', projectLink(projectId)),
    });
  }
}

export async function emailMilestoneRefunded({ clientEmail, projectTitle, milestoneTitle, amount, projectId }) {
  await send({
    to:      clientEmail,
    subject: `[FlexHire] Refund processed — "${milestoneTitle}"`,
    html:    template(
      'Your refund is being processed',
      `₹${amount.toLocaleString()} for "${milestoneTitle}" in <b>${projectTitle}</b> will be refunded to your original payment method.`,
      'View Project',
      projectLink(projectId),
    ),
  });
}
