// Storage keys
const STORAGE_KEY = 'tabatool_collections';

// State
let collections = [];
let draggedElement = null;
let draggedTab = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadCollections();
    renderCollections();
    setupEventListeners();
    loadOpenTabs();
});

// Load collections from storage
async function loadCollections() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            collections = result[STORAGE_KEY] || [];
            resolve();
        });
    });
}

// Save collections to storage
async function saveCollections() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: collections }, () => {
            resolve();
        });
    });
}

// Render collections
function renderCollections() {
    const container = document.getElementById('collectionsContainer');
    
    if (collections.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <h2>Henüz koleksiyon yok</h2>
                <p>➕ Yeni Koleksiyon butonuna tıklayarak başlayın</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = collections.map((collection, index) => `
        <div class="collection" data-index="${index}">
            <div class="collection-header">
                <h3 class="collection-title">${escapeHtml(collection.name)}</h3>
                <div class="collection-actions">
                    <button class="collection-btn" onclick="editCollection(${index})" title="Düzenle">✏️</button>
                    <button class="collection-btn" onclick="deleteCollection(${index})" title="Sil">🗑️</button>
                </div>
            </div>
            <div class="collection-sites">
                ${collection.sites.map((site, siteIndex) => `
                    <a href="${escapeHtml(site.url)}" class="site-item" draggable="true" data-collection="${index}" data-site="${siteIndex}">
                        <img class="site-favicon" src="${getFaviconUrl(site.url)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>🌐</text></svg>'">
                        <span class="site-name">${escapeHtml(site.name)}</span>
                    </a>
                `).join('')}
            </div>
            <div class="collection-footer">
                <button class="open-all-btn" onclick="openAllSites(${index})">
                    🚀 Tümünü Aç (${collection.sites.length})
                </button>
            </div>
        </div>
    `).join('');
    
    setupDragAndDrop();
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
    });
    
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
    });
    
    // Add collection button
    document.getElementById('addCollection').addEventListener('click', () => {
        openCollectionModal();
    });
    
    // Collection modal
    document.getElementById('closeModal').addEventListener('click', closeCollectionModal);
    document.getElementById('cancelModal').addEventListener('click', closeCollectionModal);
    document.getElementById('saveCollection').addEventListener('click', saveCollectionFromModal);
    
    // Add site button in modal
    document.getElementById('addSite').addEventListener('click', () => {
        addSiteInput();
    });
    
    // Import bookmarks
    document.getElementById('importBookmarks').addEventListener('click', () => {
        openBookmarkModal();
    });
    
    document.getElementById('closeBookmarkModal').addEventListener('click', closeBookmarkModal);
    document.getElementById('cancelBookmarkModal').addEventListener('click', closeBookmarkModal);
    document.getElementById('importSelectedBookmarks').addEventListener('click', importSelectedBookmarks);
    
    // Close modals on outside click
    document.getElementById('collectionModal').addEventListener('click', (e) => {
        if (e.target.id === 'collectionModal') closeCollectionModal();
    });
    
    document.getElementById('bookmarkModal').addEventListener('click', (e) => {
        if (e.target.id === 'bookmarkModal') closeBookmarkModal();
    });
}

// Open collection modal
function openCollectionModal(collectionIndex = null) {
    const modal = document.getElementById('collectionModal');
    const title = document.getElementById('modalTitle');
    const nameInput = document.getElementById('collectionName');
    const idInput = document.getElementById('collectionId');
    const sitesList = document.getElementById('sitesList');
    
    if (collectionIndex !== null) {
        title.textContent = 'Koleksiyonu Düzenle';
        const collection = collections[collectionIndex];
        nameInput.value = collection.name;
        idInput.value = collectionIndex;
        sitesList.innerHTML = collection.sites.map((site, index) => `
            <div class="site-input-group">
                <input type="text" placeholder="Site adı" value="${escapeHtml(site.name)}" data-field="name">
                <input type="url" placeholder="https://example.com" value="${escapeHtml(site.url)}" data-field="url">
                <button class="btn btn-danger btn-sm" onclick="removeSiteInput(this)">✕</button>
            </div>
        `).join('');
    } else {
        title.textContent = 'Yeni Koleksiyon';
        nameInput.value = '';
        idInput.value = '';
        sitesList.innerHTML = '';
        addSiteInput();
    }
    
    modal.classList.add('active');
    nameInput.focus();
}

// Close collection modal
function closeCollectionModal() {
    document.getElementById('collectionModal').classList.remove('active');
}

// Add site input
function addSiteInput(name = '', url = '') {
    const sitesList = document.getElementById('sitesList');
    const div = document.createElement('div');
    div.className = 'site-input-group';
    div.innerHTML = `
        <input type="text" placeholder="Site adı" value="${escapeHtml(name)}" data-field="name">
        <input type="url" placeholder="https://example.com" value="${escapeHtml(url)}" data-field="url">
        <button class="btn btn-danger btn-sm" onclick="removeSiteInput(this)">✕</button>
    `;
    sitesList.appendChild(div);
}

// Remove site input
function removeSiteInput(button) {
    button.parentElement.remove();
}

// Save collection from modal
async function saveCollectionFromModal() {
    const nameInput = document.getElementById('collectionName');
    const idInput = document.getElementById('collectionId');
    const sitesList = document.getElementById('sitesList');
    
    const name = nameInput.value.trim();
    if (!name) {
        alert('Lütfen koleksiyon adı girin');
        return;
    }
    
    const siteInputs = sitesList.querySelectorAll('.site-input-group');
    const sites = [];
    
    siteInputs.forEach(group => {
        const nameInput = group.querySelector('[data-field="name"]');
        const urlInput = group.querySelector('[data-field="url"]');
        const siteName = nameInput.value.trim();
        const siteUrl = urlInput.value.trim();
        
        if (siteName && siteUrl) {
            sites.push({ name: siteName, url: siteUrl });
        }
    });
    
    const collectionIndex = idInput.value;
    if (collectionIndex !== '') {
        collections[collectionIndex] = { name, sites };
    } else {
        collections.push({ name, sites });
    }
    
    await saveCollections();
    renderCollections();
    closeCollectionModal();
}

// Edit collection
function editCollection(index) {
    openCollectionModal(index);
}

// Delete collection
async function deleteCollection(index) {
    if (confirm('Bu koleksiyonu silmek istediğinizden emin misiniz?')) {
        collections.splice(index, 1);
        await saveCollections();
        renderCollections();
    }
}

// Open all sites in collection
function openAllSites(index) {
    const collection = collections[index];
    chrome.windows.create({}, (window) => {
        collection.sites.forEach((site, i) => {
            chrome.tabs.create({
                windowId: window.id,
                url: site.url,
                active: i === 0
            });
        });
        // Close the default new tab
        chrome.tabs.query({ windowId: window.id }, (tabs) => {
            const firstTab = tabs[0];
            if (firstTab.url === 'chrome://newtab/') {
                chrome.tabs.remove(firstTab.id);
            }
        });
    });
}

// Setup drag and drop
function setupDragAndDrop() {
    // Make sites draggable
    const siteItems = document.querySelectorAll('.site-item');
    siteItems.forEach(item => {
        item.addEventListener('dragstart', handleSiteDragStart);
        item.addEventListener('dragend', handleSiteDragEnd);
    });
    
    // Make collections droppable
    const collectionElements = document.querySelectorAll('.collection');
    collectionElements.forEach(element => {
        element.addEventListener('dragover', handleCollectionDragOver);
        element.addEventListener('dragleave', handleCollectionDragLeave);
        element.addEventListener('drop', handleCollectionDrop);
    });
}

function handleSiteDragStart(e) {
    draggedElement = e.currentTarget;
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleSiteDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    draggedElement = null;
}

function handleCollectionDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
    return false;
}

function handleCollectionDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function handleCollectionDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();
    
    e.currentTarget.classList.remove('drag-over');
    
    const targetCollectionIndex = parseInt(e.currentTarget.dataset.index);
    
    // Handle tab drop
    if (draggedTab) {
        const site = {
            name: draggedTab.title,
            url: draggedTab.url
        };
        collections[targetCollectionIndex].sites.push(site);
        await saveCollections();
        renderCollections();
        draggedTab = null;
        return false;
    }
    
    // Handle site reorganization
    if (draggedElement) {
        const sourceCollectionIndex = parseInt(draggedElement.dataset.collection);
        const sourceSiteIndex = parseInt(draggedElement.dataset.site);
        
        if (sourceCollectionIndex !== targetCollectionIndex) {
            const site = collections[sourceCollectionIndex].sites[sourceSiteIndex];
            collections[sourceCollectionIndex].sites.splice(sourceSiteIndex, 1);
            collections[targetCollectionIndex].sites.push(site);
            await saveCollections();
            renderCollections();
        }
    }
    
    return false;
}

// Load open tabs
async function loadOpenTabs() {
    chrome.tabs.query({}, (tabs) => {
        const tabsList = document.getElementById('tabsList');
        const currentWindowTabs = tabs.filter(tab => !tab.url.startsWith('chrome://'));
        
        if (currentWindowTabs.length === 0) {
            tabsList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">Açık sekme bulunamadı</p>';
            return;
        }
        
        tabsList.innerHTML = currentWindowTabs.map(tab => `
            <div class="tab-item" draggable="true" data-tab-id="${tab.id}" data-tab-title="${escapeHtml(tab.title)}" data-tab-url="${escapeHtml(tab.url)}">
                <img class="tab-icon" src="${tab.favIconUrl || getFaviconUrl(tab.url)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>🌐</text></svg>'">
                <span class="tab-title">${escapeHtml(tab.title)}</span>
            </div>
        `).join('');
        
        setupTabDragAndDrop();
    });
}

// Setup tab drag and drop
function setupTabDragAndDrop() {
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedTab = {
                id: item.dataset.tabId,
                title: item.dataset.tabTitle,
                url: item.dataset.tabUrl
            };
            item.classList.add('dragging');
        });
        
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });
    });
}

// Open bookmark modal
function openBookmarkModal() {
    const modal = document.getElementById('bookmarkModal');
    const tree = document.getElementById('bookmarkTree');
    
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        tree.innerHTML = renderBookmarkTree(bookmarkTreeNodes[0].children);
    });
    
    modal.classList.add('active');
}

// Close bookmark modal
function closeBookmarkModal() {
    document.getElementById('bookmarkModal').classList.remove('active');
}

// Render bookmark tree
function renderBookmarkTree(nodes) {
    return nodes.map(node => {
        if (!node.children) return '';
        
        const count = countBookmarks(node);
        if (count === 0) return '';
        
        return `
            <div class="bookmark-folder">
                <div class="bookmark-folder-header">
                    <input type="checkbox" id="bookmark-${node.id}" data-node-id="${node.id}">
                    <label for="bookmark-${node.id}" class="bookmark-folder-name">📁 ${escapeHtml(node.title || 'Yer İşaretleri')}</label>
                    <span class="bookmark-folder-count">(${count} öğe)</span>
                </div>
            </div>
        `;
    }).join('');
}

// Count bookmarks in a node
function countBookmarks(node) {
    if (!node.children) return 0;
    
    let count = 0;
    node.children.forEach(child => {
        if (child.url) {
            count++;
        } else if (child.children) {
            count += countBookmarks(child);
        }
    });
    return count;
}

// Import selected bookmarks
async function importSelectedBookmarks() {
    const checkedBoxes = document.querySelectorAll('#bookmarkTree input[type="checkbox"]:checked');
    
    if (checkedBoxes.length === 0) {
        alert('Lütfen en az bir klasör seçin');
        return;
    }
    
    for (const checkbox of checkedBoxes) {
        const nodeId = checkbox.dataset.nodeId;
        const nodes = await new Promise(resolve => {
            chrome.bookmarks.getSubTree(nodeId, resolve);
        });
        
        if (nodes && nodes[0]) {
            await importBookmarkNode(nodes[0]);
        }
    }
    
    await saveCollections();
    renderCollections();
    closeBookmarkModal();
}

// Import bookmark node
async function importBookmarkNode(node) {
    if (!node.children || node.children.length === 0) return;
    
    const sites = [];
    node.children.forEach(child => {
        if (child.url) {
            sites.push({
                name: child.title || child.url,
                url: child.url
            });
        }
    });
    
    if (sites.length > 0) {
        collections.push({
            name: node.title || 'İçe Aktarılan Yer İşaretleri',
            sites: sites
        });
    }
    
    // Recursively import subfolders
    for (const child of node.children) {
        if (child.children) {
            await importBookmarkNode(child);
        }
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">🌐</text></svg>';
    }
}

// Make functions global for inline event handlers
window.editCollection = editCollection;
window.deleteCollection = deleteCollection;
window.openAllSites = openAllSites;
window.removeSiteInput = removeSiteInput;
