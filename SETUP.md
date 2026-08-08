# SETUP — Ortam Durumu (Faz K, devops)

Son doğrulama: 2026-08-08 · Makine: RTX 3060 12GB, Linux 6.17

## Doğrulama komutları ve durum

| Araç | Komut | Durum |
|---|---|---|
| Node 20 | `node --version` | ✅ v20.19.5 |
| npm | `npm --version` | ✅ 11.11.0 |
| git | `git --version` | ✅ 2.43.0 |
| Docker | `docker --version && docker ps` | ✅ 28.5.1, daemon çalışıyor |
| Docker Compose | `docker compose version` | ✅ v2.40.1 |
| Python 3 | `python3 --version` | ✅ 3.12.4 (anaconda) |
| pip | `pip --version` | ✅ 26.0.1 |
| gltfpack | `npx gltfpack` | ✅ devDependency olarak kuruldu |
| gltf-transform | `npx gltf-transform --version` | ✅ devDependency (`@gltf-transform/cli`) |
| Blender | `blender --version` | ✅ 4.0.2 (2026-08-08, kullanıcı onayıyla apt ile kuruldu) |

## Notlar
- gltf araçları repo devDependency'si olarak kuruldu (global kurulum ve
  OS onayı gerekmedi). Asset boru hattı `npx` üzerinden çağırır.
- Blender 4.0.2 kuruldu (kullanıcı sudo şifresini verdi, `apt-get install
  blender`). Asset boru hattı Blender'sız da çalışacak şekilde prosedürel
  kuruldu; Blender artık retarget/mocap işleri için kullanılabilir.
  Blender MCP sunucusu BAĞLI DEĞİL — headless `blender --background --python`
  ile script çalıştırmak yeterli, MCP ihtiyacı çıkarsa ayrıca kurulur.
- Mevcut test altyapısı: `npm run test:sim|rules|mp|fx|replay|input|crowd`
  (7 headless paket, node ile koşar; ağ gerekmez).
- Dev sunucu: `npx vite --port 5199 --host` · Oda listesi: `npm run rooms`.

---

## Docker yığını: web + coturn (Faz 1.1, matris #5/#6)

`docker compose up` iki servis ayağa kaldırır: `web` (Node, bağımlılıksız)
ve `coturn` (TURN röle sunucusu). Vite (5199) ve tek başına çalışan oda
listesi (5200) portlarına dokunulmaz.

### Portlar

| Servis | Port | Bağlanma | Ne için |
|---|---|---|---|
| web | 5210/tcp | `127.0.0.1` | statik `dist/`, `/rooms`, `/turn-credentials`, `/healthz` |
| coturn | 3478/tcp+udp | `TURN_LISTENING_IP` | STUN + TURN düz |
| coturn | 5349/tcp+udp | `TURN_LISTENING_IP` | TURN over TLS |
| coturn | 49152-65535/udp | `TURN_LISTENING_IP` | röle port aralığı |

coturn `network_mode: host` ile koşar. Docker NAT'i 16 binlik UDP aralığını
güvenilir taşımıyor, coturn'ün desteklediği tek konteyner biçimi bu.
Geliştirme varsayılanı `TURN_LISTENING_IP=127.0.0.1`, yani röle makine
dışına açılmaz.

### İlk kurulum

```bash
cp .env.example .env
openssl rand -hex 32              # çıktıyı .env içindeki TURN_SECRET'a yapıştır
sh docker/coturn/gen-dev-cert.sh  # 5349 için kendinden imzalı sertifika (dev)
npm run build                     # dist/ üretir, imaja kopyalanır
docker compose up --build -d
```

`.env` ve `docker/coturn/certs/` gitignore'da. Sır depoya girmez: `web`
paylaşılan sırla efemer kimlik bilgisi imzalar, tarayıcıya yalnızca
base64 HMAC gider.

Sertifika üretmezsen coturn TLS'siz açılır ve bunu logda yüksek sesle
söyler. Yerel geliştirmede kabul edilebilir, internete açarken değil.

### Doğrulama

```bash
curl -s localhost:5210/healthz                              # {"status":"ok",...}
curl -sI localhost:5210/ | grep -i cross-origin             # COOP + COEP + CORP
curl -s "localhost:5210/turn-credentials?userId=peer-1"     # username/credential

node packages/server/test/run.mjs                           # 53 kontrol, ağsız
TURN_SECRET=<.env'deki> node packages/server/test/relay.mjs # canlı TURN Allocate
```

`relay.mjs` gerçek bir RFC 5766 Allocate el sıkışması yapar: geçerli kimlik
bilgisiyle röle tahsisi alır, sahte kimlik bilgisini ve süresi dolmuş
zaman damgasını reddettirir. coturn ayakta değilse başarısız olur, bu
kasıtlı.

### Kapatma

```bash
docker compose down -v
```

### Ortam değişkenleri

Tam liste `.env.example` içinde. Kritik olanlar: `TURN_SECRET` (zorunlu,
boşsa coturn açılmayı reddeder), `TURN_REALM`, `TURN_HOST` (tarayıcının
arayacağı ad), `TURN_LISTENING_IP` (dev'de loopback, üretimde `0.0.0.0` +
`TURN_EXTERNAL_IP`).
