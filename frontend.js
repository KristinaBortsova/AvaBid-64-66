const API_URL = 'http://localhost:3000/api';

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

    const bidInfo = document.querySelector('.lot-bid-info');
    if (bidInfo) bidInfo.textContent = `ТЕКУЩАЯ СТАВКА: ${lot.currentPrice} ₽`;

    const authorSpan = document.querySelector('.lot-author span:last-child');
    if (authorSpan) authorSpan.textContent = lot.author;

    const descDiv = document.querySelector('.lot-description');
    if (descDiv) descDiv.innerHTML = `<span>ОПИСАНИЕ:</span> ${lot.description || 'Без описания'}`;

    if (lot.endTime) startCountdown(new Date(lot.endTime));

    const bidsList = document.querySelector('.lot-bids-list');
    if (bidsList && lot.bids.length > 0) {
      bidsList.innerHTML = lot.bids.map((bid) => `
        <div class="bid-item">
          <div class="bid-avatar"><img src="https://utyklerfkkcbequrikil.supabase.co/storage/v1/object/public/avabid-images/1.jpg" alt="Avatar"></div>
          <span class="bid-name">${bid.userName}:</span>
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