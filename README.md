# pisti-engine

Pişti kart oyunu için kural motoru ve bilgisayar oyuncusu. Ücretsizdir ve MIT lisansıyla dağıtılır. Başka hiçbir pakete ihtiyaç duymaz. Düz JavaScript ile yazıldığı için tarayıcıda da Node.js'te de derlemeden çalışır.

Motor şunları yapar:

- 52 kartlık desteyi karıştırır; masaya 4 kart koyar (üçü kapalı, üstteki açık ve Vale olmaz), 2 ya da 4 oyuncuya 4'er kart dağıtır.
- Atılan kartın masayı alıp almadığını kurala göre denetler: aynı sayı ya da Vale.
- Pişti ve çifte pişti puanlarını, puanlı kartları ve "en çok kart" puanını hesaplar.
- Son kartı atınca masada kalanı son alana verir.
- 4 kişilik oyunda herkes tek başına ya da iki takım (0+2 ve 1+3) olarak oynayabilir.
- Oyunu hedef puana (51, 101, 151) kadar el el sürdürür.
- Kaydedilip sonra kaldığı yerden sürdürülebilir.
- Üç seviyede bilgisayar oyuncusu içerir: kolay, normal ve zor.

Kuralların ayrıntısı: [docs/KURALLAR.md](docs/KURALLAR.md).

## Hızlı başlangıç

İki bilgisayarın bir eli oynaması:

```js
import { PistiHand, botAction } from './src/index.js';

const el = new PistiHand({ players: 2 });          // masayı kurar, 4'er kart dağıtır
while (el.phase === 'play') {
  const koltuk = el.turn;
  const { card } = botAction(el, { level: 'zor', seat: koltuk });
  el.play(koltuk, card);                           // kartı atar, masayı alıyorsa alır
}
console.log(el.scores);                            // her tarafın bu eldeki puanı
```

Oyuncular 0, 1, 2 ve 3 numaralı koltuklarda oturur. İlk oynayan, dağıtıcıdan sonraki koltuktur.

## Kartların yazılışı

Her kart, önce rengin harfi sonra kartın değeri yazılarak gösterilir. Örneğin `S14` maça ası, `H11` kupa valesi, `C2` sinek ikilisidir.

| Renk | Harf |
| --- | --- |
| Maça | `S` |
| Kupa | `H` |
| Karo | `D` |
| Sinek | `C` |

2'den 10'a kadar olan kartlar kendi sayısıyla yazılır. Vale `11`, kız `12`, papaz `13`, as `14` ile gösterilir. Başka bir oyuncunun kapalı kartı `?` ile gösterilir.

## Bir elin oynanışı

Hangi aşamada olunduğu `el.phase` ile öğrenilir: `play` ya da `done`. Sıranın hangi koltukta olduğu `el.turn` ile öğrenilir.

| Yapılacak iş | Komut |
| --- | --- |
| Kart atmak | `el.play(koltuk, 'H9')` |
| Atılabilecek kartlar (elindeki hepsi) | `el.legalCards(koltuk)` |
| Kart masayı alır mı | `captures('H9', el.top)` |

`play` her zaman `{ ok, took, pisti }` döner. Kurala aykırı hamle reddedilir (`{ ok: false, error }`) ve durum değişmez. `took` masadan alınan kartlar, `pisti` bu hamlenin pişti puanıdır (`0`, `10` ya da `20`).

Masada olanlar: `el.pile` (masadaki kartlar), `el.hidden` (alttan kaç kart kapalı), `el.top` (en üst kart), `el.deck` (destede kalanlar), `el.captured` (her koltuğun aldığı kartlar). El bittiğinde `el.scores` her tarafın (oyuncu ya da takım) puanıdır; ayrıntı için `el.breakdown(koltuk)`.

## Bütün oyun

`PistiMatch`, oyunu hedef puana kadar el el sürdürür:

```js
import { PistiMatch, botAction } from './src/index.js';

const oyun = new PistiMatch({ settings: { players: 2, targetScore: 51 } });
while (!oyun.over) {
  const el = oyun.startRound();
  while (el.phase === 'play') {
    const k = el.turn;
    el.play(k, botAction(el, { level: 'normal', seat: k }).card);
  }
  oyun.finishRound();   // puanları ekler, dağıtıcıyı bir ileri alır, oyunun bitip bitmediğine bakar
}
console.log(oyun.winner, oyun.scores);
```

Ayarlar: `players` (2 ya da 4), `teams` (4 kişide eşli oyun), `targetScore` (varsayılan 101). `oyun.standings` sıralamayı verir: `[{ side, score, place }]`.

## Kaydetme ve yükleme

```js
const kayit = JSON.stringify(oyun);                      // PistiMatch ya da PistiHand
const oyun2 = PistiMatch.fromJSON(JSON.parse(kayit));    // tek bir el için PistiHand.fromJSON
```

## Oyuncunun görebildikleri

`el.view(koltuk)` yalnızca o koltuktaki oyuncunun görmesi gereken bilgileri verir: kendi kartları, diğerlerinin kaç kartı olduğu, masanın açık kartları (kapalı olanlar `?`), alınan kart sayıları ve son alınan masa. Başkalarının kartları hiçbir yerde yer almaz. Çevrim içi oyunda sunucu her oyuncuya yalnız kendi `view`'ını göndermelidir.

## Bilgisayar oyuncusu

```js
const { card } = botAction(el, { level: 'normal', seat: koltuk });
```

Bilgisayar, kendi elini ve masadaki açık kartları görür; seviyeye göre ayrıca neyin oynandığını hatırlar.

| Seviye | Nasıl oynar |
| --- | --- |
| `kolay` | Çoğunlukla masayı alan kartı atar, yoksa rastgele atar |
| `normal` | Masanın değerine bakar, Vale'yi değerli bir masa için saklar, pişti fırsatını kollar |
| `zor` | Normal gibi oynar; ayrıca oynanan ve alınan kartları hatırlar, rakibin pişti yapma ihtimalini hesaplar |

## Rastgelelik

Kartlar varsayılan olarak `Math.random` ile karıştırılır. Tahmin edilemeyen bir dağıtım gerekiyorsa kendi üretecinizi `rng` olarak verin: `new PistiHand({ players: 2, rng })`.

## Testler

```bash
npm test
```

## Lisans

MIT. Skynon Labs Ltd. [pisti98](https://skynonlabs.com/browser-extensions/pisti98/) eklentisinin motorudur.
