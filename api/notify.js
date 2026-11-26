// Vercel Serverless Function: надсилає нове замовлення в Telegram.
// Змінні середовища (Vercel → Project → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  — токен бота від @BotFather
//   TELEGRAM_CHAT_ID    — ваш chat id (або id групи)
//   FIREBASE_API_KEY    — apiKey з firebaseConfig (перевіряє, що запит від справжнього користувача)

const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const PAY = { cash: "Готівка кур'єру", courier_card: "Картка кур'єру", transfer: "Переказ на картку" };

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const BOT = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT = process.env.TELEGRAM_CHAT_ID;
  const KEY = process.env.FIREBASE_API_KEY;
  if (!BOT || !CHAT || !KEY) return res.status(500).send("Server is not configured");

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).send("Bad JSON"); } }
  if (!body || !body.token || !body.order) return res.status(400).send("Missing data");

  // Перевіряємо Firebase-токен: запит має бути від авторизованого користувача
  const check = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: body.token }),
  });
  if (!check.ok) return res.status(401).send("Unauthorized");

  const o = body.order;
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 30)
    .map(i => `• ${esc(i.name)} × ${Number(i.qty) || 0} — ${(Number(i.price) || 0) * (Number(i.qty) || 0)} ₴`).join("\n");

  const text =
    `🛒 <b>Нове замовлення H2O Alex</b>\n\n` +
    `👤 ${esc(o.name)}\n📞 ${esc(o.phone)}\n📍 ${esc(o.address)}\n` +
    (o.note ? `💬 ${esc(o.note)}\n` : "") +
    `\n${items}\n\n💰 <b>Разом: ${Number(o.total) || 0} ₴</b>\n💳 ${esc(PAY[o.payment] || "—")}`;

  const tg = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text: text.slice(0, 3900), parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return res.status(tg.ok ? 200 : 502).send(tg.ok ? "ok" : "Telegram error");
};
