(() => {
  const listEl = document.getElementById('contactList');
  const emptyStateEl = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const detailEmpty = document.getElementById('detailEmpty');
  const detailView = document.getElementById('detailView');
  const editForm = document.getElementById('editForm');
  const detailPane = document.getElementById('detailPane');
  const addBtn = document.getElementById('addBtn');
  const menuBtn = document.getElementById('menuBtn');
  const themeBtn = document.getElementById('themeBtn');
  const menuPopover = document.getElementById('menuPopover');
  const importFile = document.getElementById('importFile');
  const toastEl = document.getElementById('toast');

  const AVATAR_GRADIENTS = [
    ['#4f46e5', '#9333ea'],
    ['#06b6d4', '#4f46e5'],
    ['#f472b6', '#9333ea'],
    ['#e0a92a', '#e5484d'],
    ['#0f7a6c', '#06b6d4'],
    ['#9333ea', '#4f46e5']
  ];

  const FIELD_KIND_CONFIG = {
    phone: { labels: ['Mobile', 'Home', 'Work', 'Other'], inputType: 'tel', placeholder: 'Phone number' },
    email: { labels: ['Home', 'Work', 'Other'], inputType: 'email', placeholder: 'Email address' },
    social: { labels: ['Instagram', 'Twitter/X', 'Facebook', 'LinkedIn', 'TikTok', 'Other'], inputType: 'text', placeholder: 'Username or link' }
  };

  let contacts = [];
  let activeId = null;
  let isEditing = false;

  // ---------- Helpers ----------

  function initials(c) {
    const f = (c.firstName || '').trim();
    const l = (c.lastName || '').trim();
    const s = ((f[0] || '') + (l[0] || '')).toUpperCase();
    return s || '?';
  }

  function fullName(c) {
    const n = `${c.firstName || ''} ${c.lastName || ''}`.trim();
    return n || 'No name';
  }

  function colorFor(c) {
    const key = fullName(c);
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const [a, b] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  function applyAvatarVisual(el, c) {
    if (c.photo) {
      el.style.backgroundImage = `url('${c.photo}')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.background = '';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.style.background = colorFor(c);
      el.textContent = initials(c);
    }
  }

  function formatBirthday(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function socialUrl(label, value) {
    const v = (value || '').trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    const handle = v.replace(/^@/, '');
    switch (label) {
      case 'Instagram': return `https://instagram.com/${handle}`;
      case 'Twitter/X': return `https://x.com/${handle}`;
      case 'Facebook': return `https://facebook.com/${handle}`;
      case 'LinkedIn': return `https://www.linkedin.com/in/${handle}`;
      case 'TikTok': return `https://www.tiktok.com/@${handle}`;
      default: return null;
    }
  }

  function resizeImageFile(file, maxSize = 320, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Decode failed'));
        img.onload = () => {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          const scale = Math.min(1, maxSize / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // ---------- Data loading ----------

  async function loadContacts() {
    contacts = await api('/api/contacts');
    renderList();
  }

  // ---------- List rendering ----------

  function renderList() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = contacts.filter(c => {
      if (!query) return true;
      const hay = [
        fullName(c), c.company, c.relationship,
        ...(c.phones || []).map(p => p.value),
        ...(c.emails || []).map(e => e.value),
        ...(c.socialProfiles || []).map(s => s.value)
      ].join(' ').toLowerCase();
      return hay.includes(query);
    });

    listEl.innerHTML = '';
    emptyStateEl.hidden = contacts.length !== 0;

    let lastLetter = null;
    for (const c of filtered) {
      const letter = (c.lastName || c.firstName || '#').trim()[0]?.toUpperCase() || '#';
      if (letter !== lastLetter) {
        lastLetter = letter;
        const label = document.createElement('div');
        label.className = 'letter-group-label';
        label.textContent = letter;
        listEl.appendChild(label);
      }
      const row = document.createElement('div');
      row.className = 'contact-row' + (c.id === activeId ? ' active' : '');
      row.dataset.id = c.id;

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      applyAvatarVisual(avatar, c);

      const text = document.createElement('div');
      text.className = 'row-text';
      const nameEl = document.createElement('div');
      nameEl.className = 'row-name';
      nameEl.textContent = fullName(c);
      const subEl = document.createElement('div');
      subEl.className = 'row-sub';
      subEl.textContent = c.company || c.relationship || (c.phones?.[0]?.value) || (c.emails?.[0]?.value) || '';
      text.append(nameEl, subEl);

      row.append(avatar, text);
      if (c.favorite) {
        const star = document.createElement('div');
        star.className = 'fav-star';
        star.textContent = '★';
        row.appendChild(star);
      }

      row.addEventListener('click', () => selectContact(c.id));
      listEl.appendChild(row);
    }
  }

  // ---------- Detail rendering ----------

  function selectContact(id) {
    activeId = id;
    isEditing = false;
    renderList();
    renderDetail();
    detailPane.classList.add('show');
  }

  function closeDetail() {
    activeId = null;
    isEditing = false;
    detailPane.classList.remove('show');
    renderList();
    renderDetail();
  }

  function fieldRow(label, value, href) {
    if (!value) return '';
    const inner = href ? `<a href="${href}">${escapeHtml(value)}</a>` : escapeHtml(value);
    return `<div class="detail-field"><div class="field-label">${label}</div><div class="field-value">${inner}</div></div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function renderDetail() {
    editForm.hidden = true;
    if (!activeId) {
      detailEmpty.hidden = false;
      detailView.hidden = true;
      return;
    }
    const c = contacts.find(x => x.id === activeId);
    if (!c) { detailEmpty.hidden = false; detailView.hidden = true; return; }

    detailEmpty.hidden = true;
    detailView.hidden = false;

    const phonesHtml = (c.phones || []).map(p => fieldRow(p.label || 'Phone', p.value, `tel:${p.value}`)).join('');
    const emailsHtml = (c.emails || []).map(e => fieldRow(e.label || 'Email', e.value, `mailto:${e.value}`)).join('');
    const socialHtml = (c.socialProfiles || []).map(s => fieldRow(s.label || 'Social', s.value, socialUrl(s.label, s.value))).join('');
    const addressHtml = fieldRow('Address', c.address);
    const relationshipHtml = fieldRow('Relationship', c.relationship);
    const birthdayHtml = fieldRow('Birthday', formatBirthday(c.birthday));
    const notesHtml = c.notes ? `<div class="detail-section"><div class="field-label" style="margin-bottom:6px;">Notes</div><div class="notes-box">${escapeHtml(c.notes)}</div></div>` : '';

    detailView.innerHTML = `
      <div class="detail-top-bar">
        <button class="back-btn" id="backBtn">‹ Contacts</button>
      </div>
      <div class="detail-hero">
        <div class="avatar" id="heroAvatar"></div>
        <h2>${escapeHtml(fullName(c))}</h2>
        ${c.company ? `<div class="company">${escapeHtml(c.company)}</div>` : ''}
        <div class="detail-actions">
          <button class="pill-btn" id="editBtn">Edit</button>
          <button class="pill-btn" id="favBtn">${c.favorite ? '★ Favorited' : '☆ Favorite'}</button>
          <button class="pill-btn danger" id="deleteBtn">Delete</button>
        </div>
      </div>
      ${relationshipHtml || birthdayHtml ? `<div class="detail-section">${relationshipHtml}${birthdayHtml}</div>` : ''}
      ${phonesHtml || emailsHtml ? `<div class="detail-section">${phonesHtml}${emailsHtml}</div>` : ''}
      ${socialHtml ? `<div class="detail-section">${socialHtml}</div>` : ''}
      ${addressHtml ? `<div class="detail-section">${addressHtml}</div>` : ''}
      ${notesHtml}
    `;

    applyAvatarVisual(document.getElementById('heroAvatar'), c);
    document.getElementById('backBtn')?.addEventListener('click', closeDetail);
    document.getElementById('editBtn').addEventListener('click', () => startEdit(c));
    document.getElementById('favBtn').addEventListener('click', () => toggleFavorite(c));
    document.getElementById('deleteBtn').addEventListener('click', () => deleteContact(c));
  }

  async function toggleFavorite(c) {
    const updated = await api(`/api/contacts/${c.id}`, { method: 'PUT', body: JSON.stringify({ favorite: !c.favorite }) });
    const idx = contacts.findIndex(x => x.id === c.id);
    contacts[idx] = updated;
    renderList();
    renderDetail();
  }

  async function deleteContact(c) {
    if (!confirm(`Delete ${fullName(c)}? This can't be undone.`)) return;
    await api(`/api/contacts/${c.id}`, { method: 'DELETE' });
    contacts = contacts.filter(x => x.id !== c.id);
    closeDetail();
    showToast('Contact deleted');
  }

  // ---------- Edit form ----------

  function repeatField(containerId, items, kind) {
    const cfg = FIELD_KIND_CONFIG[kind];
    const rows = (items.length ? items : [{ label: cfg.labels[0], value: '' }])
      .map((item, i) => `
        <div class="repeat-row" data-idx="${i}">
          <select class="row-label">
            ${cfg.labels.map(l => `<option value="${l}" ${l === item.label ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <input type="${cfg.inputType}" class="row-value" value="${escapeHtml(item.value || '')}" placeholder="${cfg.placeholder}" />
          <button type="button" class="remove-row-btn" data-remove="${containerId}:${i}">✕</button>
        </div>
      `).join('');
    return `<div id="${containerId}">${rows}</div><button type="button" class="add-row-btn" data-add="${containerId}:${kind}">+ Add ${kind === 'social' ? 'social profile' : kind}</button>`;
  }

  function startEdit(c) {
    isEditing = true;
    detailView.hidden = true;
    editForm.hidden = false;

    editForm.innerHTML = `
      <div class="detail-top-bar">
        <button type="button" class="back-btn" id="cancelBtnTop">Cancel</button>
      </div>
      <div class="form-row">
        <h2>${c.id ? 'Edit contact' : 'New contact'}</h2>
        <div class="form-actions">
          <button type="button" class="pill-btn" id="cancelBtn">Cancel</button>
          <button type="submit" class="pill-btn primary">Save</button>
        </div>
      </div>

      <div class="field-group">
        <input type="hidden" id="f_photo" value="${escapeHtml(c.photo || '')}" />
        <input type="file" id="photoInput" accept="image/*" hidden />
        <div class="photo-picker" id="photoPicker"></div>
      </div>

      <div class="field-group">
        <div class="name-row">
          <div>
            <label class="form-label">First name</label>
            <input type="text" id="f_firstName" value="${escapeHtml(c.firstName || '')}" />
          </div>
          <div>
            <label class="form-label">Last name</label>
            <input type="text" id="f_lastName" value="${escapeHtml(c.lastName || '')}" />
          </div>
        </div>
        <label class="form-label">Company</label>
        <input type="text" id="f_company" value="${escapeHtml(c.company || '')}" />
      </div>

      <div class="field-group">
        <div class="name-row">
          <div>
            <label class="form-label">Relationship</label>
            <input type="text" id="f_relationship" placeholder="e.g. Sister, Friend, Boss" value="${escapeHtml(c.relationship || '')}" />
          </div>
          <div>
            <label class="form-label">Birthday</label>
            <input type="date" id="f_birthday" value="${escapeHtml(c.birthday || '')}" />
          </div>
        </div>
      </div>

      <div class="field-group">
        <label class="form-label">Phone</label>
        ${repeatField('phoneRows', c.phones || [], 'phone')}
      </div>

      <div class="field-group">
        <label class="form-label">Email</label>
        ${repeatField('emailRows', c.emails || [], 'email')}
      </div>

      <div class="field-group">
        <label class="form-label">Social profiles</label>
        ${repeatField('socialRows', c.socialProfiles || [], 'social')}
      </div>

      <div class="field-group">
        <label class="form-label">Address</label>
        <textarea id="f_address" rows="2">${escapeHtml(c.address || '')}</textarea>
        <label class="form-label">Notes</label>
        <textarea id="f_notes" rows="3">${escapeHtml(c.notes || '')}</textarea>
        <div class="favorite-row">
          <input type="checkbox" id="f_favorite" ${c.favorite ? 'checked' : ''} />
          <label for="f_favorite">Favorite</label>
        </div>
      </div>
    `;

    editForm.dataset.id = c.id || '';

    setupPhotoPicker(c);
    editForm.addEventListener('click', formClickHandler);
    document.getElementById('cancelBtn').addEventListener('click', () => cancelEdit(c));
    document.getElementById('cancelBtnTop').addEventListener('click', () => cancelEdit(c));
  }

  function setupPhotoPicker(c) {
    const photoPicker = document.getElementById('photoPicker');
    const photoInput = document.getElementById('photoInput');
    const photoHidden = document.getElementById('f_photo');

    function renderPhotoPicker() {
      const photoValue = photoHidden.value;
      const previewProxy = { photo: photoValue, firstName: c.firstName, lastName: c.lastName };
      photoPicker.innerHTML = `
        <button type="button" class="avatar photo-preview" id="photoPreviewBtn"></button>
        <div class="photo-actions">
          <button type="button" class="add-row-btn" id="choosePhotoBtn">${photoValue ? 'Change photo' : '+ Add photo'}</button>
          ${photoValue ? '<button type="button" class="remove-photo-btn" id="removePhotoBtn">Remove photo</button>' : ''}
        </div>
      `;
      applyAvatarVisual(document.getElementById('photoPreviewBtn'), previewProxy);
      document.getElementById('photoPreviewBtn').addEventListener('click', () => photoInput.click());
      document.getElementById('choosePhotoBtn').addEventListener('click', () => photoInput.click());
      const removeBtn = document.getElementById('removePhotoBtn');
      if (removeBtn) removeBtn.addEventListener('click', () => {
        photoHidden.value = '';
        renderPhotoPicker();
      });
    }

    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photoHidden.value = await resizeImageFile(file);
        renderPhotoPicker();
      } catch (err) {
        showToast('Could not load that image');
      }
      photoInput.value = '';
    });

    renderPhotoPicker();
  }

  function formClickHandler(e) {
    const addKey = e.target.dataset.add;
    const removeKey = e.target.dataset.remove;
    if (addKey) {
      const [containerId, kind] = addKey.split(':');
      const cfg = FIELD_KIND_CONFIG[kind];
      const container = document.getElementById(containerId);
      const idx = container.children.length;
      const row = document.createElement('div');
      row.className = 'repeat-row';
      row.dataset.idx = idx;
      row.innerHTML = `
        <select class="row-label">
          ${cfg.labels.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <input type="${cfg.inputType}" class="row-value" placeholder="${cfg.placeholder}" />
        <button type="button" class="remove-row-btn" data-remove="${containerId}:${idx}">✕</button>
      `;
      container.appendChild(row);
    }
    if (removeKey) {
      const [containerId] = removeKey.split(':');
      const container = document.getElementById(containerId);
      const row = e.target.closest('.repeat-row');
      if (row && container.children.length > 1) row.remove();
      else if (row) { row.querySelector('.row-value').value = ''; }
    }
  }

  function collectRepeatField(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('.repeat-row')).map(row => ({
      label: row.querySelector('.row-label').value,
      value: row.querySelector('.row-value').value.trim()
    })).filter(item => item.value);
  }

  function cancelEdit(c) {
    editForm.removeEventListener('click', formClickHandler);
    isEditing = false;
    if (c.id) {
      renderDetail();
    } else {
      closeDetail();
    }
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editForm.dataset.id;
    const payload = {
      firstName: document.getElementById('f_firstName').value.trim(),
      lastName: document.getElementById('f_lastName').value.trim(),
      company: document.getElementById('f_company').value.trim(),
      relationship: document.getElementById('f_relationship').value.trim(),
      birthday: document.getElementById('f_birthday').value,
      photo: document.getElementById('f_photo').value,
      phones: collectRepeatField('phoneRows'),
      emails: collectRepeatField('emailRows'),
      socialProfiles: collectRepeatField('socialRows'),
      address: document.getElementById('f_address').value.trim(),
      notes: document.getElementById('f_notes').value.trim(),
      favorite: document.getElementById('f_favorite').checked
    };

    editForm.removeEventListener('click', formClickHandler);

    let saved;
    if (id) {
      saved = await api(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      const idx = contacts.findIndex(x => x.id === id);
      contacts[idx] = saved;
    } else {
      saved = await api('/api/contacts', { method: 'POST', body: JSON.stringify(payload) });
      contacts.push(saved);
    }
    activeId = saved.id;
    isEditing = false;
    renderList();
    renderDetail();
    detailPane.classList.add('show');
    showToast('Saved');
  });

  // ---------- New contact ----------

  addBtn.addEventListener('click', () => {
    activeId = null;
    detailPane.classList.add('show');
    startEdit({});
  });

  // ---------- Search ----------

  searchInput.addEventListener('input', renderList);

  // ---------- Menu: export / import ----------

  function positionMenuPopover() {
    const rect = menuBtn.getBoundingClientRect();
    const width = menuPopover.offsetWidth || 190;
    let left = rect.right - width;
    if (left < 8) left = 8;
    const maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = maxLeft;
    menuPopover.style.left = `${left}px`;
    menuPopover.style.top = `${rect.bottom + 8}px`;
  }

  menuBtn.addEventListener('click', () => {
    const opening = menuPopover.hidden;
    if (opening) positionMenuPopover();
    menuPopover.hidden = !menuPopover.hidden;
  });
  window.addEventListener('resize', () => {
    if (!menuPopover.hidden) positionMenuPopover();
  });
  document.addEventListener('click', (e) => {
    if (!menuPopover.hidden && !menuPopover.contains(e.target) && e.target !== menuBtn) {
      menuPopover.hidden = true;
    }
  });
  menuPopover.querySelector('[data-action="export"]').addEventListener('click', () => {
    window.location.href = '/api/export';
    menuPopover.hidden = true;
  });
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = await api('/api/import', { method: 'POST', body: JSON.stringify(parsed) });
      await loadContacts();
      showToast(`Imported ${result.added} contact(s)`);
    } catch (err) {
      showToast('Import failed: invalid file');
    }
    menuPopover.hidden = true;
    importFile.value = '';
  });

  // ---------- Theme ----------

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    const stored = document.documentElement.getAttribute('data-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function updateThemeIcon() {
    themeBtn.textContent = currentTheme() === 'dark' ? '☀' : '☾';
  }

  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('contacts-theme', next); } catch (e) {}
    updateThemeIcon();
  });

  updateThemeIcon();

  // ---------- Init ----------

  loadContacts().catch(() => showToast('Could not load contacts'));
})();
