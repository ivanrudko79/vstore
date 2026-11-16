# VStore

Адаптивный каталог IPA для iOS на React, TypeScript и Vite. Включает локальную панель владельца, загрузку IPA в GitHub Releases и автоматическую сборку GitHub Pages. TrollStore включён в руководство наряду с AltStore, SideStore и Sideloadly.

## Запуск сайта

Установите Node.js 22+. В PowerShell из папки проекта выполните:

```powershell
npm install
npm run dev
```

Сборка: `npm run typecheck` и `npm run build`.

## Запуск панели

Дважды щёлкните `START_ADMIN.bat`. Панель открывается на `http://127.0.0.1:4178`. Node.js найден. Git найден. GitHub CLI на компьютере не найден; установите его с [cli.github.com](https://cli.github.com/) и выполните `gh auth login` для публикаций.

Полная инструкция: [ADMIN_GUIDE.md](ADMIN_GUIDE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md).

## Демо-данные

`data/apps.json` содержит три записи с явным статусом DEMO, без IPA и ссылок скачивания. Они проверяют отображение интерфейса и не выдаются за реальные приложения.

## Настройка проекта

Категории находятся в `data/categories.json`; приложения — в `data/apps.json`. Цвета, отступы, карточки и мобильная компоновка заданы в `src/styles.css`. Временная эмблема — `public/brand/mark.svg`, растровая копия — `assets/images/logo.png`, Apple Touch Icon — `public/apple-touch-icon.png`, социальное превью — `public/brand/social-preview.png`. Исходное изображение логотипа в доступных файлах не обнаружено, поэтому эти файлы можно заменить фирменной версией без изменения кода сайта.

## Ограничения

GitHub Pages не исполняет backend-код и не поддерживает безопасную пользовательскую авторизацию. Открытая публикация на GitHub Free требует публичного репозитория, поэтому исходники и каталог публичны. IPA публикуются как Release assets, не в Git. Проверяйте права на распространение и актуальные квоты GitHub. SHA-256 не является доказательством безопасности.
