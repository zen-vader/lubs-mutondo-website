import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // uses STARTTLS on port 587 instead of implicit SSL on 465
      requireTLS: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // App Password, not the normal Gmail password
      },
    });
  }
  return transporter;
}

/**
 * Sends an email with an optional PDF attachment.
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {{filename:string, content:Buffer}} [opts.attachment]
 */
export async function sendMail({ to, subject, html, attachment }) {
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME || "Lubs Mutondo Limited"}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  };

  if (attachment) {
    mailOptions.attachments = [
      {
        filename: attachment.filename,
        content: attachment.content,
        contentType: "application/pdf",
      },
    ];
  }

  return getTransporter().sendMail(mailOptions);
}
