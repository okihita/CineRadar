# City to Province Mapping Review (Updated 2026 - 38 Provinces)

This document lists the final mapping of TIX.id cities to Indonesian provinces as used in the "National Seat Allocation" map, now synchronized with the latest 38-province GeoJSON.

## 1. Valid Province Names (Map Keys)
The following names are the **exact** strings found in the new GeoJSON (`PROVINSI` field).

- `Aceh`
- `Bali`
- `Banten`
- `Bengkulu`
- `DKI Jakarta`
- `Daerah Istimewa Yogyakarta`
- `Gorontalo`
- `Jambi`
- `Jawa Barat`
- `Jawa Tengah`
- `Jawa Timur`
- `Kalimantan Barat`
- `Kalimantan Selatan`
- `Kalimantan Tengah`
- `Kalimantan Timur`
- `Kalimantan Utara`
- `Kepulauan Bangka Belitung`
- `Kepulauan Riau`
- `Lampung`
- `Maluku`
- `Maluku Utara`
- `Nusa Tenggara Barat`
- `Nusa Tenggara Timur`
- `Papua`
- `Papua Barat`
- `Papua Barat Daya`
- `Papua Pegunungan`
- `Papua Selatan`
- `Papua Tengah`
- `Riau`
- `Sulawesi Barat`
- `Sulawesi Selatan`
- `Sulawesi Tengah`
- `Sulawesi Tenggara`
- `Sulawesi Utara`
- `Sumatera Barat`
- `Sumatera Selatan`
- `Sumatera Utara`

## 2. Final Mapping Table
Stored in: `admin/src/lib/geo-mapping.ts`

| # | TIX.id City | Mapped Province | Note |
| :--- | :--- | :--- | :--- |
| 1 | BANDA ACEH | Aceh | |
| 2 | MEDAN | Sumatera Utara | |
| 3 | BINJAI | Sumatera Utara | |
| 4 | KISARAN | Sumatera Utara | |
| 5 | PEMATANG SIANTAR | Sumatera Utara | |
| 6 | RANTAU PRAPAT | Sumatera Utara | |
| 7 | PADANG | Sumatera Barat | |
| 8 | PEKANBARU | Riau | |
| 9 | DUMAI | Riau | |
| 10 | DURI | Riau | |
| 11 | ROKAN HILIR | Riau | |
| 12 | BATAM | Kepulauan Riau | **Separated from Riau** |
| 13 | TANJUNG PINANG | Kepulauan Riau | **Separated from Riau** |
| 14 | JAMBI | Jambi | |
| 15 | PALEMBANG | Sumatera Selatan | |
| 16 | LUBUKLINGGAU | Sumatera Selatan | |
| 17 | PRABUMULIH | Sumatera Selatan | |
| 18 | BENGKULU | Bengkulu | |
| 19 | LAMPUNG | Lampung | |
| 20 | PANGKAL PINANG | Kepulauan Bangka Belitung | |
| 21 | JAKARTA | DKI Jakarta | |
| 22 | SERANG | Banten | |
| 23 | CILEGON | Banten | |
| 24 | TANGERANG | Banten | |
| 25 | BANDUNG | Jawa Barat | |
| 26 | BEKASI | Jawa Barat | |
| 27 | BOGOR | Jawa Barat | |
| 28 | CIANJUR | Jawa Barat | |
| 29 | CIKARANG | Jawa Barat | |
| 30 | CIREBON | Jawa Barat | |
| 31 | DEPOK | Jawa Barat | |
| 32 | GARUT | Jawa Barat | |
| 33 | INDRAMAYU | Jawa Barat | |
| 34 | KARAWANG | Jawa Barat | |
| 35 | PURWAKARTA | Jawa Barat | |
| 36 | SUMEDANG | Jawa Barat | |
| 37 | TASIKMALAYA | Jawa Barat | |
| 38 | SEMARANG | Jawa Tengah | |
| 39 | KLATEN | Jawa Tengah | |
| 40 | PEKALONGAN | Jawa Tengah | |
| 41 | PURWOKERTO | Jawa Tengah | |
| 42 | SOLO | Jawa Tengah | |
| 43 | TEGAL | Jawa Tengah | |
| 44 | YOGYAKARTA | Daerah Istimewa Yogyakarta | |
| 45 | SURABAYA | Jawa Timur | |
| 46 | BLITAR | Jawa Timur | |
| 47 | BONDOWOSO | Jawa Timur | |
| 48 | GRESIK | Jawa Timur | |
| 49 | JEMBER | Jawa Timur | |
| 50 | KEDIRI | Jawa Timur | |
| 51 | MADIUN | Jawa Timur | |
| 52 | MALANG | Jawa Timur | |
| 53 | MOJOKERTO | Jawa Timur | |
| 54 | PONOROGO | Jawa Timur | |
| 55 | PROBOLINGGO | Jawa Timur | |
| 56 | SIDOARJO | Jawa Timur | |
| 57 | BALI | Bali | |
| 58 | MATARAM | Nusa Tenggara Barat | |
| 59 | KUPANG | Nusa Tenggara Timur | |
| 60 | PONTIANAK | Kalimantan Barat | |
| 61 | KETAPANG | Kalimantan Barat | |
| 62 | SINGKAWANG | Kalimantan Barat | |
| 63 | PALANGKARAYA | Kalimantan Tengah | |
| 64 | KUALA KAPUAS | Kalimantan Tengah | |
| 65 | SAMPIT | Kalimantan Tengah | |
| 66 | BANJARMASIN | Kalimantan Selatan | |
| 67 | BANJARBARU | Kalimantan Selatan | |
| 68 | BALIKPAPAN | Kalimantan Timur | |
| 69 | BONTANG | Kalimantan Timur | |
| 70 | SAMARINDA | Kalimantan Timur | |
| 71 | TARAKAN | Kalimantan Utara | **Separated from Kaltim** |
| 72 | MANADO | Sulawesi Utara | |
| 73 | PALU | Sulawesi Tengah | |
| 74 | MAKASSAR | Sulawesi Selatan | |
| 75 | KENDARI | Sulawesi Tenggara | |
| 76 | BAUBAU | Sulawesi Tenggara | |
| 77 | GORONTALO | Gorontalo | |
| 78 | MAMUJU | Sulawesi Barat | **Separated from Sulsel** |
| 79 | AMBON | Maluku | |
| 80 | TERNATE | Maluku Utara | |
| 81 | JAYAPURA | Papua | |
| 82 | SORONG | Papua Barat Daya | **New Province (2022)** |
| 83 | MANOKWARI | Papua Barat | |
| 84 | TIMIKA | Papua Tengah | **New Province (2022)** |
