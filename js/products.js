const productsGrid = document.getElementById('productsGrid');
const productsStatus = document.getElementById('productsStatus');
const productsCount = document.getElementById('productsCount');
const typeFilterOptions = document.getElementById('typeFilterOptions');
const clearTypeFilter = document.getElementById('clearTypeFilter');
const sortSelect = document.getElementById('sortSelect');
const priceFilter = document.getElementById('priceFilter');
const catalogPagination = document.getElementById('catalogPagination');
const searchInput = document.getElementById('searchInput');
const openQuoteCartButton = document.getElementById('openQuoteCart');
const closeQuoteCartButton = document.getElementById('closeQuoteCart');
const quoteCartPanel = document.getElementById('quoteCartPanel');
const quoteCartItems = document.getElementById('quoteCartItems');
const quoteCartCount = document.getElementById('quoteCartCount');
const quoteCartForm = document.getElementById('quoteCartForm');
const quoteCartStatus = document.getElementById('quoteCartStatus');
const clearQuoteCartButton = document.getElementById('clearQuoteCart');
const quoteCartSummary = document.getElementById('quoteCartSummary');
const catalogSelectorButtons = Array.from(document.querySelectorAll('[data-catalog]'));
const brindesCatalogDownload = document.getElementById('brindesCatalogDownload');

const apiBase = window.SPOT_API_BASE || (window.location.protocol === 'file:' ? 'http://localhost:3001' : window.location.origin);
const spotImageBase = window.SPOT_IMAGE_BASE || '';
const apiCandidates = [apiBase];
let activeApiBase = apiBase;
let apiBaseResolvePromise = null;

let isLoadingProducts = false;
let allProducts = [];
let selectedTypeGroups = new Set();
let sortMode = 'name';
let priceRange = 'all';
let stockByReference = new Map();
let priceByReference = new Map();
let customizationByReference = new Map();
let currentPage = 1;
const itemsPerPage = 10;
let searchTerm = '';
let searchDebounceId = null;
const PRODUCTS_CACHE_KEY = 'spotCatalogProductsCacheV1';
const PRODUCTS_SESSION_CACHE_KEY = 'spotCatalogProductsSessionCacheV1';
const PRODUCTS_CACHE_TTL_MS = 10 * 60 * 1000;
const PRODUCTS_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const PRODUCTS_CACHE_FRESH_MS = 5 * 60 * 1000;
const QUOTE_CART_KEY = 'catalogQuoteCartV1';
const loadedImageUrls = new Set();
let quoteCart = [];
const productSearchTextCache = new Map();
let stocksLoaded = false;
let stocksFailed = false;
let catalogSupplementalLoadingPromise = null;
let activeCatalog = 'kits';
const catalogProductsCache = new Map();

window.catalogMarkImageLoaded = function (src) {
    const value = String(src || '').trim();
    if (value) loadedImageUrls.add(value);
};

function fetchWithTimeout(url, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

function buildApiUrl(path) {
    const cleanPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    return `${activeApiBase}${cleanPath}`;
}

async function resolveApiBaseCandidate() {
    if (apiBaseResolvePromise) {
        return apiBaseResolvePromise;
    }

    apiBaseResolvePromise = (async () => {
        for (const base of apiCandidates) {
            try {
                const response = await fetchWithTimeout(`${base}/api/spot/health`, 2200);
                if (response.ok) {
                    activeApiBase = base;
                    return activeApiBase;
                }
            } catch {
                // try next candidate
            }
        }

        return activeApiBase;
    })();

    return apiBaseResolvePromise;
}

function extractProducts(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];

    const candidates = [
        data.Products,
        data.Products?.Product,
        data.Data,
        data.List,
        data.Items,
        data.products,
        data.data,
        data.items
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
        if (candidate && typeof candidate === 'object' && Array.isArray(candidate.Product)) return candidate.Product;
        if (candidate && typeof candidate === 'object' && Array.isArray(candidate.Items)) return candidate.Items;
    }

    return [];
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getProductCode(product) {
    return product.InternalReference || product.ProdReference || product.ProductCode || product.Code || product.ID || product.id || '---';
}

function getProductReference(product) {
    const raw = product.ProdReference || product.ProductReference || product.Reference || product.InternalReference || product.Code || product.ID || product.id || '';
    const text = String(raw || '').trim();
    if (!text) return '';
    const numeric = (text.match(/\d+/) || [])[0];
    return numeric || text;
}

function normalizeReferenceToken(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const firstChunk = raw.split('-')[0];
    const numeric = (firstChunk.match(/\d+/) || [])[0];
    return numeric || firstChunk;
}

function getProductReferenceCandidates(product) {
    const rawCandidates = [
        product?.ProdReference,
        product?.ProductReference,
        product?.Reference,
        product?.InternalReference,
        product?.ProductCode,
        product?.Code,
        product?.ID,
        product?.id,
        product?.Name,
        product?.Title,
        product?.Description
    ];

    const candidates = [];
    for (const raw of rawCandidates) {
        const normalized = normalizeReferenceToken(raw);
        if (normalized) candidates.push(normalized);
    }

    return [...new Set(candidates)];
}

function collectImageValues(value, values, seen = new Set()) {
    if (typeof value === 'string') {
        const image = value.trim();
        if (image) values.push(image);
        return;
    }

    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
        value.forEach((item) => collectImageValues(item, values, seen));
        return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
        if (/(image|photo|gallery|file|url|path|src)/i.test(key)) {
            collectImageValues(nestedValue, values, seen);
        }
    });
}

function getProductImageValues(product) {
    const values = [];
    const fields = [
        product?.MainImage,
        product?.Image,
        product?.ImageURL,
        product?.Photo,
        product?.Images,
        product?.Gallery,
        product?.Files,
        product?.ImageList,
        product?.GalleryImages,
        product?.OtherImages
    ];

    fields.forEach((fieldValue) => collectImageValues(fieldValue, values));
    return [...new Set(values.map((value) => value.toLowerCase()))]
        .map((value) => values.find((original) => original.toLowerCase() === value));
}

function getSkuReference(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const firstChunk = raw.split('-')[0];
    const numeric = (firstChunk.match(/\d+/) || [])[0];
    return numeric || firstChunk;
}

function getProductName(product) {
    return product.Name || product.Title || product.ProductName || product.Description || 'Produto sem nome';
}

function getProductType(product) {
    return (product.ProductTypeName || product.SubType || product.Type || product.Category || product.ProductType || 'Outros').trim();
}

function normalizeType(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function buildTypeGroup(typeName) {
    const normalized = normalizeType(typeName);
    if (!normalized) return 'Outros';

    const compact = normalized.replace(/\s+/g, '');
    const synonyms = [
        ['Canecas', ['caneca', 'mug']],
        ['Garrafas', ['garrafa', 'squeeze', 'bottle', 'botella']],
        ['Copos', ['copo', 'tumbler', 'termico', 'taca']],
        ['Cadernos e Agendas', ['caderno', 'agenda', 'notebook', 'bloco']],
        ['Escritorio', ['caneta', 'lapis', 'marca texto', 'esferografica', 'office', 'escritorio']],
        ['Tecnologia', ['usb', 'powerbank', 'carregador', 'fone', 'mouse', 'teclado', 'hub', 'speaker']],
        ['Bolsas e Mochilas', ['mochila', 'backpack', 'saco mochila', 'bolsa', 'sacola']],
        ['Chaveiros', ['chaveiro', 'keyring']]
    ];

    for (const [group, keys] of synonyms) {
        if (keys.some((key) => compact.includes(key.replace(/\s+/g, '')))) {
            return group;
        }
    }

    return 'Outros';
}

function getProductDescription(product) {
    return product.ShortDescription || product.Description || '';
}

function getProductSizeCapacity(product) {
    return product.CombinedSizes || product.Sizes || product.Capacitys || '';
}

function getProductColors(product) {
    return product.Colors || '';
}

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(value) {
    if (!Number.isFinite(value)) return 'Preco sob consulta';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getStockLabel(product) {
    const qty = getAvailableStock(product);

    if (Number.isFinite(qty)) {
        return {
            text: `Estoque: ${qty}`,
            cssClass: qty > 0 ? 'is-available' : 'is-unavailable'
        };
    }

    if (stocksFailed) {
        return { text: 'Estoque indisponivel', cssClass: 'is-unavailable' };
    }

    if (stocksLoaded) {
        return { text: 'Estoque indisponivel', cssClass: 'is-unavailable' };
    }

    return { text: 'Estoque: carregando...', cssClass: 'is-neutral' };
}

function getAvailableStockByRef(refValue) {
    const ref = normalizeReferenceToken(refValue);
    if (!ref) return null;
    const qty = stockByReference.get(ref);
    if (!Number.isFinite(qty)) return null;
    return Math.max(0, Math.floor(qty));
}

function getAvailableStock(product) {
    const directStock = parseNumber(product?.Stock ?? product?.stock ?? product?.Quantity ?? product?.estoque);
    if (Number.isFinite(directStock)) return Math.max(0, Math.floor(directStock));

    const candidates = getProductReferenceCandidates(product);
    for (const candidate of candidates) {
        const qty = getAvailableStockByRef(candidate);
        if (Number.isFinite(qty)) return qty;
    }
    return null;
}

function clampQtyToStock(quantity, availableStock) {
    const safeQty = Math.max(1, Number(quantity) || 1);
    if (!Number.isFinite(availableStock)) return safeQty;
    if (availableStock <= 0) return 0;
    return Math.min(safeQty, availableStock);
}

function getPriceLabel(product) {
    const directPrice = parseNumber(product?.Price ?? product?.CatalogPrice ?? product?.preco);
    if (Number.isFinite(directPrice)) {
        return { text: formatCurrency(directPrice), cssClass: 'is-available' };
    }

    let value = null;
    for (const candidate of getProductReferenceCandidates(product)) {
        const found = priceByReference.get(candidate);
        if (Number.isFinite(found)) {
            value = found;
            break;
        }
    }
    if (Number.isFinite(value)) {
        return { text: formatCurrency(value), cssClass: 'is-available' };
    }

    return { text: 'Preco sob consulta', cssClass: 'is-neutral' };
}

function getProductPrice(product) {
    const directPrice = parseNumber(product?.Price ?? product?.CatalogPrice ?? product?.preco);
    if (Number.isFinite(directPrice)) return directPrice;

    for (const candidate of getProductReferenceCandidates(product)) {
        const mappedPrice = priceByReference.get(candidate);
        if (Number.isFinite(mappedPrice)) return mappedPrice;
    }

    return null;
}

function getCustomizationLabel(product) {
    const fallback = product.CustomizationTypes || product.CustomizationDefaultType || '';
    let fromOptionals = '';
    for (const candidate of getProductReferenceCandidates(product)) {
        const found = customizationByReference.get(candidate);
        if (found) {
            fromOptionals = found;
            break;
        }
    }
    const value = String(fromOptionals || fallback || '').trim();
    if (!value) {
        return 'Personalizacao: sob consulta';
    }
    return `Personalizacao: ${value}`;
}

async function fetchApiJson(path, timeoutMs = 20000) {
    let lastError = null;
    const orderedCandidates = [...new Set([activeApiBase, ...apiCandidates])];

    for (const base of orderedCandidates) {
        const url = `${base}${path}`;
        try {
            const response = await fetchWithTimeout(url, timeoutMs);
            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
            const data = await response.json();
            if (data && data.error) {
                throw new Error(data.message || data.error);
            }
            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Sem resposta da API');
}

function readProductsCache() {
    try {
        const readOne = (raw) => {
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.products) || !parsed.savedAt) return null;
            const ageMs = Date.now() - Number(parsed.savedAt);
            if (ageMs > PRODUCTS_CACHE_MAX_STALE_MS) return null;
            return {
                products: parsed.products,
                savedAt: Number(parsed.savedAt),
                isFresh: ageMs <= PRODUCTS_CACHE_TTL_MS
            };
        };

        const sessionCached = readOne(sessionStorage.getItem(PRODUCTS_SESSION_CACHE_KEY));
        if (sessionCached && sessionCached.products?.length) return sessionCached;

        return readOne(localStorage.getItem(PRODUCTS_CACHE_KEY));
    } catch {
        return null;
    }
}

function saveProductsCache(products) {
    const payload = JSON.stringify({
        savedAt: Date.now(),
        products
    });

    try {
        localStorage.setItem(PRODUCTS_CACHE_KEY, payload);
    } catch {
        // ignore storage quota failures
    }

    try {
        sessionStorage.setItem(PRODUCTS_SESSION_CACHE_KEY, payload);
    } catch {
        // ignore storage failures
    }
}

function readQuoteCart() {
    try {
        const raw = localStorage.getItem(QUOTE_CART_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => item && item.id)
            .map((item) => {
                const parsedStock = Number(item.stock);
                const hasConfirmedStock = item.stock !== null && item.stock !== undefined && item.stock !== '';
                const stock = hasConfirmedStock && Number.isFinite(parsedStock)
                    ? Math.max(0, Math.floor(parsedStock))
                    : null;

                let qty = Math.max(1, Number(item.qty) || 1);
                if (Number.isFinite(stock)) {
                    if (stock <= 0) qty = 0;
                    else qty = Math.min(qty, stock);
                }

                return {
                    ...item,
                    qty,
                    stock
                };
            })
            .filter((item) => Number(item.qty) > 0);
    } catch {
        return [];
    }
}

function syncQuoteCartStockLimits() {
    if (!quoteCart.length) return;

    if (!stocksLoaded && !stocksFailed) return;

    quoteCart = quoteCart
        .map((item) => {
            const availableStock = getAvailableStockByRef(item.ref || item.id);
            if (!Number.isFinite(availableStock)) {
                return {
                    ...item,
                    stock: null,
                    qty: Math.max(1, Number(item.qty) || 1)
                };
            }

            if (availableStock <= 0) {
                return null;
            }

            return {
                ...item,
                stock: availableStock,
                qty: Math.min(Math.max(1, Number(item.qty) || 1), availableStock)
            };
        })
        .filter(Boolean);
}

function saveQuoteCart() {
    try {
        localStorage.setItem(QUOTE_CART_KEY, JSON.stringify(quoteCart));
    } catch {
        // ignore storage errors
    }

    window.dispatchEvent(new CustomEvent('quote-cart-changed'));
}

function updateQuoteCartCount() {
    if (!quoteCartCount) return;
    const totalItems = quoteCart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    quoteCartCount.textContent = String(totalItems);
}

function updateQuoteCartSummary() {
    if (!quoteCartSummary) return;
    const totalDistinct = quoteCart.length;
    const totalUnits = quoteCart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    quoteCartSummary.textContent = totalDistinct
        ? `Resumo: ${totalDistinct} item(ns) e ${totalUnits} unidade(s) no orçamento.`
        : 'Resumo: nenhum item no orçamento.';

    if (clearQuoteCartButton) {
        clearQuoteCartButton.disabled = totalDistinct === 0;
    }
}

function applyWhatsappMask(rawValue) {
    const digits = String(rawValue || '').replace(/\D/g, '').slice(-11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function buildProductIdentity(product) {
    return `${String(getProductReference(product) || '')}|${String(getProductCode(product) || '')}`;
}

function rebuildProductSearchCache(products) {
    productSearchTextCache.clear();
    for (const product of products) {
        const identity = buildProductIdentity(product);
        const searchable = [
            getProductName(product),
            getProductCode(product),
            getProductType(product),
            getProductReference(product)
        ].join(' ').toLowerCase();
        productSearchTextCache.set(identity, searchable);
    }
}

function getCartStockValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function renderQuoteCart() {
    if (!quoteCartItems) return;

    if (!quoteCart.length) {
        quoteCartItems.innerHTML = '<p class="quote-cart-empty">Nenhum item adicionado ao orçamento.</p>';
        updateQuoteCartCount();
        updateQuoteCartSummary();
        return;
    }

    quoteCartItems.innerHTML = quoteCart.map((item) => {
        const title = escapeHtml(item.name || 'Produto');
        const code = escapeHtml(item.code || '---');
        const qty = Math.max(50, Number(item.qty) || 50);
        return `
            <article class="quote-cart-item" data-cart-id="${escapeHtml(item.id)}">
                <p class="quote-cart-item-title">${title}</p>
                <p class="quote-cart-item-code">Código: ${code}</p>
                <div class="quote-cart-item-actions">
                    <input type="number" min="50" value="${qty}" data-action="qty">
                    <button type="button" data-action="update">Atualizar</button>
                    <button type="button" data-action="remove">Excluir</button>
                </div>
            </article>
        `;
    }).join('');

    updateQuoteCartCount();
    updateQuoteCartSummary();
}

function upsertCartItem(product, qty) {
    const requestedQty = Math.max(50, Number(qty) || 50);
    const code = String(getProductCode(product));
    const ref = String(getProductReference(product) || code);
    const id = ref;

    const existing = quoteCart.find((item) => item.id === id);
    let addedQty = 0;

    if (existing) {
        existing.qty = Math.max(50, existing.qty + requestedQty);
        existing.stock = null;
        addedQty = requestedQty;
    } else {
        addedQty = requestedQty;
        quoteCart.push({
            id,
            code,
            name: getProductName(product),
            ref,
            image: resolveImageSrc(product),
            stock: null,
            qty: requestedQty
        });
    }

    saveQuoteCart();
    renderQuoteCart();
    return { ok: true, limited: false, addedQty };
}

function openQuoteCart() {
    if (!quoteCartPanel) return;
    quoteCartPanel.classList.add('is-open');
}

function closeQuoteCart() {
    if (!quoteCartPanel) return;
    quoteCartPanel.classList.remove('is-open');
}

async function submitQuoteCartForm(event) {
    event.preventDefault();
    if (!quoteCartForm || !quoteCartStatus) return;

    if (!quoteCart.length) {
        quoteCartStatus.textContent = 'Adicione ao menos um item para enviar orçamento.';
        return;
    }

    const formData = new FormData(quoteCartForm);
    const nome = String(formData.get('nome') || '').trim();
    const documento = String(formData.get('documento') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const whatsapp = String(formData.get('whatsapp') || '').trim();

    if (!nome || !documento || !email || !whatsapp) {
        quoteCartStatus.textContent = 'Preencha nome, documento, e-mail e WhatsApp.';
        return;
    }

    const itemsDescription = quoteCart
        .map((item, index) => `${index + 1}. ${item.name} (Código: ${item.code}) - Quantidade: ${item.qty}`)
        .join('\n');

    const payload = new FormData();
    payload.set('_captcha', 'false');
    payload.set('_subject', 'Solicitação de Orçamento - Catálogo Brucs');
    payload.set('nome', nome);
    payload.set('documento', documento);
    payload.set('email', email);
    payload.set('whatsapp', whatsapp);
    payload.set('origem', 'Carrinho de orçamento do catálogo');
    payload.set('itens', itemsDescription);
    payload.set('resumo', `Itens distintos: ${quoteCart.length} | Unidades: ${quoteCart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)}`);

    quoteCartStatus.textContent = 'Enviando orçamento...';
    try {
        const response = await fetch('https://formsubmit.co/ajax/contato@brucspersonalizados.com.br', {
            method: 'POST',
            body: payload,
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        quoteCartStatus.textContent = 'Orçamento enviado com sucesso. Em breve retornaremos!';
        quoteCart = [];
        saveQuoteCart();
        renderQuoteCart();
        quoteCartForm.reset();
    } catch {
        quoteCartStatus.textContent = 'Falha ao enviar orçamento. Tente novamente em instantes.';
    }
}

function extractPriceFromItem(item) {
    const candidates = [
        item?.Price,
        item?.UnitPrice,
        item?.CatalogPrice,
        item?.Pvp,
        item?.PVP,
        item?.NetPrice,
        item?.Value
    ];

    for (const value of candidates) {
        const parsed = parseNumber(value);
        if (Number.isFinite(parsed)) return parsed;
    }

    return null;
}

async function loadCatalogPrices() {
    const data = await fetchApiJson('/api/spot/catalog-prices', 25000);
    const list = Array.isArray(data?.CatalogPrices) ? data.CatalogPrices : [];
    const map = new Map();

    for (const item of list) {
        const ref = getSkuReference(item?.ProdReference || item?.Sku || item?.WebSku || '');
        if (!ref) continue;
        if (map.has(ref)) continue;

        const price = extractPriceFromItem(item);
        if (Number.isFinite(price)) {
            map.set(ref, price);
        }
    }

    priceByReference = map;
}

async function loadCustomizationOptionsFromPayload(optionalsList, customizationList) {
    const fromOptionals = Array.isArray(optionalsList) ? optionalsList : [];
    const fromCustomizations = Array.isArray(customizationList) ? customizationList : [];
    const map = new Map();

    for (const item of fromOptionals) {
        const ref = getSkuReference(item?.ProdReference || item?.Sku || item?.WebSku || '');
        if (!ref || map.has(ref)) continue;

        const techniques = String(item?.CustomizationTypes || item?.TypeDescription || item?.CustomizationType || '').trim();
        if (techniques) {
            map.set(ref, techniques);
        }
    }

    for (const item of fromCustomizations) {
        const ref = getSkuReference(item?.ProdReference || item?.Sku || item?.WebSku || '');
        if (!ref || map.has(ref)) continue;

        const techniques = String(item?.ServiceDescription || item?.CustomizationType || item?.ServiceCode || '').trim();
        if (techniques) {
            map.set(ref, techniques);
        }
    }

    customizationByReference = map;
}

function extractStockMapFromList(list) {
    const map = new Map();
    for (const item of Array.isArray(list) ? list : []) {
        const ref = getSkuReference(item?.ProdReference || item?.Sku || item?.WebSku || '');
        if (!ref) continue;
        const qty = parseNumber(item?.Quantity);
        if (!Number.isFinite(qty)) continue;
        map.set(ref, (map.get(ref) || 0) + qty);
    }
    return map;
}

function extractPriceMapFromList(list) {
    const map = new Map();
    for (const item of Array.isArray(list) ? list : []) {
        const ref = getSkuReference(item?.ProdReference || item?.Sku || item?.WebSku || '');
        if (!ref || map.has(ref)) continue;
        const price = extractPriceFromItem(item);
        if (Number.isFinite(price)) {
            map.set(ref, price);
        }
    }
    return map;
}

async function loadCatalogSupplementalData() {
    if (catalogSupplementalLoadingPromise) {
        return catalogSupplementalLoadingPromise;
    }

    catalogSupplementalLoadingPromise = (async () => {
        try {
            const payload = await fetchApiJson('/api/spot/catalog-content?lang=PT&includeProducts=false&sections=prices', 15000);
        const catalogPrices = Array.isArray(payload?.CatalogPrices) ? payload.CatalogPrices : null;
        const optionalsComplete = Array.isArray(payload?.OptionalsComplete) ? payload.OptionalsComplete : null;
        const customizationOptions = Array.isArray(payload?.CustomizationOptions) ? payload.CustomizationOptions : null;

        if (catalogPrices) {
            priceByReference = extractPriceMapFromList(catalogPrices);
        }

        if (optionalsComplete || customizationOptions) {
            await loadCustomizationOptionsFromPayload(optionalsComplete || [], customizationOptions || []);
        }

        } catch {
        } finally {
            renderQuoteCart();
            renderProducts(getFilteredProducts());
            catalogSupplementalLoadingPromise = null;
        }
    })();

    return catalogSupplementalLoadingPromise;
}

function resolveImageSrc(product) {
    const raw = getProductImageValues(product)[0] || '';
    if (typeof raw === 'string' && raw.trim()) {
        const clean = raw.trim();
        if (/^https?:\/\//i.test(clean)) {
            return clean;
        }

        if (clean.startsWith('/')) {
            return `${activeApiBase}${clean}`;
        }

        if (spotImageBase) {
            return `${spotImageBase.replace(/\/+$/, '')}/${clean.replace(/^\/+/, '')}`;
        }

        const ref = getProductReference(product);
        const qs = new URLSearchParams();
        if (ref) qs.set('ref', ref);
        const query = qs.toString();
        return `${buildApiUrl(`/api/spot/image/${encodeURIComponent(clean)}`)}${query ? `?${query}` : ''}`;
    }

    const productRef = getProductReference(product);
    if (productRef) {
        return buildApiUrl(`/api/spot/image/${encodeURIComponent(productRef)}`);
    }

    return '';
}

function applySorting(products) {
    const list = [...products];

    if (sortMode === 'name') {
        list.sort((a, b) => getProductName(a).localeCompare(getProductName(b), 'pt-BR'));
    }

    if (sortMode === 'name-desc') {
        list.sort((a, b) => getProductName(b).localeCompare(getProductName(a), 'pt-BR'));
    }

    if (sortMode === 'code') {
        list.sort((a, b) => String(getProductCode(a)).localeCompare(String(getProductCode(b)), 'pt-BR'));
    }

    return list;
}

function getFilteredProducts() {
    const byType = selectedTypeGroups.size
        ? allProducts.filter(product => selectedTypeGroups.has(buildTypeGroup(getProductType(product))))
        : allProducts;

    const term = searchTerm.trim().toLowerCase();
    const base = term
        ? byType.filter((product) => {
            const identity = buildProductIdentity(product);
            const text = productSearchTextCache.get(identity)
                || `${getProductName(product)} ${getProductCode(product)} ${getProductType(product)} ${getProductReference(product)}`.toLowerCase();
            return text.includes(term);
        })
        : byType;

    const byPrice = base.filter((product) => {
        const price = getProductPrice(product);
        if (priceRange === 'all' || !Number.isFinite(price)) return true;
        if (priceRange === '0-100') return price <= 100;
        if (priceRange === '100-200') return price > 100 && price <= 200;
        if (priceRange === '200-300') return price > 200 && price <= 300;
        if (priceRange === '300+') return price > 300;
        return true;
    });

    return applySorting(byPrice);
}

function updateCount(shown, totalFiltered) {
    if (productsCount) {
        productsCount.textContent = `${totalFiltered} Produtos`;
    }

    if (productsStatus) {
        productsStatus.textContent = `Exibindo ${shown} de ${totalFiltered} itens filtrados (${allProducts.length} no total)`;
    }
}

function renderTypeFilters() {
    if (!typeFilterOptions) return;

    const grouped = new Map();
    for (const product of allProducts) {
        const rawType = getProductType(product);
        const group = buildTypeGroup(rawType);
        grouped.set(group, (grouped.get(group) || 0) + 1);
    }

    const options = [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));

    typeFilterOptions.innerHTML = options.map(([group, count]) => {
        const checked = selectedTypeGroups.has(group) ? 'checked' : '';
        return `<label class="type-filter-option"><input type="checkbox" data-group="${escapeHtml(group)}" ${checked}> <span>${escapeHtml(group)} (${count})</span></label>`;
    }).join('');

    typeFilterOptions.querySelectorAll('[data-group]').forEach(input => {
        input.addEventListener('change', () => {
            const group = input.getAttribute('data-group');
            if (!group) return;
            if (input.checked) selectedTypeGroups.add(group);
            else selectedTypeGroups.delete(group);
            currentPage = 1;
            renderProducts(getFilteredProducts());
        });
    });
}

function buildDetailUrl(product) {
    const ref = getProductReference(product);
    const code = getProductCode(product);
    const params = new URLSearchParams();
    if (ref) params.set('ref', ref);
    if (code) params.set('code', String(code));
    return `produto.html?${params.toString()}`;
}

function openProductDetail(product) {
    try {
        const ref = getProductReference(product);
        const code = getProductCode(product);
        const key = `catalogProduct:${ref || code}`;
        let mappedPrice = null;
        for (const candidate of getProductReferenceCandidates(product)) {
            const value = priceByReference.get(candidate);
            if (Number.isFinite(value)) {
                mappedPrice = value;
                break;
            }
        }

        let mappedCustomization = '';
        for (const candidate of getProductReferenceCandidates(product)) {
            const value = String(customizationByReference.get(candidate) || '').trim();
            if (value) {
                mappedCustomization = value;
                break;
            }
        }

        const snapshot = {
            product,
            stock: null,
            price: mappedPrice,
            customization: mappedCustomization
        };
        sessionStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
        // Ignore storage failures and keep navigation working.
    }

    window.location.href = buildDetailUrl(product);
}

function getPagedProducts(products) {
    const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
        totalPages,
        pageItems: products.slice(start, end)
    };
}

function hydrateVisibleImages() {
    if (!productsGrid) return;

    const images = Array.from(productsGrid.querySelectorAll('img[data-src]'));
    if (!images.length) return;

    const immediateCount = 4;
    images.forEach((image, index) => {
        const assignSrc = () => {
            if (!image.isConnected) return;
            const src = image.getAttribute('data-src');
            if (!src) return;
            image.setAttribute('src', src);
            image.removeAttribute('data-src');
        };

        if (index < immediateCount) {
            assignSrc();
            return;
        }

        setTimeout(assignSrc, 120 * (index - immediateCount + 1));
    });
}

function renderPagination(totalItems, totalPages) {
    if (!catalogPagination) return;

    if (!totalItems) {
        catalogPagination.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    const pagesToRender = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    for (let i = startPage; i <= endPage; i += 1) pagesToRender.push(i);

    catalogPagination.innerHTML = `
        <button class="pagination-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        ${pagesToRender.map((page) => `<button class="pagination-btn ${page === currentPage ? 'is-active' : ''}" data-page="${page}">${page}</button>`).join('')}
        <button class="pagination-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>
        <span class="pagination-summary">Mostrando ${startItem}-${endItem} de ${totalItems}</span>
    `;

    catalogPagination.querySelectorAll('[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-page');
            if (value === 'prev' && currentPage > 1) currentPage -= 1;
            if (value === 'next' && currentPage < totalPages) currentPage += 1;
            if (/^\d+$/.test(String(value || ''))) currentPage = Number(value);
            renderProducts(getFilteredProducts());
        });
    });
}

function renderProducts(products) {
    if (!productsGrid) return;

    const safeList = Array.isArray(products) ? products : [];
    const { totalPages, pageItems } = getPagedProducts(safeList);

    if (!pageItems.length) {
        productsGrid.innerHTML = '<p class="section-description">Nenhum produto encontrado.</p>';
        renderPagination(0, 0);
        updateCount(0, safeList.length);
        return;
    }

    productsGrid.innerHTML = pageItems.map((product, index) => {
        const code = escapeHtml(getProductCode(product));
        const name = escapeHtml(getProductName(product));
        const imageRaw = resolveImageSrc(product);
        const image = escapeHtml(imageRaw);
        const price = getPriceLabel(product);
        const detailUrl = escapeHtml(buildDetailUrl(product));
        const imagePriority = index < 2 ? 'high' : 'auto';
        const shouldEagerLoad = imageRaw && loadedImageUrls.has(imageRaw);
        const imageMarkup = shouldEagerLoad
            ? `<img src="${image}" alt="${name}" loading="eager" decoding="async" fetchpriority="${imagePriority}" onload="window.catalogMarkImageLoaded(this.currentSrc||this.src)" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'product-image-unavailable',textContent:'Imagem Spot indisponível'}));">`
            : `<img data-src="${image}" alt="${name}" loading="lazy" decoding="async" fetchpriority="${imagePriority}" onload="window.catalogMarkImageLoaded(this.currentSrc||this.src)" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'product-image-unavailable',textContent:'Imagem Spot indisponível'}));">`;

        return `
            <a class="product-row-link" href="${detailUrl}" data-ref="${escapeHtml(getProductReference(product))}" data-code="${code}" aria-label="Abrir detalhes do produto ${name}">
                <article class="product-card">
                    <div class="product-card-image">
                        ${image ? imageMarkup : '<div class="product-image-unavailable">Imagem Spot indisponível</div>'}
                    </div>
                    <div class="product-card-body">
                        <p class="product-code">${code}</p>
                        <p class="product-name">${name}</p>
                        <p class="product-price ${price.cssClass}">${escapeHtml(price.text)}</p>
                        <div class="product-actions">
                            <input class="product-qty" type="number" min="50" value="50" data-action="card-qty" aria-label="Quantidade para orçamento">
                            <button class="add-quote-btn" type="button" data-action="add-quote">Adicionar ao orçamento</button>
                        </div>
                    </div>
                </article>
            </a>
        `;
    }).join('');

    productsGrid.querySelectorAll('.product-row-link').forEach((link, index) => {
        const addButton = link.querySelector('[data-action="add-quote"]');
        const qtyInput = link.querySelector('[data-action="card-qty"]');

        if (addButton) {
            addButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const product = pageItems[index];
                if (!product) return;

                const qty = Math.max(50, Math.floor(Number(qtyInput?.value) || 50));
                if (qtyInput instanceof HTMLInputElement) qtyInput.value = String(qty);
                const result = upsertCartItem(product, qty);
                if (quoteCartStatus) {
                    if (!result?.ok) {
                        quoteCartStatus.textContent = 'Sem estoque disponível para este item.';
                    } else {
                        quoteCartStatus.textContent = '';
                    }
                }
                openQuoteCart();
            });
        }

        qtyInput?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        link.addEventListener('click', (event) => {
            event.preventDefault();
            const product = pageItems[index];
            if (!product) return;
            openProductDetail(product);
        });
    });

    renderPagination(safeList.length, totalPages);
    updateCount(pageItems.length, safeList.length);

    hydrateVisibleImages();
}

function initSidebarAccordion() {
    const blocks = Array.from(document.querySelectorAll('[data-block]'));
    const panels = Array.from(document.querySelectorAll('[data-panel]'));

    blocks.forEach((block, index) => {
        block.addEventListener('click', () => {
            block.classList.toggle('is-open');
            const panel = panels[index];
            if (panel) panel.classList.toggle('is-open');
        });
    });
}

function initControls() {
    if (clearTypeFilter) {
        clearTypeFilter.addEventListener('click', () => {
            selectedTypeGroups = new Set();
            currentPage = 1;
            renderTypeFilters();
            renderProducts(getFilteredProducts());
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            sortMode = sortSelect.value;
            currentPage = 1;
            renderProducts(getFilteredProducts());
        });
    }

    if (priceFilter) {
        priceFilter.addEventListener('change', () => {
            priceRange = priceFilter.value;
            currentPage = 1;
            renderProducts(getFilteredProducts());
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchDebounceId) {
                clearTimeout(searchDebounceId);
            }

            searchDebounceId = setTimeout(() => {
                const nextTerm = searchInput.value || '';
                if (nextTerm === searchTerm) return;
                searchTerm = nextTerm;
                currentPage = 1;
                renderProducts(getFilteredProducts());
            }, 120);
        });
    }
}

function initQuoteCart() {
    quoteCart = readQuoteCart();
    renderQuoteCart();

    if (new URLSearchParams(window.location.search).get('quote') === '1') {
        openQuoteCart();
    }

    window.addEventListener('open-quote-cart', openQuoteCart);

    openQuoteCartButton?.addEventListener('click', () => {
        openQuoteCart();
    });

    closeQuoteCartButton?.addEventListener('click', () => {
        closeQuoteCart();
    });

    clearQuoteCartButton?.addEventListener('click', () => {
        quoteCart = [];
        saveQuoteCart();
        renderQuoteCart();
        if (quoteCartStatus) quoteCartStatus.textContent = '';
    });

    quoteCartItems?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const action = target.getAttribute('data-action');
        if (!action) return;

        const card = target.closest('[data-cart-id]');
        if (!card) return;
        const id = card.getAttribute('data-cart-id');
        if (!id) return;

        if (action === 'remove') {
            quoteCart = quoteCart.filter((item) => item.id !== id);
            saveQuoteCart();
            renderQuoteCart();
            return;
        }

        if (action === 'update') {
            const qtyInput = card.querySelector('[data-action="qty"]');
            const qty = Math.max(50, Number(qtyInput?.value) || 50);

            if (qtyInput instanceof HTMLInputElement) {
                qtyInput.value = String(qty);
            }

            quoteCart = quoteCart.map((item) => item.id === id ? { ...item, qty } : item);
            saveQuoteCart();
            renderQuoteCart();

            if (quoteCartStatus) {
                quoteCartStatus.textContent = '';
            }
        }
    });

    quoteCartForm?.addEventListener('submit', submitQuoteCartForm);

    const whatsappInput = document.getElementById('quoteWhatsapp');
    whatsappInput?.addEventListener('input', () => {
        whatsappInput.value = applyWhatsappMask(whatsappInput.value);
    });
    whatsappInput?.addEventListener('blur', () => {
        whatsappInput.value = applyWhatsappMask(whatsappInput.value);
    });
}

function setActiveCatalog(catalog) {
    activeCatalog = catalog === 'brindes' ? 'brindes' : 'kits';
    searchTerm = '';
    priceRange = 'all';
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    if (priceFilter) priceFilter.value = 'all';
    catalogSelectorButtons.forEach((button) => {
        const isActive = button.getAttribute('data-catalog') === activeCatalog;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    if (brindesCatalogDownload) {
        brindesCatalogDownload.hidden = activeCatalog !== 'brindes';
    }
}

async function fetchProducts(catalog = activeCatalog) {
    if (isLoadingProducts) return;

    isLoadingProducts = true;
    setActiveCatalog(catalog);
    if (productsStatus) productsStatus.textContent = `Carregando catálogo de ${activeCatalog === 'kits' ? 'kits' : 'brindes'}...`;

    const cachedProducts = catalogProductsCache.get(activeCatalog) || [];
    const hasCachedProducts = cachedProducts.length > 0;

    if (hasCachedProducts) {
        allProducts = cachedProducts;
        rebuildProductSearchCache(allProducts);
        currentPage = 1;
        renderTypeFilters();
        renderProducts(getFilteredProducts());
        if (productsStatus) {
            productsStatus.textContent = `Exibindo ${cachedProducts.length} itens do catálogo de ${activeCatalog === 'kits' ? 'kits' : 'brindes'}`;
        }
        isLoadingProducts = false;
        return;
    } else if (productsGrid) {
        productsGrid.innerHTML = '';
    }

    let lastError = null;

    try {
        let products = [];
        const endpoint = activeCatalog === 'kits' ? '/api/catalog/products' : '/api/spot/products?lang=PT';
        const data = await fetchApiJson(endpoint, activeCatalog === 'kits' ? 15000 : 30000);
        products = extractProducts(data);
        if (!products.length) {
            if (hasCachedProducts) {
                if (productsStatus) {
                    productsStatus.textContent = 'Catálogo atualizado indisponível no momento. Exibindo dados em cache.';
                }
                return;
            }
            throw new Error('Lista de produtos vazia na API');
        }

        catalogProductsCache.set(activeCatalog, products);

        allProducts = products;
        rebuildProductSearchCache(allProducts);
        currentPage = 1;
        renderTypeFilters();
        renderProducts(getFilteredProducts());
        if (productsStatus) {
            productsStatus.textContent = `Exibindo ${products.length} itens do catálogo de ${activeCatalog === 'kits' ? 'kits' : 'brindes'}`;
        }
        return;

    } catch (error) {
        lastError = error;
        if (hasCachedProducts) {
            if (productsStatus) {
                productsStatus.textContent = `Conexao instavel na atualizacao (${lastError?.message || 'sem resposta'}). Exibindo cache local.`;
            }
        } else {
            if (productsStatus) productsStatus.textContent = `Falha ao carregar produtos: ${lastError?.message || 'sem resposta'}`;
            if (productsGrid) productsGrid.innerHTML = '<p class="section-description">Não foi possível carregar os produtos agora.</p>';
            if (productsCount) productsCount.textContent = '0 Produtos';
        }
    } finally {
        isLoadingProducts = false;
    }
}

initSidebarAccordion();
initControls();
initQuoteCart();
catalogSelectorButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const catalog = button.getAttribute('data-catalog');
        if (catalog) fetchProducts(catalog);
    });
});
fetchProducts();

resolveApiBaseCandidate().then((resolvedBase) => {
    if (!resolvedBase) return;
    if (!allProducts.length) return;
    renderProducts(getFilteredProducts());
});
