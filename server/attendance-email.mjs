const field = (env, name) => String(env[name] || env[`VITE_${name}`] || '').trim();

export function attendanceEmailConfiguration(env) {
  return {
    service: field(env, 'EMAILJS_SERVICE_ID'),
    template: field(env, 'EMAILJS_ATTENDANCE_TEMPLATE_ID') || field(env, 'EMAILJS_TEMPLATE_ID'),
    publicKey: field(env, 'EMAILJS_PUBLIC_KEY'),
    // Private keys must remain server-only; never read a VITE-prefixed secret.
    privateKey: String(env.EMAILJS_PRIVATE_KEY || '').trim(),
  };
}

export function attendanceEmailReadiness(env) {
  const settings = attendanceEmailConfiguration(env);
  return { configured: Boolean(settings.service && settings.template && settings.publicKey) };
}

export class AttendanceEmailError extends Error {
  constructor(kind, status = 503) {
    super('The verification email could not be sent. Contact admissions for help setting up your attendance PIN.');
    this.kind = kind;
    this.status = status;
  }
}

function failureKind(status, text) {
  if (/non[- ]browser|API (?:calls|requests) (?:are )?disabled/i.test(text)) return 'server_requests_disabled';
  if (/access.?token|private.?key|public.?key|user_id|unauthorized|forbidden|access denied/i.test(text) || status === 401) return 'authorization';
  if (/quota|limit|too many/i.test(text) || status === 429) return 'rate_or_quota_limit';
  if (/template/i.test(text)) return 'template_configuration';
  if (/service|gmail|oauth|smtp|authentication|invalid login/i.test(text)) return 'email_service_connection';
  return 'provider_rejected';
}

export function createAttendanceEmailSender({ env = process.env, fetchImpl = fetch, report = (entry) => console.error('Attendance email delivery:', JSON.stringify(entry)) } = {}) {
  return async (email, name, code) => {
    const settings = attendanceEmailConfiguration(env);
    if (!attendanceEmailReadiness(env).configured) {
      report({ kind: 'missing_function_configuration' });
      throw new AttendanceEmailError('missing_function_configuration');
    }
    let response;
    try {
      response = await fetchImpl('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          service_id: settings.service, template_id: settings.template, user_id: settings.publicKey,
          ...(settings.privateKey ? { accessToken: settings.privateKey } : {}),
          template_params: {
            email, to_name: name, subjectTitle: 'Your OVTech attendance verification code',
            mainMessage: `Your attendance PIN setup or reset code is ${code}. This code expires in 10 minutes.`,
            extraMessage: 'Do not share this code or your attendance PIN. If you did not request this, ignore this email; your current PIN has not changed.',
            ctaText: 'Open student portal', ctaLink: 'https://ovtechacademy.com/lms',
          },
        }),
      });
    } catch (error) {
      const kind = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'delivery_timeout' : 'delivery_connection_failed';
      report({ kind });
      throw new AttendanceEmailError(kind);
    }
    if (!response.ok) {
      let text = '';
      try { text = (await response.text()).slice(0, 8192); } catch { /* Never log a provider response or personal details. */ }
      const kind = failureKind(response.status, text);
      report({ kind, providerStatus: response.status });
      throw new AttendanceEmailError(kind);
    }
  };
}
