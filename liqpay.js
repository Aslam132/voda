// Vercel Function: готує платіж LiqPay для замовлення. Сума береться з бази, а не від клієнта.
// Змінні Vercel: LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY, FIREBASE_SERVICE_ACCOUNT (JSON сервісного ключа), FIREBASE_API_KEY
const crypto = require("crypto");
const admin = require("firebase-admin");

function db() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return admin.firestore();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const PUB = process.env.LIQPAY_PUBLIC_KEY, PRIV = process.env.LIQPAY_PRIVATE_KEY, KEY = process.env.FIREBASE_API_KEY;
  if (!PUB || !PRIV || !KEY || !process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).send("Server is not configured");

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).send("Bad JSON"); } }
  if (!body || !body.token || !body.orderId) return res.status(400).send("Missing data");

  const check = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: body.token }),
  });
  if (!check.ok) return res.status(401).send("Unauthorized");
  const uid = ((await check.json()).users || [])[0]?.localId;

  const snap = await db().collection("orders").doc(String(body.orderId)).get();
  if (!snap.exists) return res.status(404).send("Order not found");
  const o = snap.data();
  if (o.uid !== uid) return res.status(403).send("Forbidden");
  if (o.payment !== "liqpay" || o.paid || o.status === "cancel") return res.status(409).send("Not payable");

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const site = process.env.SITE_URL || `https://${host}`;
  const data = Buffer.from(JSON.stringify({
    version: 3, public_key: PUB, action: "pay", amount: Number(o.total), currency: "UAH",
    description: `Замовлення H2O Alex №${snap.id.slice(0, 6)}`, order_id: snap.id,
    language: "uk", result_url: site, server_url: `${site}/api/liqpay-callback`,
  })).toString("base64");
  const signature = crypto.createHash("sha1").update(PRIV + data + PRIV).digest("base64");
  return res.status(200).json({ data, signature });
};
