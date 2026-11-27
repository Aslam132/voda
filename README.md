# H2O Alex — магазин питної води

Файли: `index.html` (розмітка), `assets/` (логотип і іконка), `api/` (Telegram-функція для Vercel), `vercel.json` (вхід через Google на телефонах), `SETUP-PAYMENT-TELEGRAM.md` (інструкція: оплата, Telegram, редагування товарів), `style.css` (стилі), `app.js` (логіка, товари, Firebase), `firestore.rules` (правила безпеки бази).

## Налаштування Firebase (≈5 хвилин, безкоштовно)

1. Зайдіть на https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** (вкажіть email підтримки).
3. **Build → Firestore Database → Create database** (production mode).
4. У Firestore відкрийте вкладку **Rules**, вставте вміст `firestore.rules`, замініть `admin@example.com` на Gmail адміністратора → **Publish**.
5. **Project settings (⚙️) → Your apps → Web (</>)** → зареєструйте застосунок і скопіюйте `firebaseConfig`.
6. У `app.js` вставте значення в `firebaseConfig` і замініть `ADMIN_EMAILS` на той самий Gmail адміністратора.
7. **Authentication → Settings → Authorized domains** — додайте домен, де буде сайт.

## Публікація

Вхід через Google не працює з файлу (`file://`). Розмістіть сайт на будь-якому хостингу:
- Vercel (через GitHub або `vercel --prod`), Firebase Hosting (`firebase deploy`), Netlify чи GitHub Pages.
- Для локальної перевірки: `python3 -m http.server` і відкрийте `http://localhost:8000` (localhost уже дозволений).

## Як це працює

- **Клієнт**: входить через Google → кладе воду в кошик → оформлює замовлення → бачить свої замовлення та їх статус.
- **Адмін** (Gmail зі списку `ADMIN_EMAILS`): з'являється кнопка «Адмін-панель» — усі замовлення в реальному часі, контакти клієнта, адреса, фільтр і зміна статусу.
- Товари та ціни редагуються в адмінці (⚙️ Адмін → 🛍️ Товари), див. `SETUP-PAYMENT-TELEGRAM.md`. Стандартні товари лежать у масиві `DEFAULT_PRODUCTS` у `app.js` (19 товарів у 5 категоріях).

## Важливо

Ціни рахуються в браузері, тож для великого магазину згодом варто перенести розрахунок суми на сервер (Cloud Functions).
