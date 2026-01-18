document.addEventListener('DOMContentLoaded', function () {
    // --- Değişkenler ---
    const calendarEl = document.getElementById('calendar');
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    const closeModal = document.querySelector('.close');
    const btnNewTask = document.getElementById('btn-new-task');
    const btnDelete = document.getElementById('btn-delete');
    const btnAllowNotify = document.getElementById('btn-allow-notify');
    const notifyBanner = document.getElementById('notification-banner');

    // Görünüm Değiştirme
    const btnCalendar = document.getElementById('btn-calendar');
    const btnReports = document.getElementById('btn-reports');
    const calendarView = document.getElementById('calendar-view');
    const reportsView = document.getElementById('reports-view');
    const pageTitle = document.getElementById('page-title');

    // Raporlama
    const btnGetReport = document.getElementById('btn-get-report');
    const reportStart = document.getElementById('report-start');
    const reportEnd = document.getElementById('report-end');

    let calendar;
    let selectedEvent = null; // Düzenleme için

    // --- Başlangıç Ayarları ---

    // Tarih Saat Göstergesi
    setInterval(updateClock, 1000);
    updateClock();

    // Takvim Kurulumu
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek', // Haftalık görünümle başla
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'tr', // Türkçe
        firstDay: 1, // Pazartesi
        slotMinTime: '06:00:00', // Sabah 6'dan başla
        slotMaxTime: '24:00:00',
        nowIndicator: true,
        selectable: true,
        editable: true, // Sürükle bırak ile saati değiştir
        events: '/api/tasks', // Görevleri sunucudan çek

        // Şekil (Event) tasarımı
        eventDidMount: function (info) {
            // Duruma göre renk ver
            const status = info.event.extendedProps.status;
            if (status === 'done') {
                info.el.style.backgroundColor = '#107c10'; // Yeşil
                info.el.style.borderColor = '#107c10';
            } else if (status === 'cancelled') {
                info.el.style.backgroundColor = '#a4262c'; // Kırmızı
                info.el.style.borderColor = '#a4262c';
                info.el.style.textDecoration = 'line-through';
            } else if (status === 'postponed') {
                info.el.style.backgroundColor = '#d83b01'; // Turuncu
                info.el.style.borderColor = '#d83b01';
            }
        },

        // Tarih seçimi (Yeni Görev)
        select: function (info) {
            resetForm();
            // ISO dizesini datetime-local formatına çevir (YYYY-MM-DDTHH:MM)
            document.getElementById('task-start').value = toLocalISOString(info.startStr);
            document.getElementById('task-end').value = toLocalISOString(info.endStr);
            openModal('Yeni Görev');
        },

        // Görev Tıklama (Düzenle)
        eventClick: function (info) {
            selectedEvent = info.event;
            fillForm(info.event);
            openModal('Görevi Düzenle');
        },

        // Sürükle Bırak ile Güncelleme
        eventDrop: function (info) {
            updateTaskDropResize(info.event);
        },
        eventResize: function (info) {
            updateTaskDropResize(info.event);
        }
    });

    calendar.render();

    // --- Bildirim İzni Kontrolü ---
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        notifyBanner.classList.remove('hidden');
    }

    btnAllowNotify.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notifyBanner.classList.add('hidden');
                new Notification("Bildirimler aktif!", { body: "Ajandanız sizi uyaracak." });
            }
        });
    });

    // --- Bildirim Döngüsü (Her dakika kontrol et) ---
    setInterval(checkNotifications, 60000);

    async function checkNotifications() {
        if (Notification.permission !== 'granted') return;

        const now = new Date();
        // Tüm bekleyen görevleri tekrar çek (Basit yöntem)
        // Gerçek uygulamada daha optimize bir endpoint olabilir ama local için sorun değil.
        try {
            const res = await fetch('/api/tasks');
            const tasks = await res.json();

            tasks.forEach(task => {
                const startTime = new Date(task.start_time);
                const timeDiff = startTime - now;

                // Eğer başlangıç zamanı geçmişse veya 1 dakika içindeyse VE bildirim gönderilmemişse VE durumu beklemedeyse
                // (timeDiff < 60000 && timeDiff > -60000) -> Başlangıç saatine çok yakın (+- 1 dk)
                // Ancak sunucuda 'notification_sent' flag'imiz var.
                // Basit mantık: Şimdiki zaman >= Başlangıç zamanı VE notification_sent == 0

                if (now >= startTime && task.notification_sent === 0 && task.status === 'pending') {
                    // Bildirim Gönder
                    new Notification(`Zamanı Geldi: ${task.title}`, {
                        body: task.description || "Görev zamanı!",
                        icon: '/favicon.ico' // İkon varsa
                    });

                    // Veritabanında güncelle (notification_sent = 1)
                    fetch(`/api/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notification_sent: 1 })
                    });
                }
            });
        } catch (err) {
            console.error("Bildirim kontrol hatası:", err);
        }
    }


    // --- Form İşlemleri ---

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            start_time: document.getElementById('task-start').value,
            end_time: document.getElementById('task-end').value,
            status: document.getElementById('task-status').value
        };

        if (selectedEvent) {
            // Güncelleme
            fetch(`/api/tasks/${selectedEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            })
                .then(res => res.json())
                .then(data => {
                    calendar.refetchEvents(); // Takvimi yenile
                    closeModalFunc();
                });
        } else {
            // Yeni Kayıt
            fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            })
                .then(res => res.json())
                .then(data => {
                    calendar.refetchEvents();
                    closeModalFunc();
                });
        }
    });

    btnDelete.addEventListener('click', function () {
        if (selectedEvent && confirm('Bu görevi silmek istediğinize emin misiniz?')) {
            fetch(`/api/tasks/${selectedEvent.id}`, {
                method: 'DELETE'
            })
                .then(() => {
                    selectedEvent.remove(); // Arayüzden kaldır
                    closeModalFunc();
                });
        }
    });

    function updateTaskDropResize(event) {
        const taskData = {
            start_time: toLocalISOString(event.startStr), // FullCalendar ISO veriyor
            end_time: event.end ? toLocalISOString(event.endStr) : toLocalISOString(event.startStr)
        };

        // FullCalendar ISO formatı bazen UTC 'Z' içerebilir, bunu yerel saate çevirmekte fayda var
        // Ancak input type="datetime-local" formatı: YYYY-MM-DDTHH:MM

        fetch(`/api/tasks/${event.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_time: event.start.toISOString(), // Basitleştirilmiş
                end_time: event.end ? event.end.toISOString() : event.start.toISOString()
            })
        });
    }


    // --- Raporlama ---

    btnGetReport.addEventListener('click', () => {
        const start = reportStart.value;
        const end = reportEnd.value;

        if (!start || !end) {
            alert("Lütfen başlangıç ve bitiş tarihi seçin.");
            return;
        }

        fetch(`/api/report?start=${start}&end=${end}`)
            .then(res => {
                if (!res.ok) throw new Error("Sunucu hatası: " + res.status);
                return res.json();
            })
            .then(data => {
                const tbody = document.getElementById('report-body');
                tbody.innerHTML = '';

                // Hata mesajı kontrolü (Backend'den {error: ...} gelirse)
                if (data.error) {
                    alert('Rapor alınamadı: ' + data.error);
                    return;
                }

                let total = 0;
                // data bir dizi değilse hata verme
                if (Array.isArray(data)) {
                    data.forEach(row => {
                        const tr = document.createElement('tr');

                        let statusText = row.status;
                        if (statusText === 'done') statusText = 'Tamamlandı';
                        if (statusText === 'pending') statusText = 'Bekliyor';
                        if (statusText === 'cancelled') statusText = 'İptal Edildi';
                        if (statusText === 'postponed') statusText = 'Ertelendi';

                        tr.innerHTML = `<td>${statusText}</td><td>${row.count}</td>`;
                        tbody.appendChild(tr);
                        total += row.count;
                    });
                    if (data.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="2">Kayıt bulunamadı.</td></tr>';
                    }
                } else {
                    console.error("Beklenmeyen veri formatı:", data);
                }
            })
            .catch(err => {
                console.error(err);
                alert("Rapor çekilemedi! Sunucu bağlantısını kontrol edin.");
            });
    });


    // --- Yardımcı Fonksiyonlar ---

    // Navigasyon
    btnCalendar.addEventListener('click', () => switchView('calendar'));
    btnReports.addEventListener('click', () => switchView('reports'));
    btnNewTask.addEventListener('click', () => {
        selectedEvent = null;
        resetForm();
        // Varsayılan şu an + 1 saat
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('task-start').value = now.toISOString().slice(0, 16);
        openModal('Yeni Görev');
    });

    function switchView(viewName) {
        if (viewName === 'calendar') {
            calendarView.classList.add('active');
            reportsView.classList.remove('active');
            btnCalendar.classList.add('active');
            btnReports.classList.remove('active');
            pageTitle.textContent = 'Takvim';
            setTimeout(() => calendar.render(), 100); // Yeniden çizim düzeltmesi
        } else {
            calendarView.classList.remove('active');
            reportsView.classList.add('active');
            btnCalendar.classList.remove('active');
            btnReports.classList.add('active');
            pageTitle.textContent = 'Raporlar';
        }
    }

    // Modal
    closeModal.addEventListener('click', closeModalFunc);
    window.addEventListener('click', (e) => {
        if (e.target == modal) closeModalFunc();
    });

    function openModal(title) {
        document.getElementById('modal-title').textContent = title;
        modal.style.display = 'block';
        if (selectedEvent) {
            btnDelete.classList.remove('hidden');
        } else {
            btnDelete.classList.add('hidden');
        }
    }

    function closeModalFunc() {
        modal.style.display = 'none';
    }

    function resetForm() {
        form.reset();
        document.getElementById('task-id').value = '';
        selectedEvent = null;
    }

    function fillForm(event) {
        document.getElementById('task-id').value = event.id;
        document.getElementById('task-title').value = event.title;
        document.getElementById('task-desc').value = event.extendedProps.description || '';
        document.getElementById('task-status').value = event.extendedProps.status || 'pending';

        // Tarih formatlama
        // FullCalendar Date objesini input değerine çevirmemiz lazım
        // event.start -> Date object
        const startIso = toLocalISOString(event.start.toISOString());
        document.getElementById('task-start').value = startIso;

        if (event.end) {
            const endIso = toLocalISOString(event.end.toISOString());
            document.getElementById('task-end').value = endIso;
        } else {
            document.getElementById('task-end').value = startIso; // Bitiş yoksa başlangıçla aynı
        }
    }

    function updateClock() {
        const now = new Date();
        const hour = now.getHours().toString().padStart(2, '0');
        const min = now.getMinutes().toString().padStart(2, '0');
        document.getElementById('clock').textContent = `${hour}:${min}`;

        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('date-display').textContent = now.toLocaleDateString('tr-TR', options);
    }

    // JS Date.toISOString() UTC verir, bize local lazım (input type=datetime-local için)
    // Basit bir hack ile yerel saati ISO formatına benzetiyoruz
    function toLocalISOString(dateStrOrObj) {
        const date = new Date(dateStrOrObj);
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        const msLocal = date.getTime() - offsetMs;
        const dateLocal = new Date(msLocal);
        return dateLocal.toISOString().slice(0, 16);
    }
});
