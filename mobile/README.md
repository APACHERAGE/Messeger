# Nightfall Messenger for iPhone

Это отдельный Expo/React Native-клиент для текущего Nightfall Messenger. Он использует тот же Spring Boot API.

## Запуск на iPhone через Expo Go

```bash
cd /path/to/Messeger/mobile
npm install
npm run start:iphone
```

Установи Expo Go на iPhone, подключи телефон и компьютер к одной Wi-Fi-сети и отсканируй QR-код из терминала. На экране входа укажи адрес, доступный с телефона:

- для LAN: `http://IP-КОМПЬЮТЕРА:8080`;
- для опубликованного сайта: его `https://`-адрес.

`localhost` на iPhone означает сам iPhone, поэтому для backend на компьютере он не подходит.

## Статус первой версии

Уже подключены вход, лента, лайки, комментарии, список чатов, сообщения и профиль. Вложения, push-уведомления и нативная сборка `.ipa` — следующий этап.

Для подписанной `.ipa` и публикации в App Store нужен macOS/Xcode либо облачная сборка EAS. Expo Go позволяет проверить клиент на iPhone без Mac.
