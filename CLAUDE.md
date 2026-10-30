# CLAUDE.md

Bu depo, pisti98 eklentisinin kullandığı **Pişti kural motorudur** ve herkese açık, MIT lisanslıdır. Kullanıcıyla her zaman doğru Türkçe karakterlerle Türkçe konuşulur; kod ve yorumlar İngilizce.

- Authoritative remote: `https://github.com/codeXik/pisti-engine` (public). Default branch: `main`. Git kimliği yerel: `codeXik` + `54392816+codeXik@users.noreply.github.com`.
- Kurallar: [docs/KURALLAR.md](docs/KURALLAR.md). Kural değişikliği önce kullanıcıya sorulur.
- Bağımlılık yok, derleme aracı yok, arayüz kodu yok (motor arayüzden bağımsız kalır).
- Kalite kapısı: `npm test`. Gerekli testler ve sır taraması geçmeden commit/push yok. Her kod değişikliğinde `package.json` sürümü artırılır ve `CHANGELOG.md`'ye yazılır.
- Motor pisti98'ye kopyalanıyorsa (`src/engine/`), değişiklik önce bu depoda yapılır, sonra oraya aktarılır.
- Herkese açık depodur: sır, kişisel veri, sunucu bilgisi, yerel yol konmaz. İletişim adresi yalnız `hello@skynonlabs.com`.
- Kullanıcı kısa, sade Türkçe ister (teknik olmayan ürün sahibi). Kendi kafana göre iş yapma; ek iyileştirmeyi öner ve sor.
- Devam kaydı: [docs/HANDOFF.md](docs/HANDOFF.md).
