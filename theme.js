document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, сохранена ли тема в localStorage
    const savedTheme = localStorage.getItem('theme');

    // Если сохранена темная тема, применяем класс
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});

// Функция для переключения темы
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}