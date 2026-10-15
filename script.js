document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            
            // Убираем активный класс у всех
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Добавляем активный класс текущему
            item.classList.add('active');
        });
    });
});