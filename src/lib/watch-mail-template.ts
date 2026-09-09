/** Inline styles and presentation tables keep the paper layout usable in email clients. */
export function watchMailHtml(input: {
  title: string;
  body: string;
  href: string;
  base: string;
}) {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body).replace(/\n/g, "<br>");
  const href = escapeHtml(input.href);
  const base = escapeHtml(input.base);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f2eee6;color:#1c1b17;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(`${input.title}. ${input.body.replace(/\n/g, " ")}`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2eee6">
    <tr><td align="center" style="padding:32px 16px 40px;">
      <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td style="padding:0 0 28px;">
          <a href="${base}/projects" style="color:#1c1b17;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:bold;letter-spacing:-0.6px;">cardstock</a>
          <p style="margin:6px 0 0;color:#777165;font-size:12px;line-height:18px;">The zen of project management. On paper.</p>
        </td></tr>
        <tr><td style="padding-left:18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#dcd5c3" style="padding:10px 15px 9px;border:1px solid #c8c0ad;border-bottom:0;font-family:'Courier New',monospace;font-size:11px;font-weight:bold;letter-spacing:1.2px;">BOARD ACTIVITY</td></tr></table>
        </td></tr>
        <tr><td bgcolor="#dcd5c3" style="padding:14px;border:1px solid #c8c0ad;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fcfbf8" style="border:1px solid #c8c0ad;border-left:4px solid #1c1b17;">
            <tr><td style="padding:28px 24px 24px;">
              <p style="margin:0 0 16px;color:#777165;font-family:'Courier New',monospace;font-size:10px;line-height:16px;letter-spacing:1.1px;">A NOTE FROM YOUR BOARD</p>
              <h1 style="margin:0;color:#1c1b17;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;line-height:36px;overflow-wrap:anywhere;">${title}</h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr><td style="padding:16px 0;border-top:1px solid #d9d2c2;border-bottom:1px solid #d9d2c2;color:#575348;font-size:15px;line-height:25px;overflow-wrap:anywhere;">${body}</td></tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="#1c1b17" style="border:1px solid #1c1b17;mso-padding-alt:13px 20px;">
                <a href="${href}" style="display:inline-block;padding:13px 20px;color:#fcfbf8;text-decoration:none;font-size:14px;font-weight:bold;line-height:20px;">Open card&nbsp;&nbsp;→</a>
              </td></tr></table>
              <p style="margin:16px 0 0;color:#777165;font-size:12px;line-height:18px;">The latest details are filed on the board.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:22px 4px 0;">
          <p style="margin:0;color:#777165;font-size:12px;line-height:20px;">Sent for activity in your projects.<br><a href="${base}/profile#profile-notifications" style="color:#3559a8;text-decoration:underline;">Choose which emails you receive</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
