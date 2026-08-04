const detailStatus = document.getElementById('productDetailStatus');
const detailCard = document.getElementById('productDetailCard');
const backToCatalog = document.getElementById('backToCatalog');

const apiBase = window.SPOT_API_BASE || (window.location.protocol === 'file:' ? 'http://localhost:3001' : window.location.origin);
const apiCandidates = [apiBase];
const spotImageBase = window.SPOT_IMAGE_BASE || '';
let currentDetailSnapshot = null;
let activeApiBase = apiBase;
let apiBaseResolvePromise = null;
let detailGalleryImages = [];
let detailGalleryIndex = 0;
let detailKeydownHandler = null;
const DETAIL_IMAGES_CACHE_TTL_MS = 30 * 60 * 1000;
const QUOTE_CART_KEY = 'catalogQuoteCartV1';
const PRODUCTS_CACHE_KEYS = ['spotCatalogProductsSessionCacheV1', 'spotCatalogProductsCacheV1'];

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}

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

function formatCurrency(value) {
    if (!Number.isFinite(value)) return 'Preco sob consulta';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

function getProductName(product) {
    return product.Name || product.Title || product.ProductName || product.Description || 'Produto sem nome';
}

function getProductStock(product) {
    const value = parseNumber(product?.Stock ?? product?.stock ?? product?.Quantity ?? product?.estoque);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function getProductPrice(product) {
    const value = parseNumber(product?.Price ?? product?.CatalogPrice ?? product?.preco);
    return Number.isFinite(value) ? value : null;
}

function findProductByReference(products, ref, code) {
    const references = new Set([String(ref || '').trim(), String(code || '').trim()].filter(Boolean));
    return (Array.isArray(products) ? products : []).find((product) => {
        const productRef = String(getProductReference(product)).trim();
        const productCode = String(getProductCode(product)).trim();
        return references.has(productRef) || references.has(productCode);
    }) || null;
}

function readCachedProduct(ref, code) {
    for (const cacheKey of PRODUCTS_CACHE_KEYS) {
        try {
            const cachedValues = [sessionStorage.getItem(cacheKey), localStorage.getItem(cacheKey)];
            for (const value of cachedValues) {
                const parsed = JSON.parse(value || 'null');
                const product = findProductByReference(parsed?.products, ref, code);
                if (product) return product;
            }
        } catch {
            // Try the next available cache.
        }
    }

    return null;
}

async function loadProductByReference(ref, code) {
    await resolveApiBaseCandidate();
    try {
        const response = await fetchWithTimeout(buildApiUrl('/api/catalog/products'), 15000);
        if (response.ok) {
            const payload = await response.json();
            const localProduct = findProductByReference(payload?.Products, ref, code);
            if (localProduct) return localProduct;
        }
    } catch {
        // Fall back to a previously cached product when the local catalog is unavailable.
    }

    return readCachedProduct(ref, code);
}

function readQuoteCart() {
    try {
        const items = JSON.parse(localStorage.getItem(QUOTE_CART_KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function addProductToQuote(product, quantity) {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const code = String(getProductCode(product));
    const ref = String(getProductReference(product) || code);
    const cart = readQuoteCart();
    const existing = cart.find((item) => item.id === ref);

    if (existing) {
        existing.qty = Math.max(1, Number(existing.qty) || 1) + qty;
        existing.stock = null;
    } else {
        cart.push({
            id: ref,
            code,
            name: getProductName(product),
            ref,
            image: resolveImageSrc(product),
            stock: null,
            qty
        });
    }

    localStorage.setItem(QUOTE_CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('quote-cart-changed'));
}

function getRelatedReferences(product) {
    return String(product?.RelatedReferences || '')
        .split(',')
        .map((value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            const numeric = (raw.match(/\d+/) || [])[0];
            return numeric || raw;
        })
        .filter(Boolean);
}

function getImageFileToken(raw) {
    const token = String(raw || '').trim();
    if (!token) return '';
    return token.split('/').pop().replace(/[?#].*$/, '');
}

function resolveImageSrc(product) {
    const raw = product.MainImage || product.Image || product.Photo || product.ImageURL || '';
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

function getInitialImageUrls(product) {
    const refs = [];
    const mainRaw = String(product.MainImage || product.Image || product.Photo || product.ImageURL || '').trim();
    if (mainRaw) {
        if (/^https?:\/\//i.test(mainRaw) || mainRaw.startsWith('/')) {
            refs.push(mainRaw);
        } else {
            const main = getImageFileToken(mainRaw);
            if (main) refs.push(main);
        }
    }

    const extrasRaw = [product.AllImageList, product.AditionalImageList, product.Images, product.GalleryImages, product.OtherImages]
        .filter(Boolean)
        .flatMap((value) => Array.isArray(value) ? value : String(value).split(/[,;|]/g));

    for (const raw of extrasRaw) {
        const rawText = String(raw || '').trim();
        if (!rawText) continue;

        if (/^https?:\/\//i.test(rawText) || rawText.startsWith('/')) {
            refs.push(rawText);
            continue;
        }

        const file = getImageFileToken(rawText);
        if (file) refs.push(file);
    }

    const uniqueFiles = [...new Set(refs.map((item) => item.toLowerCase()))];
    const originalByKey = new Map(refs.map((item) => [item.toLowerCase(), item]));
    return uniqueFiles
        .map((key) => originalByKey.get(key))
        .filter(Boolean)
        .map((file) => {
            if (/^https?:\/\//i.test(file)) {
                return file;
            }

            if (file.startsWith('/')) {
                return `${activeApiBase}${file}`;
            }

            const ref = getProductReference(product);
            const qs = new URLSearchParams();
            if (ref) qs.set('ref', ref);
            const query = qs.toString();
            return `${buildApiUrl(`/api/spot/image/${encodeURIComponent(file)}`)}${query ? `?${query}` : ''}`;
        });
}

function buildDetailImagesCacheKey(product) {
    return `spotProductImagesV2:${getProductReference(product)}:${getImageFileToken(product?.MainImage || product?.Image || product?.Photo || product?.ImageURL || '')}`;
}

function hasDeclaredGalleryImages(product) {
    return [product?.AllImageList, product?.AditionalImageList, product?.Images, product?.GalleryImages, product?.OtherImages]
        .some((value) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim()));
}

function readDetailImagesCache(product) {
    try {
        const raw = sessionStorage.getItem(buildDetailImagesCacheKey(product));
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached || !Array.isArray(cached.images) || Date.now() - Number(cached.savedAt) > DETAIL_IMAGES_CACHE_TTL_MS) {
            return null;
        }
        return cached.images.filter((image) => typeof image === 'string' && image.trim());
    } catch {
        return null;
    }
}

function saveDetailImagesCache(product, images) {
    if (!Array.isArray(images) || !images.length) return;
    try {
        sessionStorage.setItem(buildDetailImagesCacheKey(product), JSON.stringify({
            savedAt: Date.now(),
            images
        }));
    } catch {
        // Ignore storage quota failures and continue with the API response.
    }
}

function preloadDetailNeighborImages() {
    if (!detailGalleryImages.length) return;
    const nextIndex = (detailGalleryIndex + 1) % detailGalleryImages.length;
    const prevIndex = (detailGalleryIndex - 1 + detailGalleryImages.length) % detailGalleryImages.length;
    [detailGalleryImages[nextIndex], detailGalleryImages[prevIndex]].forEach((src) => {
        if (!src) return;
        const img = new Image();
        img.src = src;
    });
}

function preloadPrimaryDetailImage(product) {
    const src = resolveImageSrc(product);
    if (!src) return;

    console.count('product-detail:primary-image:request');
    console.time('product-detail:primary-image');
    const image = new Image();
    image.onload = () => console.timeEnd('product-detail:primary-image');
    image.onerror = () => {
        console.timeEnd('product-detail:primary-image');
        console.warn('Falha ao pré-carregar imagem principal do produto Spot:', src);
    };
    image.src = src;
}

function setActiveDetailImage(index) {
    const mainImage = document.getElementById('detailMainImage');
    const thumbs = document.getElementById('detailThumbs');
    const counter = document.getElementById('detailCarouselCounter');
    if (!mainImage || !thumbs || !detailGalleryImages.length) return;

    const bounded = Math.max(0, Math.min(index, detailGalleryImages.length - 1));
    detailGalleryIndex = bounded;
    const src = detailGalleryImages[detailGalleryIndex];
    if (!src) return;

    mainImage.setAttribute('src', src);
    thumbs.querySelectorAll('.detail-thumb').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('is-active', thumbIndex === detailGalleryIndex);
    });

    if (counter) {
        counter.textContent = `${detailGalleryIndex + 1} / ${detailGalleryImages.length}`;
    }

    preloadDetailNeighborImages();
}

function updateDetailGallery(images, name) {
    const mainImageButton = document.getElementById('detailMainImageButton');
    const mainImage = document.getElementById('detailMainImage');
    const unavailable = document.getElementById('detailImageUnavailable');
    const thumbs = document.getElementById('detailThumbs');
    const prevButton = document.getElementById('detailCarouselPrev');
    const nextButton = document.getElementById('detailCarouselNext');
    const counter = document.getElementById('detailCarouselCounter');
    if (!mainImageButton || !mainImage || !unavailable || !thumbs || !prevButton || !nextButton || !counter) return;

    const list = [...new Set([].concat(images || []).map((value) => String(value || '').trim()).filter(Boolean))];
    const currentSrc = mainImage.getAttribute('src') || '';

    if (!list.length) {
        detailGalleryImages = [];
        detailGalleryIndex = 0;
        mainImageButton.hidden = true;
        unavailable.hidden = false;
        thumbs.innerHTML = '';
        thumbs.hidden = true;
        prevButton.hidden = true;
        nextButton.hidden = true;
        counter.hidden = true;
        return;
    }

    const matchedIndex = currentSrc ? list.findIndex((item) => item === currentSrc) : -1;
    detailGalleryImages = list;
    detailGalleryIndex = matchedIndex >= 0 ? matchedIndex : Math.min(detailGalleryIndex, detailGalleryImages.length - 1);

    mainImageButton.hidden = false;
    mainImage.hidden = false;
    unavailable.hidden = true;
    mainImage.setAttribute('alt', name);
    prevButton.hidden = detailGalleryImages.length <= 1;
    nextButton.hidden = detailGalleryImages.length <= 1;
    counter.hidden = detailGalleryImages.length <= 1;
    thumbs.hidden = detailGalleryImages.length <= 1;

    thumbs.innerHTML = detailGalleryImages.length > 1 ? detailGalleryImages.map((src, index) => `
        <button type="button" class="detail-thumb ${index === detailGalleryIndex ? 'is-active' : ''}" data-detail-index="${index}" aria-label="Ver imagem ${index + 1}">
            <img src="${escapeHtml(src)}" alt="Miniatura ${index + 1} de ${name}" loading="lazy" onerror="this.closest('button')?.remove();">
        </button>
    `).join('') : '';

    setActiveDetailImage(detailGalleryIndex);
}

function bindDetailGalleryEvents() {
    const mainImageButton = document.getElementById('detailMainImageButton');
    const mainImage = document.getElementById('detailMainImage');
    const thumbs = document.getElementById('detailThumbs');
    const modal = document.getElementById('detailImageModal');
    const modalImage = document.getElementById('detailImageModalImage');
    const closeButton = document.getElementById('detailImageModalClose');
    const prevButton = document.getElementById('detailCarouselPrev');
    const nextButton = document.getElementById('detailCarouselNext');
    if (!mainImageButton || !mainImage || !thumbs || !modal || !modalImage || !closeButton || !prevButton || !nextButton) return;

    const openModal = () => {
        const src = detailGalleryImages[detailGalleryIndex] || mainImage.getAttribute('src');
        if (!src) return;
        modalImage.setAttribute('src', src);
        modalImage.onerror = () => {
            closeModal();
        };
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.hidden = true;
        modalImage.removeAttribute('src');
        document.body.style.overflow = '';
    };

    thumbs.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = target.closest('[data-detail-index]');
        if (!(button instanceof HTMLElement)) return;

        const index = Number(button.getAttribute('data-detail-index'));
        if (!Number.isFinite(index)) return;
        setActiveDetailImage(index);
    });

    prevButton.addEventListener('click', () => {
        if (!detailGalleryImages.length) return;
        const nextIndex = (detailGalleryIndex - 1 + detailGalleryImages.length) % detailGalleryImages.length;
        setActiveDetailImage(nextIndex);
    });

    nextButton.addEventListener('click', () => {
        if (!detailGalleryImages.length) return;
        const nextIndex = (detailGalleryIndex + 1) % detailGalleryImages.length;
        setActiveDetailImage(nextIndex);
    });

    mainImageButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    if (detailKeydownHandler) {
        document.removeEventListener('keydown', detailKeydownHandler);
    }

    detailKeydownHandler = (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
        if (event.key === 'ArrowLeft' && detailGalleryImages.length > 1) {
            setActiveDetailImage((detailGalleryIndex - 1 + detailGalleryImages.length) % detailGalleryImages.length);
        }
        if (event.key === 'ArrowRight' && detailGalleryImages.length > 1) {
            setActiveDetailImage((detailGalleryIndex + 1) % detailGalleryImages.length);
        }
    };

    document.addEventListener('keydown', detailKeydownHandler);
}

async function fetchAllProductImages(product) {
    console.count('product-detail:images:request');
    console.time('product-detail:images');
    const cachedImages = readDetailImagesCache(product);
    if (cachedImages) {
        console.count('product-detail:images:cache-hit');
        console.timeEnd('product-detail:images');
        return cachedImages;
    }

    const ref = getProductReference(product);
    if (!ref) {
        console.timeEnd('product-detail:images');
        return getInitialImageUrls(product);
    }

    const declaredImages = getInitialImageUrls(product);
    const isLocalImage = String(product?.MainImage || product?.Image || '').trim().startsWith('/');
    if (isLocalImage) {
        const code = getProductCode(product);
        try {
            const response = await fetchWithTimeout(buildApiUrl(`/api/catalog/products/${encodeURIComponent(code)}/images`), 5000);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const localImages = Array.isArray(payload?.images)
                ? payload.images.map((image) => `${activeApiBase}${String(image || '').startsWith('/') ? '' : '/'}${image}`).filter(Boolean)
                : [];
            const images = localImages.length ? localImages : declaredImages;
            saveDetailImagesCache(product, images);
            return images;
        } finally {
            console.timeEnd('product-detail:images');
        }
    }

    if (hasDeclaredGalleryImages(product) && declaredImages.length) {
        saveDetailImagesCache(product, declaredImages);
        console.timeEnd('product-detail:images');
        return declaredImages;
    }

    const mainFile = getImageFileToken(product.MainImage || product.Image || product.Photo || product.ImageURL || '');

    try {
        const qs = new URLSearchParams();
        if (mainFile) qs.set('main', mainFile);
        const url = `${buildApiUrl(`/api/spot/product-images/${encodeURIComponent(ref)}`)}${qs.toString() ? `?${qs.toString()}` : ''}`;
        const response = await fetchWithTimeout(url, 12000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const apiImages = Array.isArray(payload?.images)
            ? payload.images.map((item) => {
                const relative = String(item?.url || '').trim();
                if (!relative) return '';
                if (/^https?:\/\//i.test(relative)) return relative;
                return `${activeApiBase}${relative.startsWith('/') ? '' : '/'}${relative}`;
            }).filter(Boolean)
            : [];

        const images = apiImages.length ? apiImages : getInitialImageUrls(product);
        if (apiImages.length) {
            saveDetailImagesCache(product, images);
        }
        return images;
    } catch (error) {
        console.warn('Falha ao carregar imagens do produto Spot:', error);
        return getInitialImageUrls(product);
    } finally {
        console.timeEnd('product-detail:images');
    }
}

function renderDetail(snapshot) {
    const product = snapshot?.product;
    if (!product || !detailCard) {
        if (detailStatus) detailStatus.textContent = 'Produto nao encontrado.';
        return;
    }

    const name = escapeHtml(product.Name || product.Title || product.ProductName || product.Description || 'Produto sem nome');
    const code = escapeHtml(getProductCode(product));
    const description = escapeHtml(product.ShortDescription || product.Description || '');
    const productType = escapeHtml(product.ProductTypeName || product.SubType || product.Type || product.Category || product.ProductType || 'Outros');
    const sizeCapacity = escapeHtml(product.CombinedSizes || product.Sizes || product.Capacitys || 'Sob consulta');
    const customization = 'logo personalizado em uma cor';
    currentDetailSnapshot = snapshot || null;

    const priceValue = parseNumber(snapshot?.price ?? getProductPrice(product));
    const priceLabel = Number.isFinite(priceValue)
        ? formatCurrency(priceValue)
        : 'Preco sob consulta';

    detailCard.innerHTML = `
        <div class="product-card-image product-detail-media">
            <div class="detail-main-stage">
                <button id="detailMainImageButton" class="detail-main-image-button" type="button" hidden aria-label="Ampliar imagem do produto">
                    <img id="detailMainImage" alt="${name}" hidden>
                </button>
                <button id="detailCarouselPrev" class="detail-carousel-nav is-prev" type="button" aria-label="Imagem anterior">‹</button>
                <button id="detailCarouselNext" class="detail-carousel-nav is-next" type="button" aria-label="Próxima imagem">›</button>
            </div>
            <div id="detailImageUnavailable" class="product-image-unavailable">Carregando imagens...</div>
            <p id="detailCarouselCounter" class="detail-carousel-counter" hidden></p>
            <div id="detailThumbs" class="detail-thumbs"></div>
        </div>
        <div class="product-card-body">
            <p class="product-code">${code}</p>
            <p class="product-name">${name}</p>
            ${description ? `<p class="product-detail">${description}</p>` : ''}
            <p class="product-detail"><strong>Tipo:</strong> ${productType}</p>
            <p class="product-detail"><strong>Tamanho/Capacidade:</strong> ${sizeCapacity}</p>
            <p class="product-detail"><strong>Personalizacao:</strong> ${customization}</p>
            <p class="product-meta">${escapeHtml(priceLabel)}</p>
            <div class="product-actions product-detail-actions">
                <input id="detailQuoteQty" class="product-qty" type="number" min="50" value="50" aria-label="Quantidade para orçamento">
                <button id="detailAddQuote" class="add-quote-btn" type="button">Adicionar ao orçamento</button>
            </div>
            <p id="detailQuoteStatus" class="detail-quote-status" aria-live="polite"></p>
        </div>
        <div id="detailImageModal" class="detail-image-modal" hidden>
            <button id="detailImageModalClose" class="detail-image-modal-close" type="button" aria-label="Fechar imagem ampliada">×</button>
            <img id="detailImageModalImage" class="detail-image-modal-image" alt="Imagem ampliada do produto">
        </div>
    `;

    detailCard.style.display = 'grid';
    if (detailStatus) {
        detailStatus.textContent = '';
        detailStatus.style.display = 'none';
    }

    bindDetailGalleryEvents();

    const quoteQtyInput = document.getElementById('detailQuoteQty');
    const addQuoteButton = document.getElementById('detailAddQuote');
    const quoteStatus = document.getElementById('detailQuoteStatus');
    addQuoteButton?.addEventListener('click', () => {
        const quantity = Math.max(50, Math.floor(Number(quoteQtyInput?.value) || 50));
        if (quoteQtyInput instanceof HTMLInputElement) quoteQtyInput.value = String(quantity);
        addProductToQuote(product, quantity);
        if (quoteStatus) quoteStatus.textContent = 'Produto adicionado ao orçamento.';
    });

    preloadPrimaryDetailImage(product);
    fetchAllProductImages(product).then((allImages) => {
        updateDetailGallery(allImages, name);
    }).catch((error) => {
        console.warn('Falha ao preparar galeria do produto:', error);
        updateDetailGallery([], name);
    });
}

async function loadDetail() {
    console.count('product-detail:load');
    console.time('product-detail:open');
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || '';
    const code = params.get('code') || '';
    const key = `catalogProduct:${ref || code}`;

    try {
        const raw = sessionStorage.getItem(key);
        let snapshot = raw ? JSON.parse(raw) : null;
        if (!snapshot?.product) {
            const product = await loadProductByReference(ref, code);
            if (!product) {
                if (detailStatus) detailStatus.textContent = 'Produto nao encontrado.';
                return;
            }

            snapshot = {
                product,
                stock: getProductStock(product),
                price: getProductPrice(product),
                customization: ''
            };
            sessionStorage.setItem(key, JSON.stringify(snapshot));
        }

        if (!snapshot?.product) {
            if (detailStatus) detailStatus.textContent = 'Produto nao encontrado.';
            return;
        }

        renderDetail(snapshot);
    } catch {
        if (detailStatus) detailStatus.textContent = 'Falha ao carregar detalhes do produto.';
    } finally {
        console.timeEnd('product-detail:open');
    }
}

function initBackNavigation() {
    if (!backToCatalog) return;

    backToCatalog.addEventListener('click', (event) => {
        const hasHistory = window.history.length > 1;
        const cameFromCatalog = /produtos\.html/i.test(String(document.referrer || ''));

        if (hasHistory && cameFromCatalog) {
            event.preventDefault();
            window.history.back();
        }
    });
}

initBackNavigation();
loadDetail();
