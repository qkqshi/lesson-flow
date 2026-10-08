# Lesson Flow — Telegram Mini App преподавателя

Личное расписание, связанное с Google Calendar. Приложение показывает события за выбранный день, позволяет создавать, менять и удалять уроки, а бот ежедневно в 08:00 по Самаре присылает сводку.

## Что уже заложено

- проверка подписи Telegram Mini App и доступ только для разрешённых Telegram ID;
- Google OAuth 2.0 с offline-доступом и зашифрованным refresh token;
- чтение и CRUD событий основного Google Calendar;
- автоматический список учеников по названиям событий;
- индивидуальная цена занятия и прогноз дохода за выбранный месяц;
- ежедневная идемпотентная отправка расписания;
- Telegram webhook для команды `/start`;
- локальный демо-режим без внешних ключей;
- мобильный интерфейс с поддержкой светлой и тёмной темы Telegram.

## Локальный запуск

Нужны Node.js **24.x** и npm. Версия Node указана в `.nvmrc` и
`package.json`; зависимости закреплены в `package-lock.json`.

В PowerShell:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

В macOS/Linux вместо `Copy-Item` используйте `cp .env.example .env.local`.
Откройте `http://localhost:3000`. В development демо-режим включается автоматически,
если `DEMO_MODE` пуст или не задан. Он работает без ключей и базы данных.
Демо-события временно хранятся в памяти процесса. Для локальной работы с настоящими
интеграциями установите `DEMO_MODE=false` и заполните переменные ниже.

## Подключение PostgreSQL

1. Создайте базу PostgreSQL.
2. Выполните `database/schema.sql`.
3. Укажите `DATABASE_URL` в `.env.local`.

## Настройка Google Calendar

1. Создайте проект в Google Cloud.
2. Включите Google Calendar API.
3. Создайте OAuth Client типа **Web application**.
4. Добавьте URI из `GOOGLE_REDIRECT_URI` в Authorized redirect URIs.
5. Укажите `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` и `GOOGLE_REDIRECT_URI`.
6. Для постоянного личного использования не оставляйте External-приложение в статусе Testing: Calendar refresh token иначе истечёт через 7 дней.

Google OAuth открывается во внешнем браузере, потому что Google не поддерживает OAuth во встроенном Telegram WebView.

## Статистика учеников

Ученик определяется по названию события с указанным временем; события на весь
день в статистику не входят. Одинаковые имена объединяются без учёта регистра и
лишних пробелов. Неподходящее имя можно удалить из списка — оно не появится
снова при очередной синхронизации календаря.

Для текущего и прошедших месяцев приложение считает фактические занятия из
Google Calendar. Для будущих месяцев количество занятий задаётся вручную по
каждому ученику и умножается на сохранённую цену. По умолчанию вкладка открывает
следующий месяц. Доход, цены, планы и скрытые ученики каждого
Telegram-администратора хранятся отдельно.

## Настройка Telegram

1. Создайте бота через `@BotFather`.
2. Укажите HTTPS URL приложения как Mini App URL.
3. Запишите числовые Telegram ID администраторов через запятую в
   `ALLOWED_TELEGRAM_USER_IDS`, например `123456789,987654321`.
   Для старой конфигурации с одним администратором по-прежнему поддерживается
   `ALLOWED_TELEGRAM_USER_ID`.
4. Укажите токен, username и случайный `TELEGRAM_WEBHOOK_SECRET`.
5. После деплоя зарегистрируйте webhook:

```text
POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
url=https://your-app.example.com/api/telegram/webhook
secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## Ежедневное уведомление

`vercel.json` вызывает `/api/cron/daily-reminder` в 04:00 UTC — это 08:00 в `Europe/Samara`. Запрос защищён переменной `CRON_SECRET`, а уникальная запись в `notification_delivery` предотвращает повторную отправку каждому администратору за одну дату. Google Calendar подключается отдельно под каждым Telegram-аккаунтом.

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm audit --omit=dev
npm run build
```

`typecheck` сначала запускает `next typegen`, поэтому работает и в чистой копии
проекта без `.next` и `next-env.d.ts`. Эти файлы генерируются автоматически.
GitHub Actions выполняет перечисленные проверки на push в `main`, pull request
и ручном запуске. Для CI внешние ключи не нужны: сборка не обращается к базе,
Google или Telegram.

На 8 октября 2026 года полный `npm audit` сообщает о пяти связанных high findings
в цепочке ESLint (`braces → micromatch → fast-glob → @next/eslint-plugin-next →
eslint-config-next`). Это зависимости разработки, они не используются обработчиками
запросов приложения. Для [уязвимости braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
исправленной версии пока нет. Предлагаемый npm откат `eslint-config-next` до 14.x
несовместим с текущей настройкой ESLint и не применяется. CI отдельно проверяет
production-зависимости через `npm audit --omit=dev`; результаты полного аудита
нужно пересмотреть при обновлении ESLint или публикации исправления braces.

## Производственный режим

Перед деплоем установите `DEMO_MODE=false`. Секреты задаются в Vercel, а локально —
в `.env.local`. `.env.example` содержит только шаблон. Никогда не передавайте
`TELEGRAM_BOT_TOKEN`, Google Client Secret, refresh token или ключ шифрования
в клиентский код и переменные с префиксом `NEXT_PUBLIC_`.

| Переменная | Значение в Vercel Production |
| --- | --- |
| `DEMO_MODE` | `false` |
| `APP_URL` | Постоянный HTTPS URL приложения без завершающего `/` |
| `TELEGRAM_BOT_TOKEN` | Токен бота из BotFather |
| `TELEGRAM_BOT_USERNAME` | Username бота, например `your_teacher_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Случайная строка для проверки webhook |
| `ALLOWED_TELEGRAM_USER_IDS` | Разрешённые числовые ID через запятую |
| `GOOGLE_CLIENT_ID` | ID OAuth Client типа Web application |
| `GOOGLE_CLIENT_SECRET` | Секрет того же OAuth Client |
| `GOOGLE_REDIRECT_URI` | `https://your-app.example.com/api/google/callback` |
| `DATABASE_URL` | Строка подключения к PostgreSQL с настройками TLS провайдера |
| `SESSION_SECRET` | Отдельная случайная строка длиной не менее 32 символов |
| `TOKEN_ENCRYPTION_KEY` | Случайные 32 байта в Base64 |
| `CRON_SECRET` | Отдельная случайная строка для cron и настройки бота |

`ALLOWED_TELEGRAM_USER_ID` — необязательный устаревший вариант для одного
администратора. Достаточно заполнить `ALLOWED_TELEGRAM_USER_IDS`.

Для каждой из переменных `SESSION_SECRET`, `CRON_SECRET` и
`TELEGRAM_WEBHOOK_SECRET` выполните команду отдельно и сохраните результат только
в переменных окружения:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Для `TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Репозиторий GitHub

Для личного приложения рекомендуется приватный репозиторий. Создайте пустой
репозиторий без автоматически добавленных README и `.gitignore`. В проект уже
добавлены правила исключения секретов, зависимостей, сборок и локальных настроек
Vercel. `AGENTS.md` и `CLAUDE.md` сохраняются как инструкции для работы с кодом.

Перед первой отправкой выполните проверки выше и просмотрите состав коммита:

```bash
git add .
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Prepare Lesson Flow for deployment"
git remote add origin https://github.com/qkqshi/lesson-flow.git
git push -u origin main
```

Для другого репозитория замените URL на свой. Эти команды предполагают,
что локальный Git-репозиторий уже инициализирован с веткой `main`, а `origin`
ещё не настроен.

## Деплой на Vercel из GitHub

1. Подготовьте PostgreSQL и выполните `database/schema.sql` в выбранной базе.
2. В Vercel импортируйте GitHub-репозиторий. Если проект Vercel уже существует,
   подключите репозиторий в его **Settings → Git**, чтобы сохранить существующий URL.
3. Выберите **Next.js**, корень проекта `./`, Node.js **24.x** и production-ветку
   `main`. Установка — `npm ci`, сборка — `npm run build`; Output Directory
   оставьте стандартным для Next.js. Команда установки задана в `vercel.json`.
4. Добавьте переменные из таблицы в окружение **Production**. `APP_URL` и
   `GOOGLE_REDIRECT_URI` должны использовать один постоянный production-домен.
   Настройте этот redirect URI в Google OAuth Client.
5. Запустите деплой. После изменения переменных окружения выполните **Redeploy**.
6. В BotFather укажите production URL для Mini App. Настройте webhook и кнопку
   меню бота командой ниже либо зарегистрируйте webhook вручную, как описано выше.
7. Отправьте боту `/start`, откройте приложение и подключите Google Calendar под
   каждым разрешённым Telegram-аккаунтом.

[Интеграция Vercel с GitHub](https://vercel.com/docs/git/vercel-for-github)
разворачивает изменения production-ветки автоматически. Workflow `CI` проверяет
код отдельно; для него не нужно добавлять секреты Vercel, Google или Telegram
в GitHub Actions. Чтобы проверять изменения до production-деплоя, работайте через
pull request и требуйте успешный `CI / check` перед слиянием в `main`.

Для демонстрационных Preview задайте **только в окружении Preview**
`DEMO_MODE=true` и не добавляйте production-секреты. Если нужен Preview с настоящими
интеграциями, используйте отдельную базу, бота и OAuth Client с собственным
redirect URI.

Production URL должен быть доступен Telegram, Google OAuth и webhook без
дополнительного входа в Vercel. Доступ к данным проверяет само приложение.

### Настройка бота после деплоя

В локальном PowerShell задайте `$env:APP_URL` и `$env:CRON_SECRET` из своей
конфигурации, затем выполните:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "$env:APP_URL/api/telegram/setup" `
  -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

Этот защищённый endpoint проверяет соответствие токена username бота,
регистрирует webhook и задаёт кнопку «Расписание» в меню. Проверьте в ответе
`ok=true` и `lastWebhookError=null`.

### Проверка рабочего деплоя

- Главная страница, `/privacy` и `/terms` открываются по HTTPS.
- В Telegram доступ работает для разрешённого ID; посторонний ID получает отказ.
- Google OAuth возвращает страницу «Календарь подключён».
- Создание, изменение и удаление пробного урока отражаются в Google Calendar.
- Цена ученика и ручной план сохраняются после повторного открытия приложения.
- В Vercel виден cron `/api/cron/daily-reminder` с расписанием `0 4 * * *`.

Vercel передаёт `CRON_SECRET` в заголовке `Authorization: Bearer …` автоматически.
Правила выполнения, повторных запусков и защиты описаны в
[документации Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
Для cron настроено 04:00 UTC, то есть 08:00 по Самаре; точность запуска зависит
от тарифа Vercel. Ручной вызов cron с авторизацией отправляет реальные сообщения
и занимает запись доставки за текущий день, поэтому используйте его осознанно.
