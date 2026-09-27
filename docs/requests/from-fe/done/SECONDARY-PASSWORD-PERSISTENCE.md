# Secondary Password Token Persistence

## Context
Saat ini FE menyimpan module unlock token hanya di memory, sehingga saat user refresh halaman, token hilang dan user harus memasukkan password kedua lagi meskipun token masih valid di server.

## Changes Needed in FE
FE sudah diperbarui untuk menyimpan module unlock token di sessionStorage:
- Token dan expiry time disimpan di sessionStorage
- Token di-load kembali saat bootstrap session
- Token di-clear saat logout atau saat token expired

## Changes Needed in BE
✅ **Review completed - BE sudah mengimplementasikan dengan benar**

1. **Validasi token di BE**: ✅ Sudah ada di `requireModuleUnlock.middleware.ts`
   - Middleware membaca header `X-Module-Unlock`
   - Memvalidasi token dengan `tokenService.verifyModuleUnlock()`
   - Memastikan token valid, belum expired, dan cocok dengan personId/familyId
   - Memvalidasi bahwa token mencakup module yang diminta

2. **Token expiry**: ✅ Sudah ada di `token.service.ts`
   - JWT verification otomatis menangani expiry via `jwt.verify()`
   - Token expiry diatur melalui `env.secondaryUnlockTtlSeconds` (default 15 menit)
   - Server-side validation memastikan token tidak diterima jika sudah expired

3. **Token generation**: ✅ Sudah ada di `secondary-password.service.ts`
   - `setup()` mengembalikan `unlockToken` dan `expiresIn`
   - `verify()` mengembalikan `unlockToken` dan `expiresIn`
   - Token di-generate dengan `tokenService.signModuleUnlock()` menggunakan JWT

4. **Token invalidation**: ✅ Sudah dihandle oleh JWT expiry
   - Token adalah stateless JWT dengan expiry time (~15 menit)
   - Setelah expiry, user harus re-verify password kedua
   - Tidak perlu blacklist tambahan karena expiry time sudah cukup untuk security level saat ini
   - Saat user mengubah password, token lama akan tetap valid sampai expiry (acceptable trade-off untuk stateless design)

## Expected Behavior
- User yang sudah berhasil unlock module tidak perlu memasukkan password kedua lagi saat refresh halaman, selama token masih valid
- Token hanya berlaku untuk session browser yang sama (sessionStorage)
- Token tetap memiliki expiry time di server side untuk keamanan

## Additional Notes
- FE menggunakan sessionStorage untuk module unlock token (bukan localStorage) agar token hilang saat tab ditutup
- FE menerapkan skew 5 detik sebelum mengirim token ke BE untuk menghindari mengirim token yang hampir expired
- FE mengirim token via header `X-Module-Unlock` untuk request ke endpoint yang membutuhkan secondary password protection (admin, money, fc, household)
- BE menggunakan stateless JWT dengan expiry time ~15 menit untuk module unlock token
- Tidak ada perubahan kode BE yang diperlukan - implementasi saat ini sudah sesuai
