const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Veritabanı dosyasının yolu
const dbPath = path.resolve(__dirname, 'ajanda.db');

// Veritabanı bağlantısı
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Veritabanına bağlanılamadı:', err.message);
    } else {
        console.log('SQLite veritabanına bağlanıldı.');
    }
});

// Tabloları oluştur
db.serialize(() => {
    // Görevler tablosu
    // id: Benzersiz kimlik
    // title: Görev başlığı
    // description: Açıklama
    // start_time: Başlangıç zamanı (ISO formatı veya timestamp)
    // end_time: Bitiş zamanı
    // status: 'pending' (bekliyor), 'done' (yapıldı), 'cancelled' (iptal), 'postponed' (ertelendi)
    // notification_sent: Bildirim gönderildi mi? (0 veya 1)

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notification_sent INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error('Tablo oluşturma hatası:', err.message);
        } else {
            console.log("'tasks' tablosu hazır.");
        }
    });
});

module.exports = db;
