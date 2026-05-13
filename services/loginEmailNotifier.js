const nodemailer = require('nodemailer');
const V_Log = global.V_Log ?? 0;

const LOGIN_NOTIFICATION_TO =
  process.env.LOGIN_NOTIFICATION_TO || 'reunidosporunbalon@gmail.com';
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 20000);

function toBoolean(value, defaultValue) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return defaultValue;
}

function normalizeEmailAddress(value) {
  if (!value) {
    return '';
  }

  return String(value).trim();
}

function normalizeSmtpPassword(host, password) {
  const normalizedHost = normalizeEmailAddress(host).toLowerCase();
  const normalizedPassword = normalizeEmailAddress(password);

  if (normalizedHost.includes('gmail') && normalizedPassword.includes(' ')) {
    return normalizedPassword.replace(/\s+/g, '');
  }

  return normalizedPassword;
}

function resolveFromValue(fromValue, fallbackAddress) {
  const normalizedFrom = normalizeEmailAddress(fromValue);
  const normalizedFallback = normalizeEmailAddress(fallbackAddress);

  if (!normalizedFrom) {
    return normalizedFallback;
  }

  const emailMatch = normalizedFrom.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  if (!emailMatch) {
    return {
      name: normalizedFrom.replace(/[<>"]/g, '').trim(),
      address: normalizedFallback
    };
  }

  const address = emailMatch[0].trim();
  const name = normalizedFrom
    .replace(emailMatch[0], '')
    .replace(/[<>"]/g, '')
    .trim();

  if (!name) {
    return address;
  }

  return {
    name,
    address
  };
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = normalizeSmtpPassword(host, process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: toBoolean(process.env.SMTP_SECURE, port === 465),
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    auth: {
      user,
      pass
    }
  });
}

function getEmailConfigurationSummary() {
  const host = normalizeEmailAddress(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const user = normalizeEmailAddress(process.env.SMTP_USER);
  const from = resolveFromValue(process.env.SMTP_FROM, user);

  return {
    enabled: Boolean(host && user && normalizeEmailAddress(process.env.SMTP_PASS)),
    host: host || 'sin configurar',
    port,
    secure: toBoolean(process.env.SMTP_SECURE, port === 465),
    user: user || 'sin configurar',
    from,
    to: LOGIN_NOTIFICATION_TO,
    timeoutMs: SMTP_TIMEOUT_MS
  };
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'N/D';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

async function sendMail({ to, subject, text, html, attachments, minimalLogs = false }) {
  const configSummary = getEmailConfigurationSummary();
  const transporter = createTransporter();

  if (!transporter) {
    if (V_Log === 6) {
      console.warn('[login-email] SMTP_HOST, SMTP_USER o SMTP_PASS no estan configurados. Se omitio el envio.');
    }
    return { sent: false, skipped: true };
  }

  const from = resolveFromValue(process.env.SMTP_FROM, process.env.SMTP_USER);

  try {
    await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments
    });

    if (!minimalLogs && V_Log === 6) {
      console.log('[login-email] Correo enviado:', {
        to,
        subject,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      });
    }

    return {
      sent: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      config: configSummary
    };
  } catch (error) {
    throw error;
  }
}

async function sendLoginNotification(loginData, options = {}) {
  const subjectPrefix = options.subjectPrefix || 'Login correcto: ';
  const explicitSubject = options.subject || '';
  const bodyIntro = options.bodyIntro || 'Se detecto un login correcto en mundia l2026.';
  const customText = options.text || '';
  const minimalLogs = options.minimalLogs === true;
  const recipientTo = normalizeEmailAddress(options.to) || LOGIN_NOTIFICATION_TO;

  const subject = explicitSubject || (subjectPrefix + formatValue(loginData.alias));
  const text = customText || [
    bodyIntro,
    '',
    'Alias: ' + formatValue(loginData.alias),
    'Nombre: ' + formatValue(loginData.name),
    'Correo: ' + formatValue(loginData.email),
    'Nivel: ' + formatValue(loginData.level),
    'Estatus: ' + formatValue(loginData.status),
    'IP: ' + formatValue(loginData.ipAddress),
    'Fecha: ' + formatValue(loginData.loggedAt)
  ].join('\n');

  return sendMail({
    to: recipientTo,
    subject,
    text,
    minimalLogs
  });
}

async function sendParticipantEmail(participant, options = {}) {
  const recipientTo = normalizeEmailAddress(participant && participant.Correo);

  if (!recipientTo) {
    return {
      sent: false,
      skipped: true,
      reason: 'missing recipient email'
    };
  }

  const subject = options.subject || 'Mensaje de Reunidos por un Balon';
  const message = options.message || '';
  const greetingName =
    normalizeEmailAddress(participant.Nombre) ||
    normalizeEmailAddress(participant.Alias) ||
    'participante';

  const text = [
    'Hola ' + greetingName + ',',
    '',
    message
  ].join('\n');

  const html = [
    '<p>Hola ' + greetingName + ',</p>',
    '<p>' + String(message).replace(/\r?\n/g, '<br>') + '</p>'
  ].join('');

  return sendMail({
    to: recipientTo,
    subject,
    text,
    html,
    attachments: options.attachments || [],
    minimalLogs: options.minimalLogs === true
  });
}

module.exports = {
  getEmailConfigurationSummary,
  sendLoginNotification,
  sendParticipantEmail
};
