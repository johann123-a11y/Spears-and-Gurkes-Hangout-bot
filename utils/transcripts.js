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
        author:      msg.author.username,
        authorId:    msg.author.id,
        bot:         msg.author.bot,
        avatar:      msg.author.displayAvatarURL({ extension: 'png', size: 64 }),
        content:     msg.content || '',
        timestamp:   msg.createdTimestamp,
        attachments: [...msg.attachments.values()].map(a => ({ url: a.url, name: a.name, contentType: a.contentType || '' })),
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

// Assign a consistent color per user (like Discord's role colors)
const USER_COLORS = ['#7289da','#57f287','#fee75c','#ed4245','#eb459e','#00aff4','#faa61a','#43b581'];
function userColor(authorId) {
  let hash = 0;
  for (const c of String(authorId)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function linkify(text) {
  return esc(text).replace(/https?:\/\/\S+/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

function renderHTML(transcript) {
  const messages = transcript.messages || [];

  // Build grouped message blocks (group consecutive msgs from same user within 7 min)
  const blocks = [];
  for (const m of messages) {
    const last = blocks[blocks.length - 1];
    if (last && last.authorId === m.authorId && m.timestamp - last.lastTs < 7 * 60 * 1000) {
      last.msgs.push(m);
      last.lastTs = m.timestamp;
    } else {
      blocks.push({ authorId: m.authorId, author: m.author, avatar: m.avatar, bot: m.bot, firstTs: m.timestamp, lastTs: m.timestamp, msgs: [m] });
    }
  }

  const msgsHtml = blocks.map(block => {
    const color = block.bot ? '#ed4245' : userColor(block.authorId);
    const avatarUrl = esc(block.avatar || '');
    const initial = esc((block.author || '?')[0].toUpperCase());
    const avatarEl = avatarUrl
      ? `<img class="avatar" src="${avatarUrl}" alt="${initial}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const fallback = `<div class="avatar avatar-fallback" style="background:${color};display:${avatarUrl ? 'none' : 'flex'}">${initial}</div>`;

    const botBadge = block.bot ? '<span class="bot-badge">BOT</span>' : '';

    const innerMsgs = block.msgs.map((m, i) => {
      const atts = (m.attachments || []).map(a => {
        if (a.contentType && a.contentType.startsWith('image/')) {
          return `<div class="att-img"><a href="${esc(a.url)}" target="_blank"><img src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy"></a></div>`;
        }
        return `<div class="att-file"><a href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name || 'Attachment')}</a></div>`;
      }).join('');

      const timeEl = i === 0
        ? `<span class="timestamp">${formatTime(m.timestamp)}</span>`
        : `<span class="hover-time">${formatTime(m.timestamp)}</span>`;

      const contentHtml = m.content
        ? `<div class="msg-content">${linkify(m.content)}</div>`
        : '';

      return `<div class="msg-line">${timeEl}${contentHtml}${atts}</div>`;
    }).join('');

    return `<div class="msg-group">
  <div class="msg-avatar">${avatarEl}${fallback}</div>
  <div class="msg-body">
    <div class="msg-header">
      <span class="username" style="color:${color}">${esc(block.author)}</span>${botBadge}
      <span class="timestamp">${formatTime(block.firstTs)}</span>
    </div>
    ${innerMsgs}
  </div>
</div>`;
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
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #313338;
    color: #dbdee1;
    font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.375;
  }
  a { color: #00a8fc; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Header bar ── */
  .header {
    background: #2b2d31;
    border-bottom: 1px solid #1e1f22;
    padding: 16px 24px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header-title {
    font-size: 18px;
    font-weight: 700;
    color: #f2f3f5;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .badge-saved {
    background: #57f287;
    color: #000;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 10px;
    letter-spacing: .5px;
  }
  .meta-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .meta-chip {
    background: #1e1f22;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    color: #b5bac1;
  }
  .meta-chip strong { color: #dbdee1; }
  .answers-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .info-item {
    background: #1e1f22;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
  }
  .label { color: #b5bac1; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: .5px; margin-bottom: 2px; }
  .value { color: #f2f3f5; font-size: 13px; }

  /* ── Messages ── */
  .messages {
    padding: 16px 0 60px;
  }
  .msg-group {
    display: flex;
    gap: 0;
    padding: 2px 16px;
    position: relative;
  }
  .msg-group:hover { background: #2e3035; }

  .msg-avatar {
    flex-shrink: 0;
    width: 40px;
    margin-right: 12px;
    margin-top: 2px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }
  .avatar-fallback {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    color: #fff;
  }

  .msg-body { flex: 1; min-width: 0; }
  .msg-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
  }
  .username {
    font-weight: 600;
    font-size: 15px;
    cursor: default;
  }
  .bot-badge {
    background: #5865f2;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: .3px;
    vertical-align: middle;
  }
  .timestamp {
    font-size: 11px;
    color: #87898c;
    white-space: nowrap;
  }

  .msg-line { position: relative; padding: 1px 0; }
  .msg-content {
    color: #dbdee1;
    font-size: 15px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.375;
  }
  .hover-time {
    display: none;
    font-size: 10px;
    color: #87898c;
    position: absolute;
    left: -56px;
    top: 2px;
    white-space: nowrap;
  }
  .msg-line:hover .hover-time { display: block; }

  .att-img { margin-top: 4px; }
  .att-img img { max-width: 400px; max-height: 300px; border-radius: 4px; display: block; }
  .att-file { margin-top: 4px; font-size: 13px; }
  .att-file a { color: #00a8fc; }

  /* ── Date separator ── */
  .date-sep {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 8px;
    color: #87898c;
    font-size: 12px;
    font-weight: 600;
  }
  .date-sep::before, .date-sep::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #3f4147;
  }

  /* ── Empty ── */
  .empty { color: #87898c; padding: 40px; text-align: center; font-size: 14px; }

  @media (max-width: 600px) {
    body { font-size: 14px; }
    .att-img img { max-width: 100%; }
    .meta-grid, .answers-grid { flex-direction: column; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="header-title">
    🎫 Ticket #${transcript.ticketId} — ${esc(transcript.panelName)}
    ${transcript.saved ? '<span class="badge-saved">SAVED</span>' : ''}
  </div>
  <div class="meta-grid">
    <div class="meta-chip">Opened by <strong>${esc(transcript.openedBy?.tag)}</strong></div>
    <div class="meta-chip">Closed by <strong>${esc(transcript.closedBy?.tag)}</strong></div>
    <div class="meta-chip">Opened <strong>${new Date(transcript.openedAt).toLocaleString('de-DE')}</strong></div>
    <div class="meta-chip">Closed <strong>${new Date(transcript.closedAt).toLocaleString('de-DE')}</strong></div>
    <div class="meta-chip">Reason <strong>${esc(transcript.reason || '—')}</strong></div>
    <div class="meta-chip"><strong>${messages.length}</strong> messages</div>
    ${transcript.expiresAt ? `<div class="meta-chip">Expires <strong>${new Date(transcript.expiresAt).toLocaleDateString('de-DE')}</strong></div>` : ''}
  </div>
  ${answers ? `<div class="answers-grid">${answers}</div>` : ''}
</div>
<div class="messages">
  ${msgsHtml || '<div class="empty">No messages recorded.</div>'}
</div>
</body>
</html>`;
}

module.exports = { saveTranscript, getTranscript, markSaved, deleteTranscript, cleanupExpired, fetchAllMessages, renderHTML };
