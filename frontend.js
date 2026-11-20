const API_URL = '/api';

async function loadLotsOnHomePage() {
  const lotsGrid = document.querySelector('.lots-grid');
  if (!lotsGrid) return;

  try {
    const response = await fetch(`${API_URL}/lots`);
    const lots = await response.json();
    lotsGrid.innerHTML = '';

    lots.forEach((lot) => {
      const card = document.createElement('a');
      card.href = `pages/lot.html?id=${lot.id}`;
      card.className = 'lot-card';

      let timeLeftText = '—';
      if (lot.endTime) {
        const diffMs = new Date(lot.endTime) - new Date();
        if (diffMs > 0) {
          const totalHours = Math.floor(diffMs / 3600000);
          const days = Math.floor(totalHours / 24);
          const hours = totalHours % 24;
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          if (days > 0) timeLeftText = `${days}д ${hours}ч`;
          else if (hours > 0) timeLeftText = `${hours}ч ${minutes}м`;
          else timeLeftText = `${minutes}м`;
        } else {
          timeLeftText = 'Завершён';
        }
      }

      card.innerHTML = `
        <div class="lot-image-wrapper">
          <img src="${lot.image || 'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images/1.jpg'}" alt="${lot.name}">
        </div>
        <div class="lot-info">
          <div class="lot-header">
            <span class="lot-name">${lot.name}</span>
            <span class="lot-time">Осталось ${timeLeftText}</span>
          </div>
          <div class="lot-price">${lot.currentPrice} ₽</div>
        </div>
      `;
      lotsGrid.appendChild(card);
    });
  } catch (error) {
    console.error('Ошибка загрузки лотов:', error);
    lotsGrid.innerHTML = '<p style="color:red; text-align:center; width:100%">Не удалось загрузить лоты. Проверьте, запущен ли сервер.</p>';
  }
}

async function loadLotDetails() {
  const lotTitle = document.getElementById('lot-title');
  if (!lotTitle) return;

  const urlParams = new URLSearchParams(window.location.search);
  const lotId = urlParams.get('id');
  if (!lotId) { lotTitle.textContent = 'Лот не найден'; return; }

  try {
    const response = await fetch(`${API_URL}/lots/${lotId}`);
    if (!response.ok) throw new Error('Лот не найден');
    const lot = await response.json();

    lotTitle.textContent = lot.name;

    const lotImage = document.getElementById('lot-image');
    if (lotImage) lotImage.src = lot.image || 'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images/1.jpg';

    const isExpired = lot.endTime && new Date(lot.endTime) < new Date();
    
    // 1. Меняем текст текущей ставки
    const bidInfo = document.querySelector('.lot-bid-info');
    if (bidInfo) {
      bidInfo.textContent = isExpired ? `АУКЦИОН ЗАВЕРШЕН. ПРОДАН ЗА: ${lot.currentPrice} ₽` : `ТЕКУЩАЯ СТАВКА: ${lot.currentPrice} ₽`;
    }

    // 2. Блокируем кнопку "Сделать ставку"
    const bidBtn = document.getElementById('make-bid-btn');
    if (bidBtn && isExpired) {
      bidBtn.disabled = true;
      bidBtn.textContent = 'АУКЦИОН ЗАВЕРШЕН';
      bidBtn.style.opacity = '0.5';
      bidBtn.style.cursor = 'not-allowed';
    }

    // Проверка, является ли текущий пользователь автором лота
    const currentUser = JSON.parse(localStorage.getItem('avabid_user'));
    if (currentUser && Number(currentUser.id) === Number(lot.authorId)) {
        // Если это автор — прячем кнопку ставки
        if (bidBtn) bidBtn.style.display = 'none';
    }
    //4. Проверка админа(Кнопка удаления)
    const adminDeleteBtn = document.getElementById('admin-delete-lot-btn');
    if (adminDeleteBtn) {
        const currentUser = JSON.parse(localStorage.getItem('avabid_user'));
        // Показываем кнопку, только если это админ
        if (currentUser && currentUser.role === 'Администратор') {
            adminDeleteBtn.style.display = 'block';
            
            adminDeleteBtn.onclick = async () => {
                const reason = prompt('Укажите причину удаления лота (автор получит уведомление):');
                
                if (reason === null) return; // Если нажали "Отмена" в окне prompt
                if (!reason.trim()) {
                    alert('Причина обязательна для заполнения!');
                    return;
                }

                if (!confirm(`Вы уверены, что хотите удалить лот "${lot.name}"?`)) return;

                try {
                    const res = await fetch(`${API_URL}/lots/${lotId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('avabid_token')}`
                        },
                        body: JSON.stringify({ reason: reason })
                    });

                    if (res.ok) {
                        alert('Лот удален. Автору отправлено уведомление.');
                        window.location.href = '../index.html'; // Перенаправляем на главную
                    } else {
                        const err = await res.json();
                        alert(err.error || 'Ошибка удаления');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Ошибка сервера при удалении');
                }
            };
        }
    }

    // 5. Ссылка на автора и его аватарка
    const authorLink = document.getElementById('author-link');
    if (authorLink) {
      authorLink.textContent = lot.author;
      authorLink.href = `user-profile.html?id=${lot.authorId}`;
    }
    
    const authorAvatarImg = document.querySelector('.author-avatar img');
    if (authorAvatarImg) {
      authorAvatarImg.src = lot.authorAvatar || 'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images/1.jpg';
    }

    const descDiv = document.querySelector('.lot-description');
    if (descDiv) descDiv.innerHTML = `<span>ОПИСАНИЕ:</span> ${lot.description || 'Без описания'}`;

    if (lot.endTime) startCountdown(new Date(lot.endTime));

        const bidsList = document.querySelector('.lot-bids-list');
    if (bidsList && lot.bids.length > 0) {
      bidsList.innerHTML = lot.bids.map((bid) => `
        <div class="bid-item" style="display: flex; justify-content: space-between; align-items: center;">
          
          <a href="user-profile.html?id=${bid.userId}" style="display: flex; align-items: center; gap: 15px; text-decoration: none; color: inherit;">
            <div class="bid-avatar">
                <img src="${bid.userAvatar || 'https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images/1.jpg'}" alt="Avatar">
            </div>
            <span class="bid-name">${bid.userName}:</span>
          </a>

          <span class="bid-amount">${bid.price}₽</span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Ошибка загрузки лота:', error);
    lotTitle.textContent = 'Ошибка загрузки';
  }
}

function startCountdown(endTime) {
  const countdownElement = document.getElementById('countdown');
  if (!countdownElement) return;

  const timer = setInterval(() => {
    const now = new Date();
    const diff = Math.max(0, Math.floor((endTime - now) / 1000));
    if (diff <= 0) {
      clearInterval(timer);
      countdownElement.textContent = '00:00:00';
      return;
    }
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    countdownElement.textContent =
      String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0');
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadLotsOnHomePage();
  loadLotDetails();
});