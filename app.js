// ===== CONSTANTS AND CONFIGURATION =====

const DB_NAME = 'TransientNotesDB';
const DB_VERSION = 1;
const STORES = {
  NOTES: 'notes',
  FOLDERS: 'folders',
  SETTINGS: 'settings'
};

const PARA_CATEGORIES = ['projects', 'areas', 'resources', 'archives'];

const PARA_ICONS = {
  projects: '🎯',
  areas: '🏠',
  resources: '📚',
  archives: '🗄️'
};

// ===== UTILITY FUNCTIONS (PURE) =====

const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);

const curry = fn => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatDate = timestamp => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const extractTextFromHTML = html => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const truncateText = (text, maxLength) =>
  text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

const createPreview = html => pipe(
  extractTextFromHTML,
  text => truncateText(text, 100)
)(html);

// ===== SELECTION API UTILITIES (PURE FUNCTIONS) =====

const getSelectionAndRange = () => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  return { selection, range: selection.getRangeAt(0) };
};

const isRangeEmpty = range => range.collapsed;

const isBlockElement = element => {
  const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'];
  return element && blockTags.includes(element.tagName);
};

const findParentBlock = node => {
  let current = node;

  // Si c'est un text node, prendre le parent
  while (current && current.nodeType !== Node.ELEMENT_NODE) {
    current = current.parentNode;
  }

  // Chercher le bloc parent éditable
  const editorBody = document.getElementById('noteBody');
  while (current && current !== editorBody && !isBlockElement(current)) {
    current = current.parentNode;
  }

  return current === editorBody ? null : current;
};

const hasParentWithTag = (node, tagName) => {
  let current = node;
  const editorBody = document.getElementById('noteBody');

  while (current && current !== editorBody) {
    if (current.nodeType === Node.ELEMENT_NODE && current.tagName === tagName.toUpperCase()) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
};

const unwrapElement = element => {
  const parent = element.parentNode;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
};

// ===== INLINE STYLE FORMATTING =====

const applyInlineStyle = tagName => {
  const sel = getSelectionAndRange();
  if (!sel || isRangeEmpty(sel.range)) return;

  const { selection, range } = sel;
  const existingStyle = hasParentWithTag(range.commonAncestorContainer, tagName);

  if (existingStyle && range.toString() === existingStyle.textContent) {
    // Retirer le style si toute la sélection est dans le tag
    const parent = existingStyle.parentNode;
    const textContent = existingStyle.textContent;
    unwrapElement(existingStyle);

    // Restaurer la sélection sur le texte déballé
    const newRange = document.createRange();
    // Trouver le nœud texte qui contient notre contenu
    for (let i = 0; i < parent.childNodes.length; i++) {
      const node = parent.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.textContent === textContent) {
        newRange.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(newRange);
        break;
      }
    }
  } else {
    // Appliquer le style
    let wrapper;
    try {
      wrapper = document.createElement(tagName);
      range.surroundContents(wrapper);
    } catch (e) {
      // Fallback pour sélections complexes
      const fragment = range.extractContents();
      wrapper = document.createElement(tagName);
      wrapper.appendChild(fragment);
      range.insertNode(wrapper);
    }

    // Restaurer la sélection sur l'élément formaté uniquement
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};

// ===== BLOCK FORMATTING =====

const applyBlockFormat = tagName => {
  const sel = getSelectionAndRange();
  if (!sel) return;

  const block = findParentBlock(sel.range.commonAncestorContainer);
  if (!block) {
    // Pas de bloc trouvé, créer un nouveau bloc
    const newBlock = document.createElement(tagName);
    newBlock.innerHTML = sel.range.toString() || '<br>';
    sel.range.deleteContents();
    sel.range.insertNode(newBlock);

    // Placer le curseur
    const newRange = document.createRange();
    newRange.selectNodeContents(newBlock);
    newRange.collapse(false);
    sel.selection.removeAllRanges();
    sel.selection.addRange(newRange);
    return;
  }

  // Si c'est déjà le bon type, convertir en <p>
  const newTagName = block.tagName === tagName.toUpperCase() ? 'p' : tagName;
  const newBlock = document.createElement(newTagName);
  newBlock.innerHTML = block.innerHTML;
  block.replaceWith(newBlock);

  // Restaurer la sélection
  const newRange = document.createRange();
  newRange.selectNodeContents(newBlock);
  newRange.collapse(false);
  sel.selection.removeAllRanges();
  sel.selection.addRange(newRange);
};

// ===== LIST FORMATTING =====

const toggleList = listType => {
  const sel = getSelectionAndRange();
  if (!sel) return;

  const { selection, range } = sel;
  let block = findParentBlock(range.commonAncestorContainer);

  // Vérifier si on est déjà dans une liste
  const existingList = hasParentWithTag(range.commonAncestorContainer, 'UL') ||
                       hasParentWithTag(range.commonAncestorContainer, 'OL');

  if (existingList) {
    // Retirer de la liste
    const li = hasParentWithTag(range.commonAncestorContainer, 'LI');
    if (li) {
      const p = document.createElement('p');
      p.innerHTML = li.innerHTML;

      if (existingList.children.length === 1) {
        // Dernière ligne, supprimer toute la liste
        existingList.replaceWith(p);
      } else {
        // Convertir seulement ce li en p
        li.replaceWith(p);
      }

      // Placer le curseur
      const newRange = document.createRange();
      newRange.selectNodeContents(p);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } else {
    // Créer une liste
    const list = document.createElement(listType);
    const li = document.createElement('li');

    if (block && isBlockElement(block)) {
      li.innerHTML = block.innerHTML;
      list.appendChild(li);
      block.replaceWith(list);
    } else {
      li.innerHTML = range.toString() || '<br>';
      list.appendChild(li);
      range.deleteContents();
      range.insertNode(list);
    }

    // Placer le curseur dans le li
    const newRange = document.createRange();
    newRange.selectNodeContents(li);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};

// ===== FORMAT ACTION MAPPINGS =====

const formatActions = {
  bold: () => applyInlineStyle('strong'),
  italic: () => applyInlineStyle('em'),
  underline: () => applyInlineStyle('u'),
  strikethrough: () => applyInlineStyle('s'),
  h1: () => applyBlockFormat('h1'),
  h2: () => applyBlockFormat('h2'),
  h3: () => applyBlockFormat('h3'),
  blockquote: () => applyBlockFormat('blockquote'),
  ul: () => toggleList('ul'),
  ol: () => toggleList('ol')
};

// ===== DATABASE OPERATIONS =====

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);

  request.onupgradeneeded = event => {
    const db = event.target.result;

    // Create notes store
    if (!db.objectStoreNames.contains(STORES.NOTES)) {
      const notesStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
      notesStore.createIndex('folderId', 'folderId', { unique: false });
      notesStore.createIndex('created', 'created', { unique: false });
      notesStore.createIndex('modified', 'modified', { unique: false });
      notesStore.createIndex('title', 'title', { unique: false });
    }

    // Create folders store
    if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
      const foldersStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
      foldersStore.createIndex('category', 'category', { unique: false });
      foldersStore.createIndex('name', 'name', { unique: false });
    }

    // Create settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    }
  };
});

const performTransaction = curry((storeName, mode, operation) =>
  openDatabase().then(db => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
  })
);

const getAll = storeName =>
  performTransaction(storeName, 'readonly', store => store.getAll());

const getById = curry((storeName, id) =>
  performTransaction(storeName, 'readonly', store => store.get(id))
);

const add = curry((storeName, item) =>
  performTransaction(storeName, 'readwrite', store => store.add(item))
);

const update = curry((storeName, item) =>
  performTransaction(storeName, 'readwrite', store => store.put(item))
);

const remove = curry((storeName, id) =>
  performTransaction(storeName, 'readwrite', store => store.delete(id))
);

const getByIndex = curry((storeName, indexName, value) =>
  performTransaction(storeName, 'readonly', store => {
    const index = store.index(indexName);
    return index.getAll(value);
  })
);

// ===== DOMAIN FUNCTIONS (PURE) =====

const createNote = (title = 'Sans titre', content = '', folderId = null) => ({
  id: generateId(),
  title: title || 'Sans titre',
  content,
  folderId,
  created: Date.now(),
  modified: Date.now()
});

const createFolder = (name, category) => ({
  id: generateId(),
  name,
  category,
  created: Date.now()
});

const updateNoteContent = curry((note, updates) => ({
  ...note,
  ...updates,
  modified: Date.now()
}));

const sortNotesByModified = notes =>
  [...notes].sort((a, b) => b.modified - a.modified);

const sortNotesByCreated = notes =>
  [...notes].sort((a, b) => b.created - a.created);

const sortNotesByTitle = notes =>
  [...notes].sort((a, b) => a.title.localeCompare(b.title));

const filterNotesByFolder = curry((folderId, notes) =>
  folderId ? notes.filter(note => note.folderId === folderId) : notes
);

const searchNotes = curry((query, notes) => {
  const lowerQuery = query.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lowerQuery) ||
    extractTextFromHTML(note.content).toLowerCase().includes(lowerQuery)
  );
});

const exportNoteToTxt = note => {
  const content = extractTextFromHTML(note.content);
  const separator = '='.repeat(50);
  return `${note.title}\n${separator}\n\n${content}`;
};

const exportAllNotesToTxt = notes => {
  const noteSeparator = '\n\n' + '='.repeat(80) + '\n\n';
  const header = `TRANSIENT NOTES - Export complet\nDate: ${new Date().toLocaleString('fr-FR')}\nNombre de notes: ${notes.length}\n${'='.repeat(80)}\n\n`;

  const notesContent = notes
    .map(note => exportNoteToTxt(note))
    .join(noteSeparator);

  return header + notesContent;
};

// ===== STATE MANAGEMENT =====

let appState = {
  currentNote: null,
  currentFolder: null,
  notes: [],
  folders: [],
  searchQuery: '',
  sortBy: 'modified'
};

const setState = updates => {
  appState = { ...appState, ...updates };
  return appState;
};

const getState = () => ({ ...appState });

// ===== UI RENDERING FUNCTIONS =====

const renderNoteItem = note => {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.dataset.noteId = note.id;
  if (appState.currentNote?.id === note.id) {
    div.classList.add('note-item--active');
  }

  div.innerHTML = `
    <div class="note-item__title">${note.title}</div>
    <div class="note-item__preview">${createPreview(note.content)}</div>
    <div class="note-item__meta">${formatDate(note.modified)}</div>
  `;

  div.addEventListener('click', () => handleNoteSelect(note.id));
  return div;
};

const renderNotesList = notes => {
  const container = document.getElementById('notesListItems');
  const emptyState = document.getElementById('emptyState');

  container.innerHTML = '';

  if (notes.length === 0) {
    emptyState.classList.remove('hidden');
    container.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    notes.forEach(note => container.appendChild(renderNoteItem(note)));
  }
};

const renderFolderItem = folder => {
  const div = document.createElement('div');
  div.className = 'tree-nav__item';
  div.dataset.folderId = folder.id;
  if (appState.currentFolder?.id === folder.id) {
    div.classList.add('tree-nav__item--active');
  }

  const icon = PARA_ICONS[folder.category] || '📁';
  div.innerHTML = `
    <span class="tree-nav__icon">${icon}</span>
    <span>${folder.name}</span>
  `;

  div.addEventListener('click', () => handleFolderSelect(folder.id));
  return div;
};

const renderFolders = folders => {
  PARA_CATEGORIES.forEach(category => {
    const container = document.getElementById(`${category}Tree`);
    container.innerHTML = '';

    const categoryFolders = folders.filter(f => f.category === category);
    categoryFolders.forEach(folder => {
      container.appendChild(renderFolderItem(folder));
    });
  });
};

const updateEditor = note => {
  const titleInput = document.getElementById('noteTitle');
  const bodyInput = document.getElementById('noteBody');
  const emptyState = document.getElementById('editorEmptyState');

  if (note) {
    titleInput.value = note.title;
    bodyInput.innerHTML = note.content;
    emptyState.classList.add('hidden');
    titleInput.disabled = false;
    bodyInput.contentEditable = true;
  } else {
    titleInput.value = '';
    bodyInput.innerHTML = '';
    emptyState.classList.remove('hidden');
    titleInput.disabled = true;
    bodyInput.contentEditable = false;
  }
};

const updateCurrentFolderTitle = () => {
  const titleElement = document.getElementById('currentFolderTitle');
  if (appState.currentFolder) {
    titleElement.textContent = appState.currentFolder.name;
  } else {
    titleElement.textContent = 'Toutes les notes';
  }
};

// ===== EVENT HANDLERS =====

const handleNoteSelect = async noteId => {
  const note = await getById(STORES.NOTES, noteId);
  setState({ currentNote: note });
  updateEditor(note);
  renderNotesList(getFilteredAndSortedNotes());
};

const handleFolderSelect = async folderId => {
  const folder = await getById(STORES.FOLDERS, folderId);
  setState({ currentFolder: folder });
  updateCurrentFolderTitle();
  await refreshNotesList();
};

const handleNewNote = async () => {
  const folderId = appState.currentFolder?.id || null;
  const note = createNote('Sans titre', '', folderId);

  await add(STORES.NOTES, note);
  await refreshNotesList();
  await handleNoteSelect(note.id);

  // Focus on title
  document.getElementById('noteTitle').focus();
};

const getOrCreateDefaultFolder = async category => {
  const categoryFolders = appState.folders.filter(f => f.category === category);

  if (categoryFolders.length > 0) {
    return categoryFolders[0];
  }

  // Create default folder for this category
  const folderName = {
    projects: 'Projets généraux',
    areas: 'Domaines généraux',
    resources: 'Ressources générales',
    archives: 'Archives générales'
  }[category];

  const folder = createFolder(folderName, category);
  await add(STORES.FOLDERS, folder);
  await refreshFolders();

  return folder;
};

const handleNewNoteInCategory = async category => {
  const folder = await getOrCreateDefaultFolder(category);
  const note = createNote('Sans titre', '', folder.id);

  await add(STORES.NOTES, note);

  // Select the folder to show the new note
  setState({ currentFolder: folder });
  updateCurrentFolderTitle();

  await refreshNotesList();
  await handleNoteSelect(note.id);

  // Focus on title
  document.getElementById('noteTitle').focus();
};

const handleNoteTitleChange = async event => {
  if (!appState.currentNote) return;

  const updatedNote = updateNoteContent(appState.currentNote, {
    title: event.target.value || 'Sans titre'
  });

  await update(STORES.NOTES, updatedNote);
  setState({ currentNote: updatedNote });
  await refreshNotesList();
};

const handleNoteContentChange = async () => {
  if (!appState.currentNote) return;

  const bodyElement = document.getElementById('noteBody');
  const updatedNote = updateNoteContent(appState.currentNote, {
    content: bodyElement.innerHTML
  });

  await update(STORES.NOTES, updatedNote);
  setState({ currentNote: updatedNote });
  await refreshNotesList();
};

const handleNewFolder = () => {
  const modal = document.getElementById('folderModal');
  const input = document.getElementById('folderNameInput');

  modal.classList.add('modal--open');
  input.value = '';
  input.focus();
};

const handleCreateFolder = async () => {
  const input = document.getElementById('folderNameInput');
  const name = input.value.trim();

  if (!name) return;

  // For now, default to 'projects' category
  // In a full implementation, you'd let the user choose
  const folder = createFolder(name, 'projects');

  await add(STORES.FOLDERS, folder);
  await refreshFolders();

  closeModal();
};

const closeModal = () => {
  const modal = document.getElementById('folderModal');
  modal.classList.remove('modal--open');
};

const handleSearch = event => {
  setState({ searchQuery: event.target.value });
  renderNotesList(getFilteredAndSortedNotes());
};

const handleSortChange = event => {
  setState({ sortBy: event.target.value });
  renderNotesList(getFilteredAndSortedNotes());
};

const handleExport = () => {
  if (!appState.currentNote) return;

  const txtContent = exportNoteToTxt(appState.currentNote);
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${appState.currentNote.title}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const handleExportAll = () => {
  if (appState.notes.length === 0) {
    alert('Aucune note à exporter');
    return;
  }

  const sortedNotes = sortNotesByModified(appState.notes);
  const txtContent = exportAllNotesToTxt(sortedNotes);
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = url;
  link.download = `transient-notes-export-${timestamp}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const handleDelete = async () => {
  if (!appState.currentNote) return;

  const confirmDelete = window.confirm(
    `Voulez-vous vraiment supprimer la note "${appState.currentNote.title}" ?`
  );

  if (!confirmDelete) return;

  await remove(STORES.NOTES, appState.currentNote.id);
  setState({ currentNote: null });
  updateEditor(null);
  await refreshNotesList();
};

// ===== IMAGE HANDLING =====

const handleImageDrop = event => {
  event.preventDefault();
  event.stopPropagation();

  const bodyElement = document.getElementById('noteBody');
  bodyElement.classList.remove('editor__body--drop-active');

  const files = Array.from(event.dataTransfer.files);
  const imageFiles = files.filter(file => file.type.startsWith('image/'));

  imageFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      bodyElement.appendChild(img);
      handleNoteContentChange();
    };
    reader.readAsDataURL(file);
  });
};

const handleImagePaste = event => {
  const items = Array.from(event.clipboardData.items);
  const imageItems = items.filter(item => item.type.startsWith('image/'));

  if (imageItems.length > 0) {
    event.preventDefault();

    imageItems.forEach(item => {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;

        const bodyElement = document.getElementById('noteBody');
        bodyElement.appendChild(img);
        handleNoteContentChange();
      };
      reader.readAsDataURL(file);
    });
  }
};

const handleDragOver = event => {
  event.preventDefault();
  const bodyElement = document.getElementById('noteBody');
  bodyElement.classList.add('editor__body--drop-active');
};

const handleDragLeave = event => {
  event.preventDefault();
  const bodyElement = document.getElementById('noteBody');
  bodyElement.classList.remove('editor__body--drop-active');
};

// ===== TOOLBAR ACTIONS =====

const handleToolbarAction = action => {
  const formatFn = formatActions[action];
  if (formatFn) {
    formatFn();
    handleNoteContentChange();
  }
};

// ===== TREE NAVIGATION TOGGLE =====

const handleTreeToggle = event => {
  const header = event.currentTarget;
  header.classList.toggle('tree-nav__header--collapsed');
};

// ===== HELPER FUNCTIONS =====

const getFilteredAndSortedNotes = () => {
  let notes = [...appState.notes];

  // Filter by folder
  if (appState.currentFolder) {
    notes = filterNotesByFolder(appState.currentFolder.id, notes);
  }

  // Filter by search
  if (appState.searchQuery) {
    notes = searchNotes(appState.searchQuery, notes);
  }

  // Sort
  switch (appState.sortBy) {
    case 'created':
      notes = sortNotesByCreated(notes);
      break;
    case 'title':
      notes = sortNotesByTitle(notes);
      break;
    case 'modified':
    default:
      notes = sortNotesByModified(notes);
  }

  return notes;
};

const refreshNotesList = async () => {
  const allNotes = await getAll(STORES.NOTES);
  setState({ notes: allNotes });
  renderNotesList(getFilteredAndSortedNotes());
};

const refreshFolders = async () => {
  const folders = await getAll(STORES.FOLDERS);
  setState({ folders });
  renderFolders(folders);
};

// ===== KEYBOARD SHORTCUTS =====

const handleKeyboardShortcuts = event => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'n':
        event.preventDefault();
        handleNewNote();
        break;
      case 'f':
        if (!event.target.matches('#searchInput')) {
          event.preventDefault();
          document.getElementById('searchInput').focus();
        }
        break;
      case 'u':
        if (!event.shiftKey) {
          event.preventDefault();
          handleToolbarAction('underline');
        }
        break;
      case 'X':
        if (event.shiftKey) {
          event.preventDefault();
          handleToolbarAction('strikethrough');
        }
        break;
      case '1':
        event.preventDefault();
        handleNewNoteInCategory('projects');
        break;
      case '2':
        event.preventDefault();
        handleNewNoteInCategory('areas');
        break;
      case '3':
        event.preventDefault();
        handleNewNoteInCategory('resources');
        break;
      case '4':
        event.preventDefault();
        handleNewNoteInCategory('archives');
        break;
    }
  }
};

// ===== INITIALIZATION =====

const initializeEventListeners = () => {
  // Header actions
  document.getElementById('newNoteBtn').addEventListener('click', handleNewNote);
  document.getElementById('exportAllBtn').addEventListener('click', handleExportAll);
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  // Sidebar
  document.getElementById('newFolderBtn').addEventListener('click', handleNewFolder);

  // Modal
  document.getElementById('createFolderBtn').addEventListener('click', handleCreateFolder);
  document.getElementById('cancelFolderBtn').addEventListener('click', closeModal);
  document.getElementById('folderModal').addEventListener('click', event => {
    if (event.target.id === 'folderModal') closeModal();
  });

  // Enter key in folder modal
  document.getElementById('folderNameInput').addEventListener('keypress', event => {
    if (event.key === 'Enter') handleCreateFolder();
  });

  // Notes list
  document.getElementById('sortSelect').addEventListener('change', handleSortChange);

  // Editor
  const titleInput = document.getElementById('noteTitle');
  const bodyInput = document.getElementById('noteBody');

  titleInput.addEventListener('input', handleNoteTitleChange);
  bodyInput.addEventListener('input', handleNoteContentChange);
  bodyInput.addEventListener('paste', handleImagePaste);
  bodyInput.addEventListener('drop', handleImageDrop);
  bodyInput.addEventListener('dragover', handleDragOver);
  bodyInput.addEventListener('dragleave', handleDragLeave);

  // Toolbar
  document.getElementById('deleteBtn').addEventListener('click', handleDelete);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.querySelectorAll('.toolbar__button[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      handleToolbarAction(action);
    });
  });

  // Tree navigation toggles
  document.querySelectorAll('.tree-nav__header').forEach(header => {
    header.addEventListener('click', handleTreeToggle);
  });

  // PARA category add buttons
  document.querySelectorAll('.tree-nav__add-btn').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation(); // Prevent header toggle
      const category = button.dataset.category;
      handleNewNoteInCategory(category);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
};

const initializeApp = async () => {
  try {
    // Initialize database
    await openDatabase();

    // Load initial data
    await refreshFolders();
    await refreshNotesList();

    // Set up event listeners
    initializeEventListeners();

    console.log('✅ Transient Notes initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing app:', error);
  }
};

// Start the application
initializeApp();
