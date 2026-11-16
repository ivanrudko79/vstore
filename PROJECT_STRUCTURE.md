# Структура проекта

- `src/` — React/TypeScript сайт: каталог, страницы и адаптивная тема.
- `data/apps.json`, `data/categories.json` — единый источник каталога и категорий.
- `public/` — статические иконки, favicon, robots и sitemap.
- `admin/server.js`, `admin/index.html` — локальная панель и API; сервер доступен только на loopback.
- `work/uploads/` — временные загруженные IPA (игнорируются Git).
- `assets/images/logo.png` — заменяемый временный логотип; `assets/images/social-preview.png` — социальное превью.
- `scripts/` — вспомогательные команды сборки и обслуживания.
- `.github/workflows/deploy.yml` — проверки, сборка и GitHub Pages.
- `START_ADMIN.bat` — запускает локальную панель на Windows.

Каталог генерирует карточки из `apps.json`; один объект содержит текущую версию, источник и историю версий. Демо-записи имеют `status: demo`, `distributionPermission: false` и не содержат downloadUrl.
