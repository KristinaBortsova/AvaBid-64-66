document.addEventListener('DOMContentLoaded', () => {
    // 1. Ищем кнопку колокольчика
    const bellBtn = document.getElementById('notification-bell') || document.querySelector('.bell-btn');
    if (!bellBtn) return;

    // 2. Внедряем CSS стили для уведомлений (чтобы работала темная тема и клики)
    if (!document.getElementById('notifications-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'notifications-custom-styles';
        style.innerHTML = `
            #notification-dropdown {
                display: none; position: absolute; top: 90px; right: 20px; width: 350px; max-height: 450px;
                background: #fff; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                z-index: 1000; overflow-y: auto; padding: 20px; border: 2px solid #5F6E63;
            }
            .dark-mode #notification-dropdown {
                background: #1a1a1a; border-color: #5F6E63; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            }
            .notif-item {
                padding: 15px; border: 1px solid #E8EFE5; border-radius: 10px; margin-bottom: 10px;
                transition: transform 0.2s, background 0.2s;
            }
            .dark-mode .notif-item { border-color: #333; }
            .notif-item.read { background: transparent; }
            .notif-item.unread { background: #F5F7F5; }
            .dark-mode .notif-item.unread { background: #2a2a2a; }
            .notif-item.clickable { cursor: pointer; border: 2px solid #5F6E63; }
            .notif-item.clickable:hover { transform: scale(1.02); background: #E8EFE5; }
            .dark-mode .notif-item.clickable:hover { background: #333; }
            .notif-title { color: #353F37; font-weight: 700; font-size: 14px; margin-bottom: 5px; }
            .dark-mode .notif-title { color: #E8EFE5; }
            .notif-message { color: #5F6E63; font-size: 14px; line-height: 1.4; white-space: pre-wrap; }
            .dark-mode .notif-message { color: #A6A6A6; }
            .notif-link-hint { color: #c0392b; font-size: 12px; margin-top: 5px; font-weight: bold; }
            .notif-date { color: #A6A6A6; font-size: 12px; margin-top: 8px; }
            .notif-empty { text-align: center; color: #7A8F80; }
        `;
        document.head.appendChild(style);
    }

    // 3. Создаем контейнер для выпадающего списка
    const dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    
    // Вставляем после хедера
    const header = document.querySelector('.top-header');
    if (header) {
        header.style.position = 'relative'; 
        header.appendChild(dropdown);
    }

    // 4. Обработчик клика по колокольчику
    bellBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Если уже открыто - закрываем
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
            return;
        }

        // Проверка авторизации
        const token = localStorage.getItem('avabid_token');
        if (!token) {
            alert('Войдите в аккаунт, чтобы увидеть уведомления.');
            window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
            return;
        }

        dropdown.innerHTML = '<p class="notif-empty">Загрузка...</p>';
        dropdown.style.display = 'block';

        try {
            const res = await fetch('/api/notifications', {
               headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('avabid_token');
                window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
                return;
            }

            const notifications = await res.json();

            if (notifications.length === 0) {
                dropdown.innerHTML = '<p class="notif-empty">У вас нет новых уведомлений.</p>';
                return;
            }

            // 5. Рендерим список
            dropdown.innerHTML = `
                <h3 style="color: #5F6E63; margin-bottom: 15px; font-size: 18px;">Уведомления</h3>
                ${notifications.map(n => {
                    // Проверяем, есть ли ссылка для перехода (наше новое поле linkUrl)
                    const isClickable = n.linkUrl ? `onclick="window.location.href='${n.linkUrl}'"` : '';
                    const clickableClass = n.linkUrl ? 'clickable' : '';
                    const readClass = n.isRead ? 'read' : 'unread';

                    return `
                    <div ${isClickable} class="notif-item ${readClass} ${clickableClass}">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-message">${n.message}</div>
                        ${n.linkUrl ? `<div class="notif-link-hint">👉 Нажмите, чтобы перейти в чат</div>` : ''}
                        <div class="notif-date">${new Date(n.createdAt).toLocaleString('ru-RU')}</div>
                    </div>
                    `;
                }).join('')}
            `;

            // Помечаем как прочитанные
            fetch('/api/notifications/read', {
               method: 'PUT',
               headers: { 'Authorization': `Bearer ${token}` }
            });
            
        } catch (error) {
            console.error('Ошибка уведомлений:', error);
            dropdown.innerHTML = '<p class="notif-empty" style="color:#c0392b;">Ошибка загрузки.</p>';
        }
    });

    // 6. Закрытие при клике вне окна
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
});