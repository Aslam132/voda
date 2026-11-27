import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====== НАЛАШТУВАННЯ ====== */
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

// Telegram-сповіщення: адреса серверної функції (api/notify.js). Залиште "" щоб вимкнути.
// Щоб воно запрацювало, додайте змінні на Vercel — див. SETUP-PAYMENT-TELEGRAM.md, розділ 3.
const NOTIFY_URL = "/api/notify";

// Оплата переказом на картку. Залиште PAY_CARD "" щоб вимкнути цей спосіб.
const PAY_CARD = "";            // напр. "5375 41XX XXXX XXXX"
const PAY_CARD_HOLDER = "";     // напр. "Олександр К."

// Вхід через Google на телефонах: redirect + проксі через ваш домен (див. vercel.json і SETUP-PAYMENT-TELEGRAM.md).
// Якщо поставити false — телефони використовуватимуть звичайне вікно входу (на багатьох телефонах воно не працює).
const MOBILE_REDIRECT_LOGIN = true;

// Мапа вибору адреси (OpenStreetMap, безкоштовно). Зараз налаштована на Олександрію (Кіровоградська обл.).
const DELIVERY_CITY = "Олександрія";
const MAP_CENTER = [48.6697, 33.1176];   // центр мапи [широта, довгота]
const MAP_ZOOM = 13;
const MAP_BOUNDS = [[48.58, 32.98], [48.76, 33.26]];   // мапа не виходить за ці межі: [[пд-зх], [пн-сх]] — місто з околицями
const MAP_COUNTRY = "ua";                // пошук адрес тільки в цій країні
/* ========================== */

const CATS = {all:"Усе",bottle:"Бутлі 19 л",pack:"Пляшки та каністри",mineral:"Мінеральна та газована",kids:"Дитяча",equip:"Кулери та помпи",acc:"Аксесуари"};
const DEFAULT_PRODUCTS = [
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
DEFAULT_PRODUCTS.forEach((p,i)=>p.sort=i);
const STATUS = {new:"Нове",process:"В обробці",done:"Виконано",cancel:"Скасовано"};
const PAYMENTS = {cash:"Готівка кур'єру",courier_card:"Картка кур'єру",transfer:"Переказ на картку"};
const EMOJIS = ["💧","🫙","♻️","💎","🧴","🍶","🥤","🫧","🏔️","🍼","⛽","🔌","🚰","🗄️","🥃","🫗","🧪","🏃"];
const fmt = n => Number(n||0).toLocaleString("uk-UA")+" ₴";
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => { u=String(u||"").trim();
  return (/^https?:\/\//i.test(u) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u)) ? u : "" };
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints>1 && /Macintosh/.test(navigator.userAgent));
const IN_APP = /FBAN|FBAV|Instagram|TikTok|Snapchat|MicroMessenger|Line\/|; wv\)/i.test(navigator.userAgent);
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

const configured = !firebaseConfig.apiKey.startsWith("ВСТАВТЕ");
let auth, db, user=null, isAdmin=false, unsubMy=null, unsubAdmin=null, adminReady=false;
let cart = {};
try{ cart = JSON.parse(localStorage.getItem("cart")||"{}") }catch{ cart = {} }
let PRODUCTS = DEFAULT_PRODUCTS.slice(), DB_PRODUCTS = [];
let myOrders=[], allOrders=[], catFilter="all", knownIds=new Set(), current="shop", adminTab="orders", editingId=null, formImg="", pickedGeo=null, profGeo=null;


/* ---------- UI-хелпери ---------- */
function toast(m){
  const t=document.createElement("div");t.className="toast";t.textContent=m;$("toasts").append(t);
  setTimeout(()=>t.remove(),3300);
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();
  o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=880;g.gain.setValueAtTime(.0001,c.currentTime);
  g.gain.exponentialRampToValueAtTime(.2,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.5);o.start();o.stop(c.currentTime+.5)}catch{}}
document.addEventListener("click",e=>{               // ripple на кнопках
  const b=e.target.closest(".btn");if(!b||reduce)return;
  const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),sp=document.createElement("span");
  sp.className="ripple";sp.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
  b.append(sp);setTimeout(()=>sp.remove(),600);
});
addEventListener("scroll",()=>$("hdr").classList.toggle("scrolled",scrollY>30),{passive:true});
$("yr").textContent=new Date().getFullYear();

/* модальні вікна */
window.openModal = id=>{$(id).classList.remove("hidden");document.body.classList.add("noscroll")};
window.closeModal = id=>{$(id).classList.add("hidden");if(!document.querySelector(".modal:not(.hidden)"))document.body.classList.remove("noscroll")};
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("pointerdown",e=>{if(e.target===m)closeModal(m.id)}));
addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal:not(.hidden)").forEach(m=>closeModal(m.id))});

/* тема */
function applyTheme(t){document.documentElement.dataset.theme=t;$("themeBtn").textContent=t==="dark"?"☀️":"🌙";try{localStorage.setItem("theme",t)}catch{}}
window.toggleTheme=()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");
applyTheme((()=>{try{return localStorage.getItem("theme")}catch{}})()||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"));

/* reveal + лічильники */
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting)return;e.target.classList.add("in");io.unobserve(e.target);
  setTimeout(()=>{e.target.style.transitionDelay=""},1200);
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
  if(IN_APP){
    $("imodalBody").innerHTML=`<h3>🌐 Відкрийте в браузері</h3><p style="margin:12px 0;color:var(--mut);line-height:1.6">Google не дозволяє вхід усередині цього вбудованого браузера (Telegram, Instagram тощо). Натисніть ⋯ у куті екрана та оберіть <b style="color:var(--ink)">«Відкрити в Chrome / Safari»</b>, після цього увійдіть знову.</p>`;
    return openModal("imodal");
  }
  try{
    const prov=new GoogleAuthProvider();
    if(IS_MOBILE&&MOBILE_REDIRECT_LOGIN){ await signInWithRedirect(auth,prov); return; }
    await signInWithPopup(auth,prov); toast("Вітаємо! 👋");
  }catch(e){ toast("Не вдалося увійти: "+e.code); }
};
window.logout = ()=>signOut(auth);
window.authToggle = ()=>user?logout():login();

function onUser(u){
  user=u;
  isAdmin = !!u && u.emailVerified && ADMIN_EMAILS.includes(u.email);
  $("loginBtn").classList.toggle("hidden",!!u);
  $("userBox").classList.toggle("hidden",!u);
  $("navOrders").classList.toggle("hidden",!u);
  $("navAdmin").classList.toggle("hidden",!isAdmin);
  $("bnOrders").classList.toggle("hidden",!u);
  $("bnAdmin").classList.toggle("hidden",!isAdmin);
  if(u){
    const av=$("avatar");av.style.display=u.photoURL?"":"none";av.src=u.photoURL||""; $("uname").textContent=(u.displayName||u.email).split(" ")[0];
    fillCheckoutFromProfile();
    subscribe();
    subscribeProducts();
  } else {
    unsubMy&&unsubMy(); unsubAdmin&&unsubAdmin(); myOrders=[]; allOrders=[];
    if(["orders","admin"].includes(current)) go("shop");
  }
  renderProfile();
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
        if(adminReady) s.docChanges().forEach(c=>{if(c.type==="added"&&!knownIds.has(c.doc.id)&&c.doc.data().uid!==user.uid){toast("🔔 Нове замовлення від "+c.doc.data().name);beep()}});
        allOrders.forEach(o=>knownIds.add(o.id));adminReady=true;renderAdmin();
      },
      e=>toast("Помилка адмін-доступу: "+e.code));
  }
}
const ts = o=>o.createdAt?.toMillis?o.createdAt.toMillis():Date.now();
const byDate=(a,b)=>ts(b)-ts(a);
const bySort=(a,b)=>(a.sort??9999)-(b.sort??9999)||String(a.name).localeCompare(String(b.name),"uk");
const dt = o=>new Date(ts(o)).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});


/* ---------- Мапа: вибір адреси ---------- */
let map=null, mapCb=null, mapPick=null, mapSeq=0, mapTimer=null, searchTimer=null, leafletP=null;
const okGeo = g=>g&&Number.isFinite(g.lat)&&Number.isFinite(g.lng);
const geoUrl = g=>`https://www.google.com/maps?q=${g.lat},${g.lng}`;
function geoLink(o){ return okGeo(o.geo)?`<br><a class="maplink" href="${geoUrl(o.geo)}" target="_blank" rel="noopener">🗺️ Відкрити на мапі</a>`:"" }
function updateGeoChip(){
  const c=$("geoChip");if(!c)return;
  c.classList.toggle("hidden",!okGeo(pickedGeo));
  if(okGeo(pickedGeo)) $("geoChipLink").href=geoUrl(pickedGeo);
}
window.clearGeo = ()=>{pickedGeo=null;updateGeoChip()};
function loadLeaflet(){
  if(window.L) return Promise.resolve();
  if(leafletP) return leafletP;
  leafletP=new Promise((res,rej)=>{
    const css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.append(css);
    const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload=()=>res();s.onerror=()=>{leafletP=null;rej(new Error("leaflet"))};document.head.append(s);
  });
  return leafletP;
}
function fmtAddr(r){
  const a=r.address||{};
  const street=a.road||a.pedestrian||a.footway||a.neighbourhood||a.suburb||"";
  const city=a.city||a.town||a.village||a.municipality||a.county||"";
  const line=[street&&(street+(a.house_number?", "+a.house_number:"")),city].filter(Boolean).join(", ");
  return line||String(r.display_name||"").split(",").slice(0,3).join(",").trim();
}
async function reverseGeocode(lat,lng){
  const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=uk&zoom=18&lat=${lat}&lon=${lng}`);
  if(!r.ok) throw new Error("geocode");
  return fmtAddr(await r.json());
}
function setMapAddr(t,loading){const el=$("mAddr");el.textContent=t;el.classList.toggle("loading",!!loading)}
function onMapMoved(){
  $("mapWrap").classList.remove("moving");
  const c=map.getCenter(),lat=+c.lat.toFixed(6),lng=+c.lng.toFixed(6),seq=++mapSeq;
  setMapAddr("Шукаємо адресу…",true);$("mConfirm").disabled=true;
  clearTimeout(mapTimer);
  mapTimer=setTimeout(async()=>{
    let address="";
    try{address=await reverseGeocode(lat,lng)}catch{}
    if(seq!==mapSeq) return;
    mapPick={lat,lng,address:address||`${lat}, ${lng}`};
    setMapAddr(address||"Адресу не визначено — уточніть її в полі замовлення",false);
    $("mConfirm").disabled=false;
  },450);
}
window.openMapPicker = async (cb,start)=>{
  mapCb=cb;mapPick=null;
  openModal("mmodal");setMapAddr("Завантажуємо мапу…",true);$("mConfirm").disabled=true;
  $("mSearch").value="";$("mResults").classList.add("hidden");
  try{await loadLeaflet()}catch{setMapAddr("Не вдалося завантажити мапу. Введіть адресу вручну.",false);return}
  if(!map){
    map=L.map("map",{zoomControl:false,attributionControl:true,minZoom:11,maxBounds:MAP_BOUNDS,maxBoundsViscosity:.9}).setView(MAP_CENTER,MAP_ZOOM);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
    L.control.zoom({position:"bottomright"}).addTo(map);
    map.on("movestart",()=>$("mapWrap").classList.add("moving"));
    map.on("moveend",onMapMoved);
  }
  const c=okGeo(start)?[start.lat,start.lng]:null, reuse=mapUsed;
  mapUsed=true;
  setTimeout(()=>{
    map.invalidateSize();
    if(c) map.setView(c,17); else if(!reuse) map.setView(MAP_CENTER,MAP_ZOOM);   // повторно відкриваємо там, де зупинились
    onMapMoved();
  },80);
};
let mapUsed=false;
window.mapLocate = ()=>{
  if(!navigator.geolocation) return toast("Геолокація недоступна у цьому браузері");
  toast("Визначаємо ваше місцезнаходження…");
  navigator.geolocation.getCurrentPosition(
    p=>map&&map.flyTo([p.coords.latitude,p.coords.longitude],17,{duration:.8}),
    ()=>toast("Не вдалося визначити місце. Дозвольте доступ до геолокації або знайдіть адресу пошуком"),
    {enableHighAccuracy:true,timeout:10000});
};
$("mSearch").addEventListener("input",()=>{
  clearTimeout(searchTimer);const q=$("mSearch").value.trim(),box=$("mResults");
  if(q.length<3){box.classList.add("hidden");return}
  searchTimer=setTimeout(async()=>{
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=uk&countrycodes=${MAP_COUNTRY}&viewbox=${MAP_BOUNDS[0][1]},${MAP_BOUNDS[1][0]},${MAP_BOUNDS[1][1]},${MAP_BOUNDS[0][0]}&bounded=1&q=${encodeURIComponent(q)}`);
      const list=await r.json();
      box.innerHTML=list.length?list.map((x,i)=>`<button type="button" data-i="${i}">📍 ${esc(fmtAddr(x)||x.display_name)}<small>${esc(String(x.display_name||"").split(",").slice(-3).join(",").trim())}</small></button>`).join(""):`<div class="mnone">Нічого не знайдено в місті ${esc(DELIVERY_CITY)}. Спробуйте інакше або посуньте мапу</div>`;
      box._list=list;box.classList.remove("hidden");
    }catch{box.innerHTML='<div class="mnone">Помилка пошуку, спробуйте ще раз</div>';box.classList.remove("hidden")}
  },550);
});
$("mResults").addEventListener("click",e=>{
  const b=e.target.closest("button[data-i]");if(!b||!map)return;
  const x=$("mResults")._list[+b.dataset.i];
  $("mResults").classList.add("hidden");$("mSearch").value=fmtAddr(x)||"";
  map.flyTo([+x.lat,+x.lon],17,{duration:.8});
});
window.mapConfirm = ()=>{
  if(!mapPick) return toast("Спершу виберіть точку на мапі");
  const cb=mapCb;closeModal("mmodal");if(cb)cb(mapPick);
};
window.pickCheckoutAddress = ()=>openMapPicker(p=>{
  $("fAddr").value=p.address;pickedGeo={lat:p.lat,lng:p.lng};updateGeoChip();
  toast("Адресу вибрано ✓ Додайте під'їзд чи квартиру в полі адреси");
  $("fAddr").focus();
},pickedGeo);
window.pickProfileAddress = ()=>openMapPicker(p=>{
  $("prAddr").value=p.address;profGeo={lat:p.lat,lng:p.lng};
  const n=$("prGeoNote");if(n)n.classList.remove("hidden");
  toast("Адресу вибрано ✓ Натисніть «Зберегти»");
},profGeo);

/* ---------- Профіль ---------- */
const profKey=()=>"profile_"+(user?user.uid:"anon");
function getProfile(){try{return JSON.parse(localStorage.getItem(profKey())||"{}")}catch{return {}}}
function setProfile(p){try{localStorage.setItem(profKey(),JSON.stringify(p))}catch{}}
function rememberProfile(name,phone,address,geo){ if(!user)return; const p=getProfile(); const keep=!!p.address; setProfile({name:p.name||name,phone:p.phone||phone,address:p.address||address,geo:keep?p.geo:(geo||null)}); renderProfile(); }
function fillCheckoutFromProfile(){
  const p=user?getProfile():{};
  if(!$("fName").value) $("fName").value=p.name||(user&&user.displayName)||"";
  if(!$("fPhone").value) $("fPhone").value=p.phone||"";
  if(!$("fAddr").value&&p.address){ $("fAddr").value=p.address; pickedGeo=p.geo||null; updateGeoChip(); }
}
window.saveProfileForm = ()=>{
  const name=$("prName").value.trim(),phone=$("prPhone").value.trim(),address=$("prAddr").value.trim();
  if(phone&&!/^[+\d\s()-]{9,}$/.test(phone)) return toast("Перевірте номер телефону");
  setProfile({name,phone,address,geo:profGeo});
  $("fName").value=name||$("fName").value;$("fPhone").value=phone;$("fAddr").value=address;
  toast("Дані збережено ✓");
};
function renderProfile(){
  const box=$("profileBox");if(!box)return;
  const ae=document.activeElement;
  if(ae&&box.contains(ae)&&ae.tagName==="INPUT") return;      // не заважаємо вводу тексту
  if(!user){
    box.innerHTML=`<div class="panel pcenter"><div class="pavatar">👤</div><h3>Увійдіть у профіль</h3>
      <p>Увійдіть через Google, щоб оформлювати замовлення, зберігати адресу доставки та бачити історію замовлень.</p>
      <button class="btn big" onclick="login()">Увійти через Google</button></div>`;
    return;
  }
  const p=getProfile(), nm=user.displayName||user.email||"Користувач";
  profGeo=p.geo||null;
  const active=myOrders.filter(o=>o.status==="new"||o.status==="process").length;
  const spent=myOrders.filter(o=>o.status!=="cancel").reduce((s,o)=>s+(o.total||0),0);
  const av=user.photoURL?`<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`:esc(nm.trim().charAt(0).toUpperCase());
  const last=myOrders.slice(0,3).map(o=>`<div class="oline"><span>${dt(o)} · ${fmt(o.total)}</span>${badge(o.status)}</div>`).join("");
  box.innerHTML=`
    <div class="panel phead"><div class="pavatar">${av}</div>
      <div><h3>${esc(nm)}</h3><div class="pmail">${esc(user.email||"")}</div>${isAdmin?'<span class="badge s-process">Адміністратор</span>':""}</div></div>
    <div class="admin-stats pstats"><div><b>${myOrders.length}</b><span>замовлень</span></div><div><b>${active}</b><span>у роботі</span></div><div><b>${fmt(spent)}</b><span>сума покупок</span></div></div>
    <div class="panel"><h3>Дані для доставки</h3>
      <p style="color:var(--mut);font-size:14px;margin:4px 0 0">Підставляться в кошик автоматично.</p>
      <label>Ім'я</label><input id="prName" value="${esc(p.name||user.displayName||"")}" autocomplete="name">
      <label>Телефон</label><input id="prPhone" type="tel" value="${esc(p.phone||"")}" placeholder="+380..." autocomplete="tel">
      <label>Адреса</label><div class="addrrow"><input id="prAddr" value="${esc(p.address||"")}" placeholder="Вулиця, будинок, квартира" autocomplete="street-address"><button type="button" class="btn ghost" onclick="pickProfileAddress()">📍 На мапі</button></div>
      <div id="prGeoNote" class="geochip ${profGeo?"":"hidden"}"><span>📍 Точку на мапі збережено</span></div>
      <div style="margin-top:16px"><button class="btn" onclick="saveProfileForm()">Зберегти</button></div></div>
    <div class="panel"><h3>Останні замовлення</h3><div class="olist">${last||'<p style="color:var(--mut);margin-top:8px">Замовлень поки немає.</p>'}</div>
      ${myOrders.length?'<div style="margin-top:14px"><button class="btn ghost sm" onclick="go(\'orders\')">Усі замовлення →</button></div>':""}</div>
    <div class="pactions">${isAdmin?'<button class="btn" onclick="go(\'admin\')">⚙️ Адмін-панель</button>':""}<button class="btn ghost" onclick="logout()">Вийти з акаунта</button></div>`;
}

/* ---------- Навігація ---------- */
window.go = v=>{
  if(v==="orders"&&!user){ go("profile"); return; }
  if(v==="admin"&&!isAdmin) return;
  current=v;
  for(const s of ["shop","cart","orders","profile","admin"]){const el=$("v-"+s);el.classList.toggle("hidden",s!==v);if(s===v){el.style.animation="none";el.offsetHeight;el.style.animation=""}}
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===v));
  if(v==="cart") {renderCart();fillCheckoutFromProfile()}
  if(v==="profile") renderProfile();
  if(v==="admin") {renderAdmin();renderAdminProducts()}
  scrollTo({top:0,behavior:reduce?"auto":"smooth"});
};

/* ---------- Товари (з бази, або стандартні) ---------- */
let unsubProducts=null, prodRetry=null;
function subscribeProducts(){
  unsubProducts&&unsubProducts();clearTimeout(prodRetry);
  unsubProducts=onSnapshot(collection(db,"products"),s=>{
    DB_PRODUCTS=s.docs.map(d=>({id:d.id,...d.data()})).sort(bySort);
    PRODUCTS = DB_PRODUCTS.length ? DB_PRODUCTS.filter(p=>!p.hidden) : DEFAULT_PRODUCTS.slice();
    afterProducts();
  },e=>{
    console.warn("products:",e.code);cleanCart();
    if(isAdmin) toast("Не вдалося завантажити товари: "+e.code+" — перевірте правила Firestore");
    prodRetry=setTimeout(subscribeProducts,5000);   // після помилки Firebase закриває підписку — відновлюємо
  });
}
function afterProducts(){cleanCart();saveCart();renderChips();renderProducts();if(current==="cart")renderCart();renderAdminProducts()}
const getP = id=>PRODUCTS.find(p=>p.id===id);
function cleanCart(){for(const id of Object.keys(cart)) if(!getP(id)) delete cart[id]; saveCart()}
const cartEntries=()=>Object.entries(cart).map(([id,q])=>[getP(id),q]).filter(([p])=>p);

function renderChips(){
  const used=new Set(PRODUCTS.map(p=>p.cat));
  if(catFilter!=="all"&&!used.has(catFilter)) catFilter="all";
  $("chips").innerHTML=Object.entries(CATS).filter(([k])=>k==="all"||used.has(k))
    .map(([k,v])=>`<button class="chip ${k===catFilter?"on":""}" onclick="setCat('${k}')">${esc(v)}</button>`).join("");
}
window.setCat=k=>{catFilter=k;renderChips();renderProducts()};
function renderProducts(){
  const list=PRODUCTS.filter(p=>catFilter==="all"||p.cat===catFilter);
  $("products").innerHTML = list.length ? list.map((p,i)=>`
    <div class="card reveal" style="transition-delay:${Math.min(i,12)*60}ms">
      ${p.hit?'<span class="tag">🔥 Хіт</span>':""}
      <div class="ic">${safeUrl(p.img)?`<img class="pimg" src="${esc(safeUrl(p.img))}" alt="" loading="lazy">`:`<span>${esc(p.em||"💧")}</span>`}</div>
      <h3>${esc(p.name)}</h3>
      <div class="d">${esc(p.desc)}</div>
      <div class="row"><span class="price">${fmt(p.price)}</span>
      <button class="btn sm" onclick="addToCart('${esc(p.id)}',this)">+ У кошик</button></div></div>`).join("")
    : '<div class="empty" style="grid-column:1/-1"><span class="e">🫗</span>Товарів поки немає. Зазирніть пізніше!</div>';
  observe();
}
/* 3D-нахил карток (тільки мишка) */
$("products").addEventListener("pointermove",e=>{
  if(reduce||e.pointerType!=="mouse")return;const c=e.target.closest(".card");if(!c)return;
  const r=c.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
  c.style.setProperty("--ry",((px-.5)*10).toFixed(2)+"deg");c.style.setProperty("--rx",((.5-py)*10).toFixed(2)+"deg");
  c.style.setProperty("--mx",px*100+"%");c.style.setProperty("--my",py*100+"%");
});
$("products").addEventListener("pointerout",e=>{const c=e.target.closest(".card");if(c&&!c.contains(e.relatedTarget)){c.style.setProperty("--rx","0deg");c.style.setProperty("--ry","0deg")}});

/* ---------- Кошик ---------- */
window.addToCart = (id,btn)=>{
  const p=getP(id);if(!p)return;
  cart[id]=(cart[id]||0)+1;saveCart();toast("Додано в кошик 💧");
  if(reduce||!btn)return;
  const a=btn.getBoundingClientRect(),b=($("cartBtn").offsetParent?$("cartBtn"):$("bnCart")).getBoundingClientRect();
  const f=document.createElement("div");f.className="fly";f.textContent=p.em||"💧";f.style.left=a.left+"px";f.style.top=a.top+"px";document.body.append(f);
  f.animate([{transform:"translate(0,0) scale(1.3)",opacity:1},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px) scale(.3)`,opacity:.4}],
    {duration:800,easing:"cubic-bezier(.5,-.3,.6,1)"}).onfinish=()=>f.remove();
};
window.chg = (id,d)=>{cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];saveCart();renderCart()};
function saveCart(){
  try{localStorage.setItem("cart",JSON.stringify(cart))}catch{}
  const n=cartEntries().reduce((a,[,q])=>a+q,0);
  for(const id of ["cartCount","cartCountM"]){const el=$(id);el.textContent=n;el.classList.toggle("hidden",!n);el.style.animation="none";el.offsetHeight;el.style.animation=""}
}
const cartTotal=()=>cartEntries().reduce((s,[p,q])=>s+p.price*q,0);

function renderCart(){
  const list=cartEntries();
  $("checkoutForm").classList.toggle("hidden",!list.length);
  if(!list.length){$("cartItems").innerHTML='<div class="empty"><span class="e">🫗</span>Кошик порожній.<br>Оберіть воду в каталозі!<br><br><button class="btn" onclick="go(\'shop\')">До каталогу</button></div>';return}
  $("cartItems").innerHTML = list.map(([p,q])=>`<div class="cartline"><div class="nm"><span class="em">${esc(p.em||"💧")}</span><div><b>${esc(p.name)}</b><br><small style="color:var(--mut)">${fmt(p.price)} / шт</small></div></div>
    <div class="qty"><button onclick="chg('${esc(p.id)}',-1)">−</button><b>${q}</b>
    <button onclick="chg('${esc(p.id)}',1)">+</button><b class="lsum">${fmt(p.price*q)}</b></div></div>`).join("")
    + `<div class="total">Разом: ${fmt(cartTotal())}</div>`;
}
/* способи оплати у формі */
(function initPay(){
  const s=$("fPay");
  s.innerHTML=Object.entries(PAYMENTS).filter(([k])=>k!=="transfer"||PAY_CARD).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("");
})();

/* ---------- Замовлення ---------- */
window.placeOrder = async ()=>{
  if(!configured) return toast("Спочатку налаштуйте Firebase (README.md)");
  if(!user) return toast("Для замовлення увійдіть через Google");
  const name=$("fName").value.trim(),phone=$("fPhone").value.trim(),addr=$("fAddr").value.trim(),payment=$("fPay").value;
  if(!name||!/^[+\d\s()-]{9,}$/.test(phone)||!addr) return toast("Заповніть ім'я, коректний телефон і адресу");
  const entries=cartEntries();
  if(!entries.length) return toast("Кошик порожній");
  const items=entries.map(([p,q])=>({id:p.id,name:p.name,price:p.price,qty:q}));
  const total=cartTotal(),note=$("fNote").value.trim();
  $("orderBtn").disabled=true;
  try{
    await addDoc(collection(db,"orders"),{
      uid:user.uid,email:user.email,name,phone,address:addr,note,payment,geo:pickedGeo||null,
      items,total,status:"new",createdAt:serverTimestamp()});
    notifyTelegram({name,phone,address:addr,note,payment,items,total,email:user.email,geo:pickedGeo||null});
    rememberProfile(name,phone,addr,pickedGeo);pickedGeo=null;updateGeoChip();cart={};saveCart();confetti();toast("Дякуємо! Замовлення прийнято ✅");go("orders");
    if(payment==="transfer"&&PAY_CARD) showPayInfo(total,phone);
  }catch(e){toast("Помилка: "+e.code)}
  $("orderBtn").disabled=false;
};
window.testTelegram = async ()=>{
  if(!NOTIFY_URL) return toast("Telegram вимкнено: впишіть NOTIFY_URL у app.js");
  toast("Надсилаємо тест…");
  try{
    const token=await user.getIdToken();
    const r=await fetch(NOTIFY_URL,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({token,order:{test:true,name:"Тест",phone:"+380000000000",address:"Тестова адреса",items:[{name:"Тестовий товар",qty:1,price:1}],total:1,payment:"cash"}})});
    const t=(await r.text()).slice(0,140);
    if(r.ok) toast("✅ Надіслано! Перевірте Telegram");
    else if(r.status===404) toast("Функцію не знайдено — завантажте на Vercel папку api і зробіть деплой");
    else if(r.status===500) toast("Не налаштовані змінні на Vercel (токен, chat id, api key) або не зроблено Redeploy");
    else if(r.status===401) toast("Помилка перевірки входу — перевірте FIREBASE_API_KEY на Vercel");
    else toast("Telegram: "+t);
  }catch{toast("Не вдалося звернутися до сервера")}
};
async function notifyTelegram(order){
  if(!NOTIFY_URL) return;
  try{
    const token=await user.getIdToken();
    fetch(NOTIFY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,order})}).catch(()=>{});
  }catch{}
}
function showPayInfo(total,phone){
  $("imodalBody").innerHTML=`<h3>💳 Оплата переказом</h3>
    <p style="margin:12px 0">Переведіть <b>${fmt(total)}</b> на картку:</p>
    <div class="cardnum">${esc(PAY_CARD)}</div>
    ${PAY_CARD_HOLDER?`<p style="margin:8px 0;color:var(--mut)">Отримувач: <b style="color:var(--ink)">${esc(PAY_CARD_HOLDER)}</b></p>`:""}
    <p style="margin:8px 0;color:var(--mut)">У призначенні платежу вкажіть ваш телефон: <b style="color:var(--ink)">${esc(phone)}</b></p>
    <button class="btn" style="margin-top:12px" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(PAY_CARD).replace(/\s/g,"")}').then(()=>toast('Номер картки скопійовано'))">Скопіювати номер</button>`;
  openModal("imodal");
}

const itemsHtml = o=>o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join("<br>");
const badge = s=>`<span class="badge s-${esc(s)}">${esc(STATUS[s]||s)}</span>`;
const emptyBox=t=>`<div class="empty"><span class="e">💧</span>${t}</div>`;

function renderMy(){
  $("myOrders").innerHTML = myOrders.length ? `<table><thead><tr><th>Дата</th><th>Товари</th><th>Сума</th><th>Оплата</th><th>Статус</th></tr></thead><tbody>`+
    myOrders.map((o,i)=>`<tr style="animation-delay:${i*50}ms"><td data-l="Дата">${dt(o)}</td><td data-l="Товари"><div>${itemsHtml(o)}</div></td><td data-l="Сума"><b>${fmt(o.total)}</b></td><td data-l="Оплата">${esc(PAYMENTS[o.payment]||"—")}</td><td data-l="Статус">${badge(o.status)}</td></tr>`).join("")+`</tbody></table>`
    : emptyBox("У вас ще немає замовлень.");
  renderProfile();
}

/* ---------- Адмін: вкладки ---------- */
window.adminTabSet = t=>{
  adminTab=t;
  $("tabOrders").classList.toggle("on",t==="orders");$("tabProducts").classList.toggle("on",t==="products");
  $("a-orders").classList.toggle("hidden",t!=="orders");$("a-products").classList.toggle("hidden",t!=="products");
};

/* ---------- Адмін: замовлення ---------- */
window.renderAdmin = ()=>{
  const f=$("adminFilter").value, list=allOrders.filter(o=>!f||o.status===f);
  const cnt=s=>allOrders.filter(o=>o.status===s).length, nNew=cnt("new");
  $("tabOrders").textContent="📦 Замовлення"+(nNew?` (${nNew})`:"");
  const bb=$("bnAdminB");bb.textContent=nNew;bb.classList.toggle("hidden",!nNew);
  $("adminStats").innerHTML=`<div><b>${allOrders.length}</b><span>усього замовлень</span></div><div><b>${nNew}</b><span>нових</span></div>
    <div><b>${cnt("process")}</b><span>в обробці</span></div><div><b>${fmt(allOrders.filter(o=>o.status==="done").reduce((s,o)=>s+o.total,0))}</b><span>виручка (виконані)</span></div>`;
  $("adminOrders").innerHTML = list.length ? `<table><thead><tr><th>Дата</th><th>Клієнт</th><th>Доставка</th><th>Товари</th><th>Сума / оплата</th><th>Статус</th></tr></thead><tbody>`+
    list.map((o,i)=>`<tr style="animation-delay:${Math.min(i,10)*40}ms"><td data-l="Дата">${dt(o)}</td>
    <td data-l="Клієнт"><div><b>${esc(o.name)}</b><br><a href="tel:${esc(o.phone)}" style="color:var(--blue);font-weight:700">📞 ${esc(o.phone)}</a><br><small style="color:var(--mut)">${esc(o.email)}</small></div></td>
    <td data-l="Доставка"><div>${esc(o.address)}${geoLink(o)}${o.note?`<br><small style="color:var(--mut)">💬 ${esc(o.note)}</small>`:""}</div></td>
    <td data-l="Товари"><div>${itemsHtml(o)}</div></td>
    <td data-l="Сума"><div><b>${fmt(o.total)}</b><br><small style="color:var(--mut)">${esc(PAYMENTS[o.payment]||"—")}</small></div></td>
    <td data-l="Статус"><select class="st-${esc(o.status)}" onchange="setStatus('${esc(o.id)}',this.value)">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${k===o.status?"selected":""}>${v}</option>`).join("")}</select></td></tr>`).join("")+`</tbody></table>`
    : emptyBox("Замовлень немає.");
};
window.setStatus = async (id,s)=>{try{await updateDoc(doc(db,"orders",id),{status:s});toast("Статус оновлено ✓")}catch(e){toast("Помилка: "+e.code)}};

/* ---------- Адмін: товари ---------- */
window.renderAdminProducts = ()=>{
  const box=$("adminProducts");if(!box)return;
  const q=$("pSearch").value.trim().toLowerCase();
  let html="";
  if(!DB_PRODUCTS.length) html=`<div class="seed"><b>База товарів порожня</b><p>Зараз на сайті показані стандартні товари. Щоб їх редагувати, імпортуйте їх у базу (робиться один раз).</p><button class="btn" onclick="seedProducts()">Імпортувати ${DEFAULT_PRODUCTS.length} товарів</button></div>`;
  const list=DB_PRODUCTS.filter(p=>!q||String(p.name||"").toLowerCase().includes(q));
  html+=list.map(p=>`<div class="arow ${p.hidden?"off":""}">
    <div class="aic">${safeUrl(p.img)?`<img src="${esc(safeUrl(p.img))}" alt="">`:esc(p.em||"💧")}</div>
    <div class="ainfo"><b>${esc(p.name)}</b><small>${esc(CATS[p.cat]||"—")}${p.hit?" · 🔥 Хіт":""}${p.hidden?" · приховано":""}</small></div>
    <div class="aact"><button class="icon-sm" title="Показати / сховати" onclick="toggleHidden('${esc(p.id)}')">${p.hidden?"🙈":"👁️"}</button><button class="icon-sm" title="Редагувати" onclick="editProduct('${esc(p.id)}')">✏️</button></div>
    <label class="aprice"><span>Ціна</span><input type="number" inputmode="numeric" min="0" step="1" value="${Number(p.price)||0}" onchange="quickPrice('${esc(p.id)}',this)"><span>₴</span></label></div>`).join("");
  if(DB_PRODUCTS.length&&!list.length) html+=emptyBox("Нічого не знайдено.");
  box.innerHTML=html;
};
window.quickPrice = async (id,el)=>{
  const v=Math.round(Number(el.value));
  if(!Number.isFinite(v)||v<0){toast("Введіть коректну ціну");renderAdminProducts();return}
  try{await updateDoc(doc(db,"products",id),{price:v});toast("Ціну збережено ✓")}catch(e){toast("Помилка: "+e.code)}
};
window.toggleHidden = async id=>{
  const p=DB_PRODUCTS.find(x=>x.id===id);if(!p)return;
  try{await updateDoc(doc(db,"products",id),{hidden:!p.hidden});toast(p.hidden?"Товар показано на сайті":"Товар приховано")}catch(e){toast("Помилка: "+e.code)}
};
window.seedProducts = async ()=>{
  if(!isAdmin) return;
  try{
    const b=writeBatch(db);
    DEFAULT_PRODUCTS.forEach((p,i)=>{const {id,...rest}=p;b.set(doc(db,"products",id),{...rest,sort:i,hidden:false})});
    await b.commit();toast("Товари імпортовано ✓");
  }catch(e){toast("Помилка: "+e.code+" (перевірте правила Firestore)")}
};
function fillCatSelect(){$("pfCat").innerHTML=Object.entries(CATS).filter(([k])=>k!=="all").map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}
$("pfEmojis").innerHTML=EMOJIS.map(e=>`<button type="button" onclick="pickEmoji('${e}')">${e}</button>`).join("");
window.pickEmoji = e=>{$("pfEm").value=e;if(!formImg)syncImgUI()};

/* ---------- Фото товару: завантаження зі стисненням ---------- */
function compressImage(file,maxSide=640,maxBytes=110000){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let scale=Math.min(1,maxSide/Math.max(img.width,img.height)),q=.82,out="";
      for(let i=0;i<10;i++){
        const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
        const c=document.createElement("canvas");c.width=w;c.height=h;
        const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);   // білий фон для прозорих PNG
        out=c.toDataURL("image/jpeg",q);
        if(out.length*0.75<=maxBytes)break;
        if(q>.52)q-=.1;else scale*=.8;
      }
      res(out);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("bad image"))};
    img.src=url;
  });
}
function syncImgUI(){
  const has=!!safeUrl(formImg);
  $("pfPrev").innerHTML=has?`<img src="${esc(formImg)}" alt="">`:esc($("pfEm").value||"💧");
  $("pfImg").value=formImg.startsWith("data:")?"":formImg;
  $("pfImgClear").classList.toggle("hidden",!formImg);
  $("pfImgInfo").textContent=formImg.startsWith("data:")?`Фото додано (~${Math.round(formImg.length*0.75/1024)} КБ)`:"";
}
window.imgUrlInput = ()=>{
  formImg=$("pfImg").value.trim();
  const has=!!safeUrl(formImg);
  $("pfPrev").innerHTML=has?`<img src="${esc(formImg)}" alt="">`:esc($("pfEm").value||"💧");
  $("pfImgClear").classList.toggle("hidden",!formImg);
};
window.clearImg = ()=>{formImg="";syncImgUI()};
$("pfFile").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value="";
  if(!f) return;
  if(!/^image\//.test(f.type)) return toast("Оберіть файл із зображенням");
  toast("Обробка фото…");
  try{formImg=await compressImage(f);syncImgUI();toast("Фото додано ✓")}catch{toast("Не вдалося прочитати фото")}
});
$("pfEm").addEventListener("input",()=>{if(!formImg)syncImgUI()});

window.editProduct = id=>{
  fillCatSelect();
  const p=id?DB_PRODUCTS.find(x=>x.id===id):null;
  editingId=p?p.id:null;
  $("pmTitle").textContent=p?"Редагувати товар":"Новий товар";
  $("pfName").value=p?.name||"";$("pfEm").value=p?.em||"💧";$("pfCat").value=p?.cat||"bottle";
  $("pfPrice").value=p?Number(p.price)||0:"";$("pfDesc").value=p?.desc||"";formImg=p?.img||"";syncImgUI();
  $("pfHit").checked=!!p?.hit;$("pfHidden").checked=!!p?.hidden;
  $("pfDelete").classList.toggle("hidden",!p);
  openModal("pmodal");
};
window.saveProduct = async ()=>{
  const name=$("pfName").value.trim(),price=Math.round(Number($("pfPrice").value));
  if(!name) return toast("Вкажіть назву товару");
  if(!Number.isFinite(price)||price<0||$("pfPrice").value==="") return toast("Вкажіть коректну ціну");
  const img=formImg;
  if(img&&!safeUrl(img)) return toast("Посилання на фото має починатися з https://");
  const data={name,price,em:$("pfEm").value.trim()||"💧",cat:$("pfCat").value,desc:$("pfDesc").value.trim(),img,hit:$("pfHit").checked,hidden:$("pfHidden").checked};
  $("pfSave").disabled=true;
  try{
    if(editingId) await updateDoc(doc(db,"products",editingId),data);
    else await addDoc(collection(db,"products"),{...data,sort:DB_PRODUCTS.reduce((m,p)=>Math.max(m,p.sort??0),0)+1,createdAt:serverTimestamp()});
    closeModal("pmodal");toast("Товар збережено ✓");
  }catch(e){toast("Помилка: "+e.code+" (перевірте правила Firestore)")}
  $("pfSave").disabled=false;
};
window.deleteProduct = async ()=>{
  if(!editingId) return;
  if(!confirm("Видалити цей товар назавжди?")) return;
  try{await deleteDoc(doc(db,"products",editingId));closeModal("pmodal");toast("Товар видалено")}catch(e){toast("Помилка: "+e.code)}
};

/* ---------- Старт (після оголошення всіх функцій) ---------- */
if(configured){
  const cfg={...firebaseConfig};
  if(IS_MOBILE&&MOBILE_REDIRECT_LOGIN&&location.hostname!=="localhost") cfg.authDomain=location.host;   // вхід через ваш домен (проксі у vercel.json)
  const app = initializeApp(cfg);
  auth = getAuth(app); db = getFirestore(app);
  getRedirectResult(auth).then(r=>{if(r&&r.user)toast("Вітаємо! 👋")}).catch(e=>toast("Не вдалося увійти: "+e.code));
  onAuthStateChanged(auth, onUser);
  subscribeProducts();
} else { $("cfgbanner").classList.remove("hidden"); cleanCart(); }
renderChips();renderProducts();saveCart();observe();
