# CineRadar Specification

## Frozen Requirements

### Supported Cinema Chains
| Chain | Color Code |
|-------|------------|
| **XXI** | Amber (#F59E0B) |
| **CGV** | Red (#DC2626) |
| **Cinépolis** | Blue (#2563EB) |

### Region Mapping (No "Others" Allowed)
All 83 cities MUST be mapped to one of these regions:

| Region | Cities |
|--------|--------|
| **Jawa** | Jakarta, Bandung, Surabaya, Semarang, Yogyakarta, Malang, Bekasi, Tangerang, Depok, Bogor, Cirebon, Solo, Serang, Cilegon, Tasikmalaya, Karawang, Purwakarta, Garut, Indramayu, Sumedang, Gresik, Sidoarjo, Mojokerto, Kediri, Madiun, Ponorogo, Probolinggo, Tegal, Pekalongan, Purwokerto, Klaten, Jember, Blitar, Bondowoso, Cianjur, Cikarang |
| **Sumatera** | Medan, Palembang, Pekanbaru, Padang, Jambi, Lampung, Batam, Dumai, Duri, Lubuklinggau, Prabumulih, Pangkal Pinang, Pematang Siantar, Rantau Prapat, Rokan Hilir, Kisaran, Tanjung Pinang, Bengkulu, Binjai |
| **Kalimantan** | Balikpapan, Banjarmasin, Pontianak, Samarinda, Tarakan, Palangkaraya, Singkawang, Sampit, Banjarbaru, Ketapang, Kuala Kapuas, Bontang |
| **Sulawesi** | Makassar, Manado, Palu, Kendari, Gorontalo, Baubau, Mamuju |
| **Bali & NT** | Bali, Mataram, Kupang |
| **Papua & Maluku** | Jayapura, Sorong, Manokwari, Ambon, Ternate, Timika |

⚠️ **If a new city is added to TIX.id, it MUST be added to the region mapping in `admin/src/lib/regions.ts`**

### Data Sources
- **TIX.id** - Primary source for movie listings and showtimes
- **83 Indonesian cities** supported

### Scraper Schedule
- Daily at 6:00 AM WIB (23:00 UTC previous day)
- Parallel execution: 9 batches for ~15 min total runtime

---
*Last updated: 2025-12-16*
