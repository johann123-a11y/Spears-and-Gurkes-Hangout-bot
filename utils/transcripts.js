const Store = require('../models/Store');

function getKey(ticketId) { return `transcript_${ticketId}`; }

// Save transcript to MongoDB (fire-and-forget via cache system)
async function saveTranscript(ticketId, data) {
  await Store.findOneAndUpdate(
    { key: getKey(ticketId) },
    { key: getKey(ticketId), data },
    { upsert: true }
  ).catch(err => console.error('[transcripts] save error:', err));
}

async function getTranscript(ticketId) {
  const doc = await Store.findOne({ key: getKey(ticketId) }).catch(() => null);
  return doc?.data || null;
}

async function markSaved(ticketId) {
  const doc = await Store.findOne({ key: getKey(ticketId) }).catch(() => null);
  if (!doc) return false;
  doc.data.saved = true;
  doc.data.expiresAt = null;
  await Store.findOneAndUpdate({ key: getKey(ticketId) }, { data: doc.data }).catch(() => {});
  return true;
}

async function deleteTranscript(ticketId) {
  await Store.deleteOne({ key: getKey(ticketId) }).catch(() => {});
}

// Called on startup to delete expired transcripts
async function cleanupExpired() {
  const all = await Store.find({ key: { $regex: /^transcript_/ } }).catch(() => []);
  const now = Date.now();
  let count = 0;
  for (const doc of all) {
    if (!doc.data.saved && doc.data.expiresAt && doc.data.expiresAt < now) {
      await Store.deleteOne({ key: doc.key }).catch(() => {});
      count++;
    }
  }
  if (count > 0) console.log(`[transcripts] Deleted ${count} expired transcript(s)`);
}

// Fetch all messages from a channel (handles pagination)
async function fetchAllMessages(channel) {
  const messages = [];
  let lastId = null;
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const fetched = await channel.messages.fetch(opts).catch(() => null);
    if (!fetched || fetched.size === 0) break;
    for (const msg of fetched.values()) {
      messages.push({
        author:      msg.author.tag,
        authorId:    msg.author.id,
        bot:         msg.author.bot,
        content:     msg.content || '',
        timestamp:   msg.createdTimestamp,
        attachments: [...msg.attachments.values()].map(a => a.url),
      });
    }
    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
  }
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHTML(transcript) {
  const msgs = (transcript.messages || []).map(m => {
    const time = new Date(m.timestamp).toLocaleString('de-DE');
    const color = m.bot ? '#ed4245' : '#7289da';
    const atts = m.attachments?.length
      ? `<div class="atts">${m.attachments.map(u => `<a href="${esc(u)}" target="_blank">📎 Attachment</a>`).join(' ')}</div>`
      : '';
    return `<div class="msg"><span class="author" style="color:${color}">${esc(m.author)}</span><span class="time">${time}</span><div class="content">${esc(m.content)}</div>${atts}</div>`;
  }).join('');

  const answers = (transcript.answers || []).map(a =>
    `<div class="info-item"><div class="label">${esc(a.question)}</div><div class="value">${esc(a.answer)}</div></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${transcript.ticketId} — ${esc(transcript.panelName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#36393f;color:#dcddde;font-family:'Segoe UI',sans-serif;padding:20px}
  .header{background:#2f3136;border-radius:8px;padding:20px;margin-bottom:16px}
  h1{color:#fff;font-size:20px;margin-bottom:14px}
  .badge{background:#57f287;color:#000;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px}
  .info-item{background:#40444b;padding:10px;border-radius:6px}
  .label{font-size:11px;color:#b9bbbe;text-transform:uppercase;letter-spacing:.5px}
  .value{font-size:14px;color:#fff;margin-top:3px}
  .messages{background:#2f3136;border-radius:8px;padding:8px}
  .msg{padding:8px 12px;border-radius:4px;border-bottom:1px solid #40444b}
  .msg:last-child{border-bottom:none}
  .author{font-weight:700;font-size:13px}
  .time{font-size:11px;color:#72767d;margin-left:8px}
  .content{margin-top:4px;white-space:pre-wrap;word-break:break-word;font-size:14px}
  .atts{margin-top:4px;font-size:12px}
  .atts a{color:#00aff4;text-decoration:none}
  .empty{color:#72767d;padding:20px;text-align:center}
</style>
</head>
<body>
<div class="header">
  <h1>🎫 Ticket #${transcript.ticketId} — ${esc(transcript.panelName)}${transcript.saved ? '<span class="badge">SAVED</span>' : ''}</h1>
  <div class="grid">
    <div class="info-item"><div class="label">Opened By</div><div class="value">${esc(transcript.openedBy?.tag)}</div></div>
    <div class="info-item"><div class="label">Closed By</div><div class="value">${esc(transcript.closedBy?.tag)}</div></div>
    <div class="info-item"><div class="label">Opened</div><div class="value">${new Date(transcript.openedAt).toLocaleString('de-DE')}</div></div>
    <div class="info-item"><div class="label">Closed</div><div class="value">${new Date(transcript.closedAt).toLocaleString('de-DE')}</div></div>
    <div class="info-item"><div class="label">Reason</div><div class="value">${esc(transcript.reason || '—')}</div></div>
    <div class="info-item"><div class="label">Messages</div><div class="value">${(transcript.messages || []).length}</div></div>
    ${transcript.expiresAt ? `<div class="info-item"><div class="label">Expires</div><div class="value">${new Date(transcript.expiresAt).toLocaleDateString('de-DE')}</div></div>` : ''}
  </div>
  ${answers ? `<div class="grid" style="margin-bottom:0">${answers}</div>` : ''}
</div>
<div class="messages">
  ${msgs || '<div class="empty">No messages recorded.</div>'}
</div>
</body>
</html>`;
}

module.exports = { saveTranscript, getTranscript, markSaved, deleteTranscript, cleanupExpired, fetchAllMessages, renderHTML };
