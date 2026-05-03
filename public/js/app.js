const API_BASE = '/api';

let movies = [];
let currentEditId = null;
let currentDeleteId = null;
let selectedImageUrl = null;

const elements = {
  addNewBtn: document.getElementById('addNewBtn'),
  moviesGrid: document.getElementById('moviesGrid'),
  statusBar: document.getElementById('statusBar'),
  movieModal: document.getElementById('movieModal'),
  deleteModal: document.getElementById('deleteModal'),
  modalTitle: document.getElementById('modalTitle'),
  movieTitle: document.getElementById('movieTitle'),
  releaseYear: document.getElementById('releaseYear'),
  imageInput: document.getElementById('imageInput'),
  imagePreview: document.getElementById('imagePreview'),
  previewImg: document.getElementById('previewImg'),
  removeImageBtn: document.getElementById('removeImageBtn'),
  saveBtn: document.getElementById('saveBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  closeModal: document.getElementById('closeModal'),
  deleteMovieTitle: document.getElementById('deleteMovieTitle'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  closeDeleteModal: document.getElementById('closeDeleteModal'),
};

function setStatus(message, type = 'info') {
  elements.statusBar.textContent = message;
  elements.statusBar.className = 'status-bar ' + type;
  setTimeout(() => {
    elements.statusBar.textContent = '';
    elements.statusBar.className = 'status-bar';
  }, 3000);
}

function setPreview(url) {
  if (url) {
    elements.previewImg.src = url;
    elements.previewImg.style.display = 'block';
    elements.imagePreview.querySelector('.placeholder').style.display = 'none';
    elements.removeImageBtn.style.display = 'inline-flex';
  } else {
    elements.previewImg.src = '';
    elements.previewImg.style.display = 'none';
    elements.imagePreview.querySelector('.placeholder').style.display = 'block';
    elements.removeImageBtn.style.display = 'none';
  }
}

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await fetch(`${API_BASE}/upload-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: e.target.result,
            filename: file.name.replace(/\.[^/.]+$/, '')
          }),
        });
        const data = await res.json();
        resolve(data.url);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadMovies() {
  try {
    const res = await fetch(`${API_BASE}/documents`);
    const docs = await res.json();
    if (!Array.isArray(docs)) {
      setStatus('Failed to load movies', 'error');
      return;
    }
    movies = docs;
    renderMovies(movies);
    setStatus(`Loaded ${movies.length} movies`, 'success');
  } catch (error) {
    setStatus('Failed to load movies', 'error');
  }
}

function renderMovies(moviesList) {
  if (moviesList.length === 0) {
    elements.moviesGrid.innerHTML = '<div class="empty-state">No movies found</div>';
    return;
  }

  elements.moviesGrid.innerHTML = moviesList.map(movie => {
    const title = movie.titleText?.text || 'Unknown';
    const year = movie.releaseDate?.year || '';
    const id = movie.id || '';
    const poster = movie.primaryImage?.url || '';

    const posterHtml = poster
      ? `<img class="movie-poster" src="${poster}" alt="${title}" loading="lazy">`
      : `<div class="movie-poster-placeholder">🎬</div>`;

    return `
      <div class="movie-card">
        ${posterHtml}
        <div class="movie-info">
          <div class="movie-title">${escapeHtml(title)}</div>
          ${year ? `<div class="movie-year">${year}</div>` : ''}
          <div class="movie-actions">
            <button class="btn btn-secondary btn-icon" onclick="event.stopPropagation(); editMovie('${id}')">Edit</button>
            <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); confirmDelete('${id}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openModal(modal) { modal.classList.add('active'); }
function closeModalFn(modal) { modal.classList.remove('active'); }

elements.addNewBtn.addEventListener('click', () => {
  currentEditId = null;
  elements.modalTitle.textContent = 'Add Movie';
  elements.movieTitle.value = '';
  elements.releaseYear.value = '';
  selectedImageUrl = null;
  setPreview(null);
  elements.imageInput.value = '';
  openModal(elements.movieModal);
});

elements.cancelBtn.addEventListener('click', () => closeModalFn(elements.movieModal));
elements.closeModal.addEventListener('click', () => closeModalFn(elements.movieModal));

elements.imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    setStatus('Uploading...', 'info');
    const url = await uploadImage(file);
    selectedImageUrl = url;
    setPreview(url);
    setStatus('Image uploaded', 'success');
  } catch (error) {
    setStatus('Upload failed', 'error');
  }
});

elements.removeImageBtn.addEventListener('click', () => {
  selectedImageUrl = null;
  setPreview(null);
  elements.imageInput.value = '';
});

elements.saveBtn.addEventListener('click', async () => {
  const title = elements.movieTitle.value.trim();
  if (!title) {
    setStatus('Title is required', 'error');
    return;
  }

  const year = parseInt(elements.releaseYear.value) || null;
  const movieData = {
    titleText: { text: title },
    releaseDate: { day: null, month: null, year: year, country: { id: null, text: null } }
  };

  if (selectedImageUrl) {
    movieData.primaryImage = { url: selectedImageUrl, width: 800, height: 1200 };
  }

  try {
    if (currentEditId) {
      await fetch(`${API_BASE}/documents/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieData),
      });
      setStatus('Movie updated', 'success');
    } else {
      const id = `movie_${Date.now()}`;
      await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...movieData }),
      });
      setStatus('Movie added', 'success');
    }
    closeModalFn(elements.movieModal);
    loadMovies();
  } catch (error) {
    setStatus('Failed: ' + error.message, 'error');
  }
});

window.editMovie = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    const movie = await res.json();
    currentEditId = id;
    elements.modalTitle.textContent = 'Edit Movie';
    elements.movieTitle.value = movie.titleText?.text || '';
    elements.releaseYear.value = movie.releaseDate?.year || '';
    selectedImageUrl = movie.primaryImage?.url || null;
    setPreview(selectedImageUrl);
    elements.imageInput.value = '';
    openModal(elements.movieModal);
  } catch (error) {
    setStatus('Failed to load movie', 'error');
  }
};

window.confirmDelete = (id) => {
  currentDeleteId = id;
  const movie = movies.find(m => m.id === id);
  elements.deleteMovieTitle.textContent = movie?.titleText?.text || id;
  openModal(elements.deleteModal);
};

elements.cancelDeleteBtn.addEventListener('click', () => closeModalFn(elements.deleteModal));
elements.closeDeleteModal.addEventListener('click', () => closeModalFn(elements.deleteModal));

elements.confirmDeleteBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/documents/${currentDeleteId}`, { method: 'DELETE' });
    setStatus('Movie deleted', 'success');
    closeModalFn(elements.deleteModal);
    loadMovies();
  } catch (error) {
    setStatus('Failed to delete', 'error');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModalFn(elements.movieModal);
    closeModalFn(elements.deleteModal);
  }
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

loadMovies();
