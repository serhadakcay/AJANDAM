const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ara katmanlar (Middleware)
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROTLARI ---

// 1. Tüm görevleri getir (Belirli bir tarih aralığı için filtreleme eklenebilir)
app.get('/api/tasks', (req, res) => {
    const { start, end } = req.query;
    let query = "SELECT * FROM tasks ORDER BY start_time ASC";
    let params = [];

    // Eğer tarih aralığı verilmişse filtrele (FullCalendar talepleri için)
    if (start && end) {
        query = "SELECT * FROM tasks WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC";
        params = [start, end];
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // FullCalendar 'start' ve 'end' bekler, veritabanımızda start_time ve end_time var.
        // İkisini de gönderiyoruz.
        const events = rows.map(row => ({
            ...row,
            start: row.start_time,
            end: row.end_time
        }));
        res.json(events);
    });
});

// 2. Yeni görev ekle
app.post('/api/tasks', (req, res) => {
    const { title, description, start_time, end_time, status } = req.body;
    const sql = `INSERT INTO tasks (title, description, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)`;
    const params = [title, description, start_time, end_time, status || 'pending'];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "Görev eklendi",
            id: this.lastID,
            ...req.body
        });
    });
});

// 3. Görevi güncelle (Durum değişikliği, erteleme vb.)
app.put('/api/tasks/:id', (req, res) => {
    const { title, description, start_time, end_time, status, notification_sent } = req.body;
    const { id } = req.params;

    // Dinamik güncelleme sorgusu oluştur
    let updates = [];
    let params = [];

    if (title) { updates.push("title = ?"); params.push(title); }
    if (description) { updates.push("description = ?"); params.push(description); }
    if (start_time) { updates.push("start_time = ?"); params.push(start_time); }
    if (end_time) { updates.push("end_time = ?"); params.push(end_time); }
    if (status) { updates.push("status = ?"); params.push(status); }
    if (notification_sent !== undefined) { updates.push("notification_sent = ?"); params.push(notification_sent); }

    if (updates.length === 0) {
        return res.status(400).json({ error: "Güncellenecek veri yok" });
    }

    params.push(id);

    const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`;

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Görev güncellendi", changes: this.changes });
    });
});

// 4. Görevi sil
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM tasks WHERE id = ?", id, function (err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Görev silindi", changes: this.changes });
    });
});

// 5. Raporlama (İstatistikler)
app.get('/api/report', (req, res) => {
    const { start, end } = req.query;
    // Belirli tarih aralığında durumlarına göre sayıları ver
    const sql = `
        SELECT status, COUNT(*) as count 
        FROM tasks 
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY status
    `;

    db.all(sql, [start, end], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`✅  UYGULAMA BİLGİSAYARDA BAŞLADI: http://localhost:${PORT}`);

    // IP Adresini bul
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let localIp = 'Bulunamadı';

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Sadece IPv4 ve harici olmayan (127.0.0.1 olmayan) adresleri al
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
                break;
            }
        }
    }

    console.log(`📱  ANDROID TELEFONDAN GİRMEK İÇİN: http://${localIp}:${PORT}`);
    console.log(`==================================================\n`);
});
