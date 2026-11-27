// Vercel Function: сюди LiqPay надсилає результат оплати. Перевіряємо підпис і позначаємо замовлення оплаченим.
const crypto = require("crypto");
const admin = require("firebase-admin");

function db() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return admin.firestore();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const PRIV = process.env.LIQPAY_PRIVATE_KEY;
  if (!PRIV || !process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).send("Server is not configured");

  let b = req.body;
  if (typeof b === "string") b = Object.fromEntries(new URLSearchParams(b));
  const data = b && b.data, signature = b && b.signature;
  if (!data || !signature) return res.status(400).send("Missing data");

  const expected = crypto.createHash("sha1").update(PRIV + data + PRIV).digest("base64");
  const a = Buffer.from(expected), c = Buffer.from(String(signature));
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return res.status(403).send("Bad signature");

  let p;
  try { p = JSON.parse(Buffer.from(data, "base64").toString("utf8")); } catch { return res.status(400).send("Bad data"); }
  if (!["success", "sandbox"].includes(p.status)) return res.status(200).send("ignored");

  const ref = db().collection("orders").doc(String(p.order_id));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).send("Order not found");
  const o = snap.data();
  if (Number(p.amount) < Number(o.total) || p.currency !== "UAH") return res.status(200).send("amount mismatch");
  if (!o.paid) {
    await ref.update({ paid: true, paidAt: admin.firestore.FieldValue.serverTimestamp(), liqpayPaymentId: String(p.payment_id || "") });
    const BOT = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
    if (BOT && CHAT) {
      const esc = s => String(s ?? "").replace(/[&<>]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x]));
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT, parse_mode: "HTML", text: `💳 <b>Оплачено через LiqPay: ${Number(p.amount)} ₴</b>\n👤 ${esc(o.name)} · 📞 ${esc(o.phone)}` }),
      }).catch(() => {});
    }
  }
  return res.status(200).send("ok");
};
