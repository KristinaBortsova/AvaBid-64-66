document.addEventListener('DOMContentLoaded', () => {
    // Ищем кнопку либо по ID (если есть), либо по классу .bell-btn
    const bellBtn = document.getElementById('notification-bell') || document.querySelector('.bell-btn');
    if (!bellBtn) return;

    // Создаем контейнер для выпадающего списка
    const dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.style.cssText = `
        display: none; position: absolute; top: 90px; right: 20px; width: 350px; max-height: 400px;
        background: #fff; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        z-index: 1000; overflow-y: auto; padding: 20px; border: 2px solid #5F6E63;
    `;
    
    // Вставляем после хедера (чтобы позиционировалось относительно него)
    const header = document.querySelector('.top-header');
    if (header) {
        header.style.position = 'relative'; 
        header.appendChild(dropdown);
    }

    bellBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
            return;
        }

        // Проверка авторизации напрямую через токен
        const token = localStorage.getItem('avabid_token');
        if (!token) {
            alert('Войдите в аккаунт, чтобы увидеть уведомления.');
            window.location.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
            return;
        }

        dropdown.innerHTML = '<p style="text-align:center; color:#7A8F80;">Загрузка...</p>';
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
                dropdown.innerHTML = '<p style="text-align:center; color:#7A8F80;">У вас нет новых уведомлений.</p>';
                return;
            }

            dropdown.innerHTML = `
                <h3 style="color: #5F6E63; margin-bottom: 15px; font-size: 18px;">Уведомления</h3>
                ${notifications.map(n => `
                    <div style="padding: 15px; border-bottom: 1px solid #E8EFE5; background: ${n.isRead ? 'transparent' : '#F5F7F5'}; border-radius: 10px; margin-bottom: 10px;">
                        <div style="color: #353F37; font-weight: 700; font-size: 14px; margin-bottom: 5px;">${n.title}</div>
                        <div style="color: #5F6E63; font-size: 14px; line-height: 1.4; white-space: pre-wrap;">${n.message}</div>
                        <div style="color: #A6A6A6; font-size: 12px; margin-top: 8px;">${new Date(n.createdAt).toLocaleString('ru-RU')}</div>
                    </div>
                `).join('')}
            `;

            // Помечаем как прочитанные
            fetch('/api/notifications/read', {
               method: 'PUT',
               headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Ошибка уведомлений:', error);
            dropdown.innerHTML = '<p style="text-align:center; color:#c0392b;">Ошибка загрузки.</p>';
        }
    });

    // Закрытие при клике вне окна
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== bellBtn) {
            dropdown.style.display = 'none';
        }
    });
});