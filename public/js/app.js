const API_BASE = '/api';

let documents = [];
let currentEditId = null;
let currentDeleteId = null;

const elements = {
  bucketSelect: document.getElementById('bucketSelect'),
  scopeSelect: document.getElementById('scopeSelect'),
  collectionSelect: document.getElementById('collectionSelect'),
  refreshCollections: document.getElementById('refreshCollections'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  n1qlInput: document.getElementById('n1qlInput'),
  queryBtn: document.getElementById('queryBtn'),
  addNewBtn: document.getElementById('addNewBtn'),
  documentsBody: document.getElementById('documentsBody'),
  statusBar: document.getElementById('statusBar'),
  documentModal: document.getElementById('documentModal'),
  viewModal: document.getElementById('viewModal'),
  deleteModal: document.getElementById('deleteModal'),
  modalTitle: document.getElementById('modalTitle'),
  docId: document.getElementById('docId'),
  docContent: document.getElementById('docContent'),
  saveBtn: document.getElementById('saveBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  closeModal: document.getElementById('closeModal'),
  viewDocId: document.getElementById('viewDocId'),
  viewDocContent: document.getElementById('viewDocContent'),
  closeViewModal: document.getElementById('closeViewModal'),
  closeViewBtn: document.getElementById('closeViewBtn'),
  deleteDocId: document.getElementById('deleteDocId'),
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

async function loadBuckets() {
  try {
    const res = await fetch(`${API_BASE}/buckets`);
    const buckets = await res.json();
    elements.bucketSelect.innerHTML = buckets.map((b) => `<option value="${b}">${b}</option>`).join('');
    loadCollections();
  } catch (error) {
    setStatus('Failed to load buckets: ' + error.message, 'error');
  }
}

async function loadCollections() {
  try {
    const params = new URLSearchParams({
      bucket: elements.bucketSelect.value,
      scope: elements.scopeSelect.value,
    });
    const res = await fetch(`${API_BASE}/collections?${params}`);
    const collections = await res.json();
    elements.collectionSelect.innerHTML = collections.map((c) => `<option value="${c}">${c}</option>`).join('');
    loadDocuments();
  } catch (error) {
    setStatus('Failed to load collections: ' + error.message, 'error');
  }
}

async function loadDocuments() {
  try {
    const params = new URLSearchParams({
      bucket: elements.bucketSelect.value,
      scope: elements.scopeSelect.value,
      collectionName: elements.collectionSelect.value,
    });
    const res = await fetch(`${API_BASE}/documents?${params}`);
    const docs = await res.json();
    if (!Array.isArray(docs)) {
      setStatus('Failed to load documents: ' + (docs.error || 'Invalid response'), 'error');
      return;
    }
    documents = docs;
    renderDocuments(documents);
    setStatus(`Loaded ${documents.length} documents`, 'success');
  } catch (error) {
    setStatus('Failed to load documents: ' + error.message, 'error');
  }
}

function renderDocuments(docs) {
  if (!Array.isArray(docs) || docs.length === 0) {
    elements.documentsBody.innerHTML = '<tr><td colspan="4" class="empty-state">No documents found</td></tr>';
    return;
  }

  elements.documentsBody.innerHTML = docs
    .map((doc) => {
      const id = doc.id || Object.keys(doc)[0];
      const content = doc[id] || doc;
      const type = content.type || 'document';
      const preview = JSON.stringify(content).substring(0, 80);

      return `
        <tr>
          <td class="doc-id">${id}</td>
          <td><span class="doc-type">${type}</span></td>
          <td class="doc-preview">${escapeHtml(preview)}...</td>
          <td class="actions">
            <button class="btn btn-secondary btn-icon" onclick="viewDocument('${id}')">View</button>
            <button class="btn btn-secondary btn-icon" onclick="editDocument('${id}')">Edit</button>
            <button class="btn btn-danger btn-icon" onclick="confirmDelete('${id}')">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openModal(modal) {
  modal.classList.add('active');
}

function closeModalFn(modal) {
  modal.classList.remove('active');
}

elements.addNewBtn.addEventListener('click', () => {
  currentEditId = null;
  elements.modalTitle.textContent = 'Create Document';
  elements.docId.value = '';
  elements.docContent.value = '';
  openModal(elements.documentModal);
});

elements.cancelBtn.addEventListener('click', () => closeModalFn(elements.documentModal));
elements.closeModal.addEventListener('click', () => closeModalFn(elements.documentModal));

elements.saveBtn.addEventListener('click', async () => {
  const contentStr = elements.docContent.value.trim();

  if (!contentStr) {
    setStatus('Document content cannot be empty', 'error');
    return;
  }

  let content;
  try {
    content = JSON.parse(contentStr);
  } catch (error) {
    setStatus('Invalid JSON format', 'error');
    return;
  }

  try {
    if (currentEditId) {
      await fetch(`${API_BASE}/documents/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      setStatus('Document updated successfully', 'success');
    } else {
      const id = elements.docId.value.trim();
      const doc = id ? { id, ...content } : content;
      await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      setStatus('Document created successfully', 'success');
    }
    closeModalFn(elements.documentModal);
    loadDocuments();
  } catch (error) {
    setStatus('Operation failed: ' + error.message, 'error');
  }
});

window.viewDocument = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    const doc = await res.json();
    elements.viewDocId.textContent = id;
    elements.viewDocContent.textContent = JSON.stringify(doc, null, 2);
    openModal(elements.viewModal);
  } catch (error) {
    setStatus('Failed to load document: ' + error.message, 'error');
  }
};

elements.closeViewModal.addEventListener('click', () => closeModalFn(elements.viewModal));
elements.closeViewBtn.addEventListener('click', () => closeModalFn(elements.viewModal));

window.editDocument = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    const doc = await res.json();
    const { id: _, ...content } = doc;
    currentEditId = id;
    elements.modalTitle.textContent = 'Edit Document';
    elements.docId.value = id;
    elements.docId.disabled = true;
    elements.docContent.value = JSON.stringify(content, null, 2);
    openModal(elements.documentModal);
  } catch (error) {
    setStatus('Failed to load document: ' + error.message, 'error');
  }
};

elements.documentModal.addEventListener('transitionend', () => {
  if (!elements.documentModal.classList.contains('active')) {
    elements.docId.disabled = false;
  }
});

window.confirmDelete = (id) => {
  currentDeleteId = id;
  elements.deleteDocId.textContent = id;
  openModal(elements.deleteModal);
};

elements.cancelDeleteBtn.addEventListener('click', () => closeModalFn(elements.deleteModal));
elements.closeDeleteModal.addEventListener('click', () => closeModalFn(elements.deleteModal));

elements.confirmDeleteBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/documents/${currentDeleteId}`, { method: 'DELETE' });
    setStatus('Document deleted successfully', 'success');
    closeModalFn(elements.deleteModal);
    loadDocuments();
  } catch (error) {
    setStatus('Failed to delete document: ' + error.message, 'error');
  }
});

elements.searchBtn.addEventListener('click', () => {
  const query = elements.searchInput.value.trim().toLowerCase();
  if (!query) {
    loadDocuments();
    return;
  }

  const filtered = documents.filter((doc) => {
    const id = doc.id || Object.keys(doc)[0];
    const content = doc[id] || doc;
    const text = JSON.stringify({ id, ...content }).toLowerCase();
    return text.includes(query);
  });

  renderDocuments(filtered);
  setStatus(`Found ${filtered.length} matching documents`, 'success');
});

elements.queryBtn.addEventListener('click', async () => {
  const n1ql = elements.n1qlInput.value.trim();
  if (!n1ql) {
    loadDocuments();
    return;
  }

  try {
    const params = new URLSearchParams({ query: n1ql });
    const res = await fetch(`${API_BASE}/documents?${params}`);
    const results = await res.json();
    
    if (!Array.isArray(results)) {
      setStatus('Query failed: ' + (results.error || 'Invalid response'), 'error');
      return;
    }

    documents = results;
    renderDocuments(results);
    setStatus(`Query returned ${results.length} results`, 'success');
  } catch (error) {
    setStatus('Query failed: ' + error.message, 'error');
  }
});

elements.bucketSelect.addEventListener('change', loadCollections);
elements.collectionSelect.addEventListener('change', loadDocuments);
elements.refreshCollections.addEventListener('click', loadCollections);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModalFn(elements.documentModal);
    closeModalFn(elements.viewModal);
    closeModalFn(elements.deleteModal);
  }
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

elements.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elements.searchBtn.click();
});

elements.n1qlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elements.queryBtn.click();
});

loadBuckets();
