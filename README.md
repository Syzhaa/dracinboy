# Enviel Dramabox API

![Free](https://img.shields.io/badge/100%25-FREE-brightgreen?style=for-the-badge)
![Not For Sale](https://img.shields.io/badge/NOT%20FOR%20SALE-red?style=for-the-badge)

Free API for streaming drama content from DramaBox source. Supports multiple languages (English, Indonesian, Portuguese, Spanish).

## Quick Start

```bash
npm install
npm start
```

## API Endpoints

### Drama Lists

| Endpoint                            | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `GET /enviel/drama/featured`        | Featured dramas                           |
| `GET /enviel/drama/latest`          | Latest dramas                             |
| `GET /enviel/drama/rank?type=1`     | Ranking list                              |
| `GET /enviel/drama/channel/:id`     | By channel                                |
| `GET /enviel/drama/indo`            | Indonesian dubbed                         |
| `GET /enviel/drama/all`             | All dramas - paginated (use page & limit) |
| `GET /enviel/drama/fetch-all`       | All dramas - (~865 INDO)                  |
| `GET /enviel/drama/fetch-all-langs` | All dramas - multi-lang (~4530 unique)    |

> **Note:** `/all` returns per-page results, use `page` & `limit` params. `/fetch-all` auto-loops all pages and returns complete data.

### Search & Detail

| Endpoint                              | Description                  |
| ------------------------------------- | ---------------------------- |
| `GET /enviel/drama/search?q=keyword`  | Search dramas                |
| `GET /enviel/drama/suggest?q=keyword` | Search suggestions           |
| `GET /enviel/drama/episodes/:bookId`  | Episode list with video URLs |
| `GET /enviel/drama/detail/:bookId`    | Full drama detail            |

### Query Parameters

| Parameter | Default | Description                                |
| --------- | ------- | ------------------------------------------ |
| `page`    | 1       | Page number                                |
| `size`    | 20      | Items per page                             |
| `limit`   | 50      | Items per page (for /all endpoint)         |
| `type`    | 1       | Rank type (for /rank endpoint)             |
| `q`       | -       | Search query (required for search/suggest) |

## Supported Languages

| Code | Language   | Drama Count |
| ---- | ---------- | ----------- |
| `en` | English    | ~2000       |
| `in` | Indonesian | ~865        |
| `pt` | Portuguese | ~739        |
| `es` | Spanish    | ~926        |

Total unique dramas: **~4500+**

## Example Response

### Drama List

```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "bookId": "42000003894",
      "title": "Gawat! Salah Masuk Kamar Kakak Ipar",
      "cover": "https://...",
      "intro": "Deskripsi drama...",
      "chapterCount": 124,
      "playCount": "12.5M"
    }
  ]
}
```

### Multi-Language Fetch

```json
{
  "status": true,
  "message": "Success",
  "total": 4530,
  "stats": {
    "en": 2000,
    "in": 865,
    "pt": 739,
    "es": 926
  },
  "languages": ["en", "in", "pt", "es"],
  "data": [...]
}
```

### Episodes

```json
{
  "status": true,
  "total": 51,
  "metadata": {
    "title": "Drama Title",
    "cover": "https://...",
    "intro": "Description..."
  },
  "data": [
    {
      "index": 0,
      "title": "Ep 1",
      "url": "https://..."
    }
  ]
}
```

## Project Structure

```
├── index.js
├── EnvielDracin.js
├── EnvielToken.js
└── package.json
```

## Support

Buy me a coffee ☕

[![Saweria](https://img.shields.io/badge/Saweria-Donate-orange?style=for-the-badge)](https://saweria.co/envielxyz)

## License

MIT License

## Access from Mobile (Same Wi‑Fi)

1. Ensure your computer and phone are connected to the same Wi‑Fi network.
2. Install dependencies and start the server (server binds to LAN addresses by default):

```bash
npm install
PORT=3000 node index.js
```

3. Find your computer LAN IP (one of these commands):

```bash
hostname -I
# or
ip addr show
```

4. Open the API from your phone's browser at:

```
http://<YOUR_COMPUTER_LAN_IP>:3000
```

Notes:
- If you set `HOST` the server will bind to that address. By default it binds to `0.0.0.0` so the app is reachable on the LAN.
- If a firewall is enabled on your computer, allow incoming connections to the chosen `PORT`.
