function flag(name) {
  const v = (process.env[name] || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function notificationsOn() {
  return flag('NOTIFICATIONS_ENABLED');
}

export function emailNotificationsOn() {
  return flag('EMAIL_NOTIFICATIONS_ENABLED') || notificationsOn();
}

export function smsNotificationsOn() {
  return flag('SMS_NOTIFICATIONS_ENABLED') || notificationsOn();
}
