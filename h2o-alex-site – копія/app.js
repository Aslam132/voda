import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====== НАЛАШТУВАННЯ (див. README.md) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyDm51gEHnNHPWIs7YvZS3AERtLCfPlOk8I",
  authDomain: "shop-water-8e150.firebaseapp.com",
  projectId: "shop-water-8e150",
  storageBucket: "shop-water-8e150.firebasestorage.app",
  messagingSenderId: "471972167705",
  appId: "1:471972167705:web:4215c0b279d6adf23cea88"
};
// Email-и адміністраторів (мають збігатися з firestore.rules)
const ADMIN_EMAILS = ["oskarchernysyot@gmail.com"];
/* ============================================ */

const PRODUCTS = [
  // --- Бутлі 19 л ---
  {id:"w19",   cat:"bottle",  em:"🫙", name:"Вода 19 л (бутиль)",          desc:"Очищена питна вода у багаторазовому бутлі. Перший бутль — з заставою.", price:130, hit:true},
  {id:"w19x",  cat:"bottle",  em:"♻️", name:"Вода 19 л (обмін)",            desc:"Повертаєте порожній бутль — отримуєте повний.", price:95, hit:true},
  {id:"w19p",  cat:"bottle",  em:"💎", name:"Вода 19 л «Преміум»",          desc:"Додаткова мінералізація, м'який смак. Для кави та чаю.", price:165},
  // --- Пляшки та каністри ---
  {id:"w5",    cat:"pack",    em:"🧴", name:"Вода 5 л (2 шт)",              desc:"Зручні каністри для дому та офісу.", price:90},
  {id:"w15",   cat:"pack",    em:"🍶", name:"Вода 1,5 л негазована (6 шт)", desc:"Класична питна вода для щоденного вжитку.", price:110},
  {id:"w05",   cat:"pack",    em:"🥤", name:"Вода 0,5 л (12 шт)",           desc:"Для дороги, спорту та переговорних.", price:140},
  // --- Мінеральна та газована ---
  {id:"wg",    cat:"mineral", em:"🫧", name:"Вода 1,5 л газована (6 шт)",   desc:"Освіжаюча, середньогазована.", price:120},
  {id:"wm05",  cat:"mineral", em:"🏔️", name:"Мінеральна 0,5 л (6 шт)",      desc:"Столова мінеральна вода природного походження.", price:135, hit:true},
  {id:"wm15",  cat:"mineral", em:"⛰️", name:"Мінеральна 1,5 л (6 шт)",      desc:"Столова мінеральна вода для щоденного вжитку.", price:150},
  // --- Дитяча ---
  {id:"wk033", cat:"kids",    em:"🍼", name:"Дитяча вода 0,33 л (12 шт)",   desc:"Спеціальна очистка, зручна пляшечка для малюків.", price:190, hit:true},
  {id:"wk15",  cat:"kids",    em:"🧸", name:"Дитяча вода 1,5 л (6 шт)",     desc:"Для приготування суміші та щоденного пиття.", price:145},
  // --- Кулери та помпи ---
  {id:"pump",  cat:"equip",   em:"⛽", name:"Механічна помпа",              desc:"Ручна помпа для бутлів 19 л.", price:180},
  {id:"pumpe", cat:"equip",   em:"🔌", name:"Електропомпа USB",             desc:"Акумуляторна помпа із зарядкою через USB. Один дотик — склянка води.", price:350, hit:true},
  {id:"cool",  cat:"equip",   em:"🚰", name:"Кулер настільний",             desc:"Гаряча і холодна вода, для бутлів 19 л.", price:2400, hit:true},
  {id:"coolf", cat:"equip",   em:"🗄️", name:"Кулер підлоговий",             desc:"Нагрів і охолодження, місткий корпус.", price:3900},
  // --- Аксесуари ---
  {id:"cups",  cat:"acc",     em:"🥃", name:"Стаканчики 100 шт",            desc:"Одноразові стаканчики 200 мл для кулера.", price:85},
  {id:"jug",   cat:"acc",     em:"🫗", name:"Фільтр-глечик 3,5 л",          desc:"Додаткове очищення води з-під крана.", price:690},
  {id:"cart",  cat:"acc",     em:"🧪", name:"Картридж для фільтра",         desc:"Змінний картридж на 150 л води.", price:180},
  {id:"bot",   cat:"acc",     em:"🏃", name:"Спортивна пляшка 0,75 л",      desc:"Харчовий пластик без BPA, з клапаном.", price:220}
];
const CATS = {all:"Усе",bottle:"Бутлі 19 л",pack:"Пляшки та каністри",mineral:"Мінеральна та газована",kids:"Дитяча",equip:"Кулери та помпи",acc:"Аксесуари"};
const STATUS = {new:"Нове",process:"В обробці",done:"Виконано",cancel:"Скасовано"};
const fmt = n => n.toLocaleString("uk-UA")+" ₴";
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

const configured = !firebaseConfig.apiKey.startsWith("ВСТАВТЕ");
let auth, db, user=null, isAdmin=false, unsubMy=null, unsubAdmin=null, adminReady=false;
let cart = {};
try{cart=JSON.parse(localStorage.getItem("cart")||"{}")}catch{cart={}}
for(const id of Object.keys(cart)) if(!PRODUCTS.some(p=>p.id===id)) delete cart[id];  // прибрати товари, яких вже немає
let myOrders=[], allOrders=[], catFilter="all", knownIds=new Set(), current="shop";

if(configured){
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, onUser);
} else { $("cfgbanner").classList.remove("hidden"); }

/* ---------- UI-хелпери ---------- */
function toast(m){
  const t=document.createElement("div");t.className="toast";t.textContent=m;$("toasts").append(t);
  setTimeout(()=>t.remove(),3300);
}
document.addEventListener("click",e=>{               // ripple на кнопках
  const b=e.target.closest(".btn");if(!b||reduce)return;
  const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),sp=document.createElement("span");
  sp.className="ripple";sp.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  b.append(sp);setTimeout(()=>sp.remove(),600);
});
addEventListener("scroll",()=>$("hdr").classList.toggle("scrolled",scrollY>30),{passive:true});
$("yr").textContent=new Date().getFullYear();

/* тема */
function applyTheme(t){document.documentElement.dataset.theme=t;$("themeBtn").textContent=t==="dark"?"☀️":"🌙";try{localStorage.setItem("theme",t)}catch{}}
window.toggleTheme=()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");
applyTheme((()=>{try{return localStorage.getItem("theme")}catch{}})()||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"));

/* reveal + лічильники */
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;e.target.classList.add("in");io.unobserve(e.target);setTimeout(()=>{e.target.style.transitionDelay=""},1200);
  const n=e.target.querySelector("[data-count]");if(n)countUp(n);
}),{threshold:.2});
function observe(){document.querySelectorAll(".reveal:not(.in)").forEach(el=>io.observe(el))}
function countUp(el){
  const to=+el.dataset.count,suf=el.dataset.suf||"",t0=performance.now(),d=1600;
  const f=t=>{const p=Math.min(1,(t-t0)/d),v=Math.round(to*(1-Math.pow(1-p,3)));
    el.textContent=v.toLocaleString("uk-UA")+suf;if(p<1)requestAnimationFrame(f)};
  reduce?el.textContent=to.toLocaleString("uk-UA")+suf:requestAnimationFrame(f);
}

/* бульбашки у hero */
(function bubbles(){
  const c=$("bubbles"),x=c.getContext("2d");let W,H,bs=[],run=true;
  const size=()=>{W=c.width=c.offsetWidth;H=c.height=c.offsetHeight};size();addEventListener("resize",size);
  const mk=(init)=>({x:Math.random()*W,y:init?Math.random()*H:H+20,r:3+Math.random()*16,v:.3+Math.random()*1.1,w:Math.random()*Math.PI*2,a:.15+Math.random()*.35});
  for(let i=0;i<45;i++)bs.push(mk(true));
  new IntersectionObserver(e=>{run=e[0].isIntersecting;if(run)loop()}).observe(c);
  function loop(){
    if(!run||reduce)return;x.clearRect(0,0,W,H);
    for(const b of bs){b.y-=b.v;b.w+=.02;b.x+=Math.sin(b.w)*.5;if(b.y<-30)Object.assign(b,mk(false));
      const g=x.createRadialGradient(b.x-b.r*.3,b.y-b.r*.3,b.r*.1,b.x,b.y,b.r);
      g.addColorStop(0,`rgba(255,255,255,${b.a+.35})`);g.addColorStop(1,`rgba(255,255,255,${b.a*.15})`);
      x.beginPath();x.arc(b.x,b.y,b.r,0,7);x.fillStyle=g;x.fill();x.strokeStyle=`rgba(255,255,255,${b.a})`;x.stroke()}
    requestAnimationFrame(loop);
  }loop();
})();

/* конфеті */
function confetti(){
  if(reduce)return;const c=$("confetti"),x=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;
  const cols=["#27c4f5","#0a84e8","#ffffff","#7ee0ff","#ffd36b","#ff6b9a"];
  const ps=Array.from({length:150},()=>({x:innerWidth/2,y:innerHeight*.6,vx:(Math.random()-.5)*18,vy:-8-Math.random()*14,s:5+Math.random()*7,
    c:cols[Math.random()*cols.length|0],r:Math.random()*6,vr:(Math.random()-.5)*.4,round:Math.random()>.5}));
  let f=0;(function tick(){x.clearRect(0,0,c.width,c.height);
    for(const p of ps){p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.vx*=.99;p.r+=p.vr;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-f/130);
      p.round?(x.beginPath(),x.arc(0,0,p.s/2,0,7),x.fill()):x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()}
    if(++f<140)requestAnimationFrame(tick);else x.clearRect(0,0,c.width,c.height)})();
}

/* ---------- Firebase auth ---------- */
window.login = async ()=>{
  if(!configured) return toast("Спочатку налаштуйте Firebase (README.md)");
  try{ await signInWithPopup(auth,new GoogleAuthProvider()); toast("Вітаємо! 👋"); }catch(e){ toast("Не вдалося увійти: "+e.code); }
};
window.logout = ()=>signOut(auth);

function onUser(u){
  user=u;
  isAdmin = !!u && u.emailVerified && ADMIN_EMAILS.includes(u.email);
  $("loginBtn").classList.toggle("hidden",!!u);
  $("userBox").classList.toggle("hidden",!u);
  $("navOrders").classList.toggle("hidden",!u);
  $("navAdmin").classList.toggle("hidden",!isAdmin);
  if(u){
    $("avatar").src=u.photoURL||""; $("uname").textContent=(u.displayName||u.email).split(" ")[0];
    if(!$("fName").value) $("fName").value=u.displayName||"";
    subscribe();
  } else {
    unsubMy&&unsubMy(); unsubAdmin&&unsubAdmin(); myOrders=[]; allOrders=[];
    if(["orders","admin"].includes(current)) go("shop");
  }
}

function subscribe(){
  unsubMy&&unsubMy(); unsubAdmin&&unsubAdmin(); adminReady=false; knownIds=new Set();
  unsubMy = onSnapshot(query(collection(db,"orders"),where("uid","==",user.uid)),
    s=>{myOrders=s.docs.map(d=>({id:d.id,...d.data()})).sort(byDate);renderMy()},
    e=>toast("Помилка читання замовлень: "+e.code));
  if(isAdmin){
    unsubAdmin = onSnapshot(query(collection(db,"orders"),orderBy("createdAt","desc")),
      s=>{
        allOrders=s.docs.map(d=>({id:d.id,...d.data()}));
        if(adminReady) s.docChanges().forEach(c=>{if(c.type==="added"&&!knownIds.has(c.doc.id)&&c.doc.data().uid!==user.uid)toast("🔔 Нове замовлення від "+c.doc.data().name)});
        allOrders.forEach(o=>knownIds.add(o.id));adminReady=true;renderAdmin();
      },
      e=>toast("Помилка адмін-доступу: "+e.code));
  }
}
const ts = o=>o.createdAt?.toMillis?o.createdAt.toMillis():Date.now();
const byDate=(a,b)=>ts(b)-ts(a);
const dt = o=>new Date(ts(o)).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

/* ---------- Навігація ---------- */
window.go = v=>{
  if((v==="orders"&&!user)||(v==="admin"&&!isAdmin)){ if(!user) toast("Увійдіть через Google"); return; }
  current=v;
  for(const s of ["shop","cart","orders","admin"]){const el=$("v-"+s);el.classList.toggle("hidden",s!==v);if(s===v){el.style.animation="none";el.offsetHeight;el.style.animation=""}}
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===v));
  if(v==="cart") renderCart();
  scrollTo({top:0,behavior:reduce?"auto":"smooth"});
};

/* ---------- Каталог ---------- */
function renderChips(){
  $("chips").innerHTML=Object.entries(CATS).map(([k,v])=>`<button class="chip ${k===catFilter?"on":""}" onclick="setCat('${k}')">${v}</button>`).join("");
}
window.setCat=k=>{catFilter=k;renderChips();renderProducts()};
function renderProducts(){
  const list=PRODUCTS.filter(p=>catFilter==="all"||p.cat===catFilter);
  $("products").innerHTML = list.map((p,i)=>`
    <div class="card reveal" style="transition-delay:${i*60}ms">
      ${p.hit?'<span class="tag">🔥 Хіт</span>':""}
      <div class="ic"><span>${p.em}</span></div><h3>${esc(p.name)}</h3>
      <div class="d">${esc(p.desc)}</div>
      <div class="row"><span class="price">${fmt(p.price)}</span>
      <button class="btn sm" onclick="addToCart('${p.id}',this)">+ У кошик</button></div></div>`).join("");
  observe();
}
/* 3D-нахил карток */
$("products").addEventListener("pointermove",e=>{
  if(reduce||e.pointerType!=="mouse")return;const c=e.target.closest(".card");if(!c)return;
  const r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
  c.style.setProperty("--ry",((px-.5)*10).toFixed(2)+"deg");c.style.setProperty("--rx",((.5-py)*10).toFixed(2)+"deg");
  c.style.setProperty("--mx",px*100+"%");c.style.setProperty("--my",py*100+"%");
});
$("products").addEventListener("pointerout",e=>{const c=e.target.closest(".card");if(c&&!c.contains(e.relatedTarget)){c.style.setProperty("--rx","0deg");c.style.setProperty("--ry","0deg")}});

window.addToCart = (id,btn)=>{
  cart[id]=(cart[id]||0)+1;saveCart();toast("Додано в кошик 💧");
  if(reduce||!btn)return;                                   // політ іконки в кошик
  const p=PRODUCTS.find(x=>x.id===id),a=btn.getBoundingClientRect(),b=$("cartBtn").getBoundingClientRect();
  const f=document.createElement("div");f.className="fly";f.textContent=p.em;f.style.left=a.left+"px";f.style.top=a.top+"px";document.body.append(f);
  f.animate([{transform:"translate(0,0) scale(1.3)",opacity:1},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px) scale(.3)`,opacity:.4}],
    {duration:800,easing:"cubic-bezier(.5,-.3,.6,1)"}).onfinish=()=>f.remove();
};
window.chg = (id,d)=>{cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];saveCart();renderCart()};
function saveCart(){
  localStorage.setItem("cart",JSON.stringify(cart));
  const n=Object.values(cart).reduce((a,b)=>a+b,0),el=$("cartCount");
  el.textContent=n;el.classList.toggle("hidden",!n);el.style.animation="none";el.offsetHeight;el.style.animation="";
}
const cartTotal=()=>Object.entries(cart).reduce((s,[id,q])=>s+PRODUCTS.find(p=>p.id===id).price*q,0);

function renderCart(){
  const ids=Object.keys(cart);
  $("checkoutForm").classList.toggle("hidden",!ids.length);
  if(!ids.length){$("cartItems").innerHTML='<div class="empty"><span class="e">🫗</span>Кошик порожній.<br>Оберіть воду в каталозі!<br><br><button class="btn" onclick="go(\'shop\')">До каталогу</button></div>';return}
  $("cartItems").innerHTML = ids.map(id=>{const p=PRODUCTS.find(x=>x.id===id);
    return `<div class="cartline"><div class="nm"><span class="em">${p.em}</span><div><b>${esc(p.name)}</b><br><small style="color:var(--mut)">${fmt(p.price)} / шт</small></div></div>
    <div class="qty"><button onclick="chg('${id}',-1)">−</button><b>${cart[id]}</b>
    <button onclick="chg('${id}',1)">+</button><b style="min-width:90px;text-align:right">${fmt(p.price*cart[id])}</b></div></div>`}).join("")
    + `<div class="total">Разом: ${fmt(cartTotal())}</div>`;
}

/* ---------- Замовлення ---------- */
window.placeOrder = async ()=>{
  if(!configured) return toast("Спочатку налаштуйте Firebase (README.md)");
  if(!user) return toast("Для замовлення увійдіть через Google");
  const name=$("fName").value.trim(),phone=$("fPhone").value.trim(),addr=$("fAddr").value.trim();
  if(!name||!/^[+\d\s()-]{9,}$/.test(phone)||!addr) return toast("Заповніть ім'я, коректний телефон і адресу");
  const items=Object.entries(cart).map(([id,q])=>{const p=PRODUCTS.find(x=>x.id===id);return{id,name:p.name,price:p.price,qty:q}});
  $("orderBtn").disabled=true;
  try{
    await addDoc(collection(db,"orders"),{
      uid:user.uid,email:user.email,name,phone,address:addr,note:$("fNote").value.trim(),
      items,total:cartTotal(),status:"new",createdAt:serverTimestamp()});
    cart={};saveCart();confetti();toast("Дякуємо! Замовлення прийнято ✅");go("orders");
  }catch(e){toast("Помилка: "+e.code)}
  $("orderBtn").disabled=false;
};

const itemsHtml = o=>o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join("<br>");
const badge = s=>`<span class="badge s-${s}">${STATUS[s]||s}</span>`;
const emptyBox=t=>`<div class="empty"><span class="e">💧</span>${t}</div>`;

function renderMy(){
  $("myOrders").innerHTML = myOrders.length ? `<table><thead><tr><th>Дата</th><th>Товари</th><th>Сума</th><th>Статус</th></tr></thead><tbody>`+
    myOrders.map((o,i)=>`<tr style="animation-delay:${i*50}ms"><td data-l="Дата">${dt(o)}</td><td data-l="Товари">${itemsHtml(o)}</td><td data-l="Сума"><b>${fmt(o.total)}</b></td><td data-l="Статус">${badge(o.status)}</td></tr>`).join("")+`</tbody></table>`
    : emptyBox("У вас ще немає замовлень.");
}

window.renderAdmin = ()=>{
  const f=$("adminFilter").value, list=allOrders.filter(o=>!f||o.status===f);
  const cnt=s=>allOrders.filter(o=>o.status===s).length;
  $("adminStats").innerHTML=`<div><b>${allOrders.length}</b><span>усього замовлень</span></div><div><b>${cnt("new")}</b><span>нових</span></div>
    <div><b>${cnt("process")}</b><span>в обробці</span></div><div><b>${fmt(allOrders.filter(o=>o.status==="done").reduce((s,o)=>s+o.total,0))}</b><span>виручка (виконані)</span></div>`;
  $("adminOrders").innerHTML = list.length ? `<table><thead><tr><th>Дата</th><th>Клієнт</th><th>Доставка</th><th>Товари</th><th>Сума</th><th>Статус</th></tr></thead><tbody>`+
    list.map((o,i)=>`<tr style="animation-delay:${Math.min(i,10)*40}ms"><td data-l="Дата">${dt(o)}</td>
    <td data-l="Клієнт"><div><b>${esc(o.name)}</b><br><a href="tel:${esc(o.phone)}" style="color:var(--blue)">${esc(o.phone)}</a><br><small style="color:var(--mut)">${esc(o.email)}</small></div></td>
    <td data-l="Доставка"><div>${esc(o.address)}${o.note?`<br><small style="color:var(--mut)">💬 ${esc(o.note)}</small>`:""}</div></td>
    <td data-l="Товари"><div>${itemsHtml(o)}</div></td><td data-l="Сума"><b>${fmt(o.total)}</b></td>
    <td data-l="Статус"><select onchange="setStatus('${o.id}',this.value)">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===o.status?"selected":""}>${v}</option>`).join("")}</select></td></tr>`).join("")+`</tbody></table>`
    : emptyBox("Замовлень немає.");
};
window.setStatus = async (id,s)=>{try{await updateDoc(doc(db,"orders",id),{status:s});toast("Статус оновлено ✓")}catch(e){toast("Помилка: "+e.code)}};

renderChips();renderProducts();saveCart();observe();
