// Calendar file for the "Apple or Outlook calendar" button in the confirmation email.
// Only builds a file from the date, time and address in the link; it reads and stores nothing.
const mail = require('./_email');

module.exports = function handler(req, res) {
  const q = req.query || {};
  const ics = mail.icsFile(String(q.date || '').slice(0, 60), String(q.time || '').slice(0, 80), String(q.address || '').slice(0, 300));
  if (!ics) return res.status(400).send('This calendar link is not valid.');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="tidyhaus-cleaning.ics"');
  return res.status(200).send(ics);
};
