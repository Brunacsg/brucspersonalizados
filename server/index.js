require('dotenv').config();
const express = require('express');
const SpotClient = require('./spot-client');
const path = require('path');
const fs = require('fs');
const fetch = global.fetch || require('node-fetch');

const ACCESS_KEY = process.env.ACCESS_KEY;
const LOCAL_CATALOG_PRODUCTS = require('../data/local-products.json');
const LOCAL_BRINDES_CATALOG = require('../catalogo_unificado_sem_kits.json');
const LOCAL_CATALOG_PRICE_MULTIPLIER = 2.3;
const EXCLUDED_LOCAL_CATALOG_CODES = new Set(['VI-00721-900', 'KT-9009K']);
const SPOT_PRODUCTS_SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'spot-products-cache.json');
const SPOT_PRODUCTS_SNAPSHOT_MAX_AGE_MS = Number(process.env.SPOT_PRODUCTS_SNAPSHOT_MAX_AGE_MS) || 24 * 60 * 60 * 1000;
const LOCAL_PRODUCTS_IMAGE_DIR = path.join(__dirname, '..', 'products_print_area_allcolors_market1_150px');
const CATALOG_DOWNLOAD_DIR = path.join(__dirname, '..', 'catalogo');
const COMPLETE_CATALOG_FILE = 'Cata\u0301logo_Brucs_2026.pdf';
const KITS_CATALOG_FILE = 'Cata\u0301logo_kits .pdf';
const BRINDES_CATALOG_FILE = path.join(__dirname, '..', 'Catalogo BRUCS 2026-27.pdf');
const SPOT_CLOUD_SHARE_URL = process.env.SPOT_CLOUD_SHARE_URL || 'http://cloud.stricker.pt:8085/index.php/s/J5Nb5Y1nLzXZqcV?path=%2FHigh_Resolution_original_dimension_shadow';
const SPOT_CLOUD_SHARE_URLS = (process.env.SPOT_CLOUD_SHARE_URLS || `${SPOT_CLOUD_SHARE_URL};http://cloud.stricker.pt:8085/index.php/s/PpbNfDoJ2VIU2qd;http://cloud.stricker.pt:8085/index.php/s/B866XCvuIMxOyq0;http://cloud.stricker.pt:8085/index.php/s/0DdMY82GiM8OhgQ`)
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
const SPOT_CLOUD_PASSWORD = process.env.SPOT_CLOUD_PASSWORD || 'spot_cloud_files';
const SPOT_CLOUD_SHARE_PASSWORDS = (process.env.SPOT_CLOUD_SHARE_PASSWORDS || 'J5Nb5Y1nLzXZqcV=spot_cloud_files;PpbNfDoJ2VIU2qd=spot_cloud_files;B866XCvuIMxOyq0=agendas_cloud_files;0DdMY82GiM8OhgQ=agendas_cloud_files')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
const SPOT_CLOUD_IMAGES_BASE_PATHS = (process.env.SPOT_CLOUD_IMAGES_BASE_PATHS || '/High_Resolution_original_dimension_shadow/Spot;/High_Resolution_original_dimension_no_shadow/Spot;/Medium_Resolution_1000x1000_pixeis_shadow/Spot;/Medium_Resolution_1000x1000_pixeis_no_shadow/Spot;/High_Resolution_original_dimension_shadow/Agendas;/High_Resolution_original_dimension_no_shadow/Agendas;/Medium_Resolution_1000x1000_pixeis_shadow/Agendas;/Medium_Resolution_1000x1000_pixeis_no_shadow/Agendas;/High_Resolution_original_dimension_shadow;/High_Resolution_original_dimension_no_shadow;/Medium_Resolution_1000x1000_pixeis_shadow;/Medium_Resolution_1000x1000_pixeis_no_shadow')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
const SPOT_CLOUD_WEBDAV_BASE = process.env.SPOT_CLOUD_WEBDAV_BASE || '/public.php/webdav';
const SPOT_PERF_DEBUG = process.env.SPOT_PERF_DEBUG === 'true';
const SPOT_CATALOG_ENABLED = process.env.SPOT_CATALOG_ENABLED !== 'false';

function logSpotPerf(event, startedAt, details = '') {
    if (!SPOT_PERF_DEBUG) return;
    console.log(`[spot-perf] ${event} ${Date.now() - startedAt}ms${details ? ` ${details}` : ''}`);
}

let localImageIndexPromise = null;
const spotCloudFolderCache = new Map();
const spotCloudResolvedCache = new Map();
const spotCloudMissCache = new Map();
const spotCloudShareRootsCache = new Map();
const imageBinaryCache = new Map();
const imageInFlight = new Map();
const productImagesListCache = new Map();
const catalogContentCache = new Map();
const productsApiCache = new Map();
const productsInFlight = new Map();
const imageWarmupInFlight = new Set();
const stocksByLangCache = new Map();
const stocksInFlight = new Map();
const SPOT_CACHE_SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const SPOT_CACHE_MISS_TTL_MS = 15 * 60 * 1000;
const SPOT_CACHE_MAX_ENTRIES = 5000;
const IMAGE_BINARY_TTL_MS = 30 * 60 * 1000;
const PRODUCT_IMAGES_LIST_TTL_MS = 30 * 60 * 1000;
const CATALOG_CONTENT_TTL_MS = 90 * 1000;
const PRODUCTS_API_TTL_MS = 5 * 60 * 1000;
const STOCKS_CACHE_TTL_MS = 60 * 1000;

function pruneCache(cache) {
    if (cache.size <= SPOT_CACHE_MAX_ENTRIES) return;
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
        cache.delete(firstKey);
    }
}

function getCacheValue(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setCacheValue(cache, key, value, ttlMs) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    pruneCache(cache);
}

function buildCatalogCacheKey(lang, query) {
    const keys = Object.keys(query || {}).sort();
    const serialized = keys.map((key) => `${key}=${String(query[key] ?? '')}`).join('&');
    return `${lang}|${serialized}`;
}

function isProductsPayloadUsable(payload) {
    return Array.isArray(payload?.Products) && payload.Products.length > 0 && Number(payload?.ErrorCode || 0) === 0;
}

function readSpotProductsSnapshot(cacheKey) {
    try {
        const snapshot = JSON.parse(fs.readFileSync(SPOT_PRODUCTS_SNAPSHOT_FILE, 'utf8'));
        if (!snapshot || snapshot.cacheKey !== cacheKey || !isProductsPayloadUsable(snapshot.payload)) return null;
        if (Date.now() - Number(snapshot.savedAt) > SPOT_PRODUCTS_SNAPSHOT_MAX_AGE_MS) return null;
        return snapshot.payload;
    } catch {
        return null;
    }
}

function saveSpotProductsSnapshot(cacheKey, payload) {
    if (!isProductsPayloadUsable(payload)) return;
    try {
        fs.mkdirSync(path.dirname(SPOT_PRODUCTS_SNAPSHOT_FILE), { recursive: true });
        fs.writeFileSync(SPOT_PRODUCTS_SNAPSHOT_FILE, JSON.stringify({ cacheKey, savedAt: Date.now(), payload }), 'utf8');
    } catch (error) {
        console.warn('Spot products snapshot write failed:', error.message);
    }
}

function sendSpotCatalogDisabled(res) {
    return res.status(503).json({
        error: 'Spot catalog temporarily disabled',
        message: 'O catálogo de produtos está temporariamente indisponível.'
    });
}

function isExcludedLocalCatalogProduct(product) {
    return EXCLUDED_LOCAL_CATALOG_CODES.has(String(product?.codigo || '').trim());
}

function calculateLocalCatalogPrice(price) {
    return Number.isFinite(price)
        ? Math.round((price * LOCAL_CATALOG_PRICE_MULTIPLIER + Number.EPSILON) * 100) / 100
        : null;
}

function normalizeLocalCatalogProduct(product) {
    const code = String(product?.codigo || '').trim();
    const price = Number(product?.preco);
    const stock = Number(product?.estoque);
    return {
        InternalReference: code,
        ProdReference: code,
        ProductCode: code,
        Name: String(product?.nome || '').trim(),
        ProductTypeName: 'Kits',
        MainImage: `/${code}-1.jpg`,
        Price: calculateLocalCatalogPrice(price),
        Stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null
    };
}

const LOCAL_CATALOG_PRODUCTS_NORMALIZED = LOCAL_CATALOG_PRODUCTS
    .filter((product) => !isExcludedLocalCatalogProduct(product))
    .map(normalizeLocalCatalogProduct);

function normalizeLocalBrindeProduct(product) {
    const code = String(product?.codigo || '').trim();
    const price = Number(product?.preco);
    const stock = Number(product?.estoque);
    return {
        InternalReference: code,
        ProdReference: code,
        ProductCode: code,
        Name: String(product?.nome || '').trim(),
        ProductTypeName: 'Brindes',
        MainImage: `/${code}-1.jpg`,
        Price: calculateLocalCatalogPrice(price),
        Stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null
    };
}

const LOCAL_BRINDES_PRODUCTS_NORMALIZED = (LOCAL_BRINDES_CATALOG?.produtos?.produto || [])
    .map(normalizeLocalBrindeProduct)
    .filter((product) => product.ProductCode && product.Name);

function getLocalCatalogImageFiles(code) {
    const escapedCode = String(code || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escapedCode) return [];
    const pattern = new RegExp(`^${escapedCode}-(\\d+)\\.(png|jpe?g|webp)$`, 'i');
    return fs.readdirSync(path.join(__dirname, '..'))
        .map((file) => ({ file, match: file.match(pattern) }))
        .filter(({ match }) => Boolean(match))
        .sort((left, right) => Number(left.match[1]) - Number(right.match[1]))
        .map(({ file }) => `/${file}`);
}

async function fetchWithRetry(url, options = {}, { timeoutMs = 8000, retries = 1 } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
        }
    }

    throw lastError || new Error('Spot cloud request failed');
}

function parseSpotCloudSharePasswords() {
    const byToken = new Map();
    for (const row of SPOT_CLOUD_SHARE_PASSWORDS) {
        const [token, password] = String(row || '').split('=').map((value) => String(value || '').trim());
        if (!token || !password) continue;
        byToken.set(token, password);
    }
    return byToken;
}

function parseSpotCloudShareUrl() {
    const passwordByToken = parseSpotCloudSharePasswords();
    const parsedShares = [];
    for (const shareUrl of SPOT_CLOUD_SHARE_URLS) {
        try {
            const parsed = new URL(shareUrl);
            const tokenMatch = parsed.pathname.match(/\/s\/([^\/]+)/i);
            const token = tokenMatch ? tokenMatch[1] : '';
            if (!token) continue;
            parsedShares.push({
                origin: `${parsed.protocol}//${parsed.host}`,
                token,
                password: passwordByToken.get(token) || parsed.password || SPOT_CLOUD_PASSWORD
            });
        } catch {
            // ignore malformed URL
        }
    }

    return parsedShares;
}

function extractRefFromImageToken(fileToken) {
    const token = String(fileToken || '').trim();
    const match = token.match(/(\d{3,})/);
    return match ? match[1] : '';
}

function normalizeRefToken(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const numeric = (raw.match(/\d+/) || [])[0];
    return numeric || raw;
}

function getStockRefFromEntry(entry) {
    const raw = String(entry?.ProdReference || entry?.Sku || entry?.WebSku || '').trim();
    if (!raw) return '';
    const firstChunk = raw.split('-')[0];
    const numeric = (firstChunk.match(/\d+/) || [])[0];
    return numeric || firstChunk;
}

function parseWebdavImageNames(xml) {
    return [...String(xml || '').matchAll(/<d:href>([^<]+)<\/d:href>/gi)]
        .map((m) => decodeURIComponent(m[1] || ''))
        .map((href) => href.split('/').pop() || '')
        .filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
}

async function listSpotCloudImagesByRefs(refCandidates, { timeoutMs = 14000 } = {}) {
    const startedAt = Date.now();
    const refs = [...new Set([].concat(refCandidates || []).map(normalizeRefToken).filter(Boolean))].slice(0, 4);
    if (!refs.length) return [];

    const cacheKey = refs.join('|');
    const cached = getCacheValue(productImagesListCache, cacheKey);
    if (cached) {
        logSpotPerf('image-list cache-hit', startedAt, `refs=${refs.length}`);
        return cached;
    }

    const shares = parseSpotCloudShareUrl();
    if (!shares.length) return [];

    const deadlineAt = Date.now() + timeoutMs;
    const isDeadlineExceeded = () => Date.now() > deadlineAt;
    const foundByName = new Map();

    const getShareBasePaths = async (share, authHeader) => {
        if (spotCloudShareRootsCache.has(share.token)) {
            const roots = spotCloudShareRootsCache.get(share.token);
            const matched = SPOT_CLOUD_IMAGES_BASE_PATHS.filter((basePath) => {
                const root = basePath.replace(/^\/+/, '').split('/')[0];
                return roots.has(root);
            });
            return matched.length ? matched : SPOT_CLOUD_IMAGES_BASE_PATHS;
        }

        const webdavRootUrl = `${share.origin}${SPOT_CLOUD_WEBDAV_BASE.replace(/\/+$/, '')}/`;
        try {
            const rootResponse = await fetchWithRetry(webdavRootUrl, {
                method: 'PROPFIND',
                headers: {
                    Authorization: authHeader,
                    Depth: '1'
                }
            }, { timeoutMs: 3000, retries: 0 });

            if (rootResponse.status !== 207) {
                return SPOT_CLOUD_IMAGES_BASE_PATHS;
            }

            const xml = await rootResponse.text();
            const hrefs = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/gi)]
                .map((m) => decodeURIComponent(m[1] || ''));
            const prefix = `${SPOT_CLOUD_WEBDAV_BASE.replace(/\/+$/, '')}/`;
            const roots = new Set(
                hrefs
                    .filter((href) => href.startsWith(prefix) && href !== prefix)
                    .map((href) => href.slice(prefix.length))
                    .map((href) => href.split('/')[0])
                    .filter(Boolean)
            );

            spotCloudShareRootsCache.set(share.token, roots);

            const matched = SPOT_CLOUD_IMAGES_BASE_PATHS.filter((basePath) => {
                const root = basePath.replace(/^\/+/, '').split('/')[0];
                return roots.has(root);
            });

            return matched.length ? matched : SPOT_CLOUD_IMAGES_BASE_PATHS;
        } catch {
            return SPOT_CLOUD_IMAGES_BASE_PATHS;
        }
    };

    const shareContexts = await Promise.all(shares.map(async (share) => {
        const authHeader = 'Basic ' + Buffer.from(`${share.token}:${share.password || SPOT_CLOUD_PASSWORD}`).toString('base64');
        return { share, authHeader, basePaths: await getShareBasePaths(share, authHeader) };
    }));
    const folders = shareContexts.flatMap(({ share, authHeader, basePaths }) => refs.flatMap((ref) => basePaths.map((basePathRaw) => ({
        share,
        authHeader,
        ref,
        folderPath: `${SPOT_CLOUD_WEBDAV_BASE}${basePathRaw.replace(/\/+$/, '')}/${ref}`
    }))));

    const loadFolder = async ({ share, authHeader, ref, folderPath }) => {
        if (isDeadlineExceeded()) return;

        const folderCacheKey = `${share.origin}${folderPath}`;
        let folderFiles = spotCloudFolderCache.get(folderCacheKey);
        if (!folderFiles) {
            const folderUrl = `${share.origin}${encodeURI(folderPath.replace(/\/+$/, '') + '/')}`;
            try {
                const response = await fetchWithRetry(folderUrl, {
                    method: 'PROPFIND',
                    headers: {
                        Authorization: authHeader,
                        Depth: '1'
                    }
                }, { timeoutMs: 3000, retries: 0 });
                folderFiles = response.status === 207
                    ? [...new Set(parseWebdavImageNames(await response.text()))]
                    : [];
            } catch {
                folderFiles = [];
            }
            spotCloudFolderCache.set(folderCacheKey, folderFiles);
        }

        for (const fileName of folderFiles) {
            const normalizedName = String(fileName || '').trim().toLowerCase();
            if (normalizedName && !foundByName.has(normalizedName)) {
                foundByName.set(normalizedName, { file: fileName, ref });
            }
        }
    };

    const workerCount = Math.min(4, folders.length);
    let nextFolderIndex = 0;
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (!isDeadlineExceeded()) {
            const folder = folders[nextFolderIndex++];
            if (!folder) return;
            await loadFolder(folder);
        }
    }));

    const result = [...foundByName.values()]
        .sort((a, b) => String(a.file).localeCompare(String(b.file), 'pt-BR', { numeric: true }));
    setCacheValue(productImagesListCache, cacheKey, result, PRODUCT_IMAGES_LIST_TTL_MS);
    logSpotPerf('image-list upstream', startedAt, `refs=${refs.length} folders=${folders.length} images=${result.length}`);
    return result;
}

async function fetchImageFromSpotCloud(fileToken, fallbackRefs = []) {
    const deadlineAt = Date.now() + 20000;
    const isDeadlineExceeded = () => Date.now() > deadlineAt;
    let deadlineReached = false;

    const shares = parseSpotCloudShareUrl();
    if (!shares.length) return null;

    const cleanToken = String(fileToken || '').trim().replace(/^\/+/, '');
    if (!cleanToken) return null;

    const fileName = cleanToken.split('/').pop().replace(/[?#].*$/, '');
    const productRef = extractRefFromImageToken(fileName);
    const refCandidates = [...new Set([
        productRef,
        ...[].concat(fallbackRefs || []).map((value) => String(value || '').match(/\d+/)?.[0] || '').filter(Boolean)
    ].filter(Boolean))].slice(0, 3);
    if (!refCandidates.length) return null;

    const cacheKey = `${fileName}|${refCandidates.join(',')}`;
    const cachedMiss = getCacheValue(spotCloudMissCache, cacheKey);
    if (cachedMiss) {
        return null;
    }

    const cachedResolved = getCacheValue(spotCloudResolvedCache, cacheKey);
    if (cachedResolved) {
        try {
            const fastResponse = await fetchWithRetry(cachedResolved.downloadUrl, {
                method: 'GET',
                headers: {
                    Authorization: cachedResolved.authHeader
                }
            }, { timeoutMs: 5000, retries: 0 });

            const fastContentType = fastResponse.headers.get('content-type') || '';
            if (fastResponse.ok && fastContentType.startsWith('image/')) {
                const fastBuffer = Buffer.from(await fastResponse.arrayBuffer());
                return { buffer: fastBuffer, contentType: fastContentType };
            }

            spotCloudResolvedCache.delete(cacheKey);
        } catch {
            spotCloudResolvedCache.delete(cacheKey);
        }
    }

    const listFolderFiles = async (origin, authHeader, folderPath) => {
        if (isDeadlineExceeded()) {
            deadlineReached = true;
            return [];
        }

        const cacheKey = `${origin}${folderPath}`;
        if (spotCloudFolderCache.has(cacheKey)) {
            return spotCloudFolderCache.get(cacheKey);
        }

        const folderUrl = `${origin}${encodeURI(folderPath.replace(/\/+$/, '') + '/')}`;
        let response;
        try {
            response = await fetchWithRetry(folderUrl, {
                method: 'PROPFIND',
                headers: {
                    Authorization: authHeader,
                    Depth: '1'
                }
            }, { timeoutMs: 4500, retries: 0 });
        } catch {
            spotCloudFolderCache.set(cacheKey, []);
            return [];
        }

        if (response.status !== 207) {
            spotCloudFolderCache.set(cacheKey, []);
            return [];
        }

        const xml = await response.text();
        const matches = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/gi)]
            .map((m) => decodeURIComponent(m[1] || ''))
            .map((href) => href.split('/').pop() || '')
            .filter((name) => /\.(png|jpe?g|webp)$/i.test(name));

        const unique = [...new Set(matches)];
        spotCloudFolderCache.set(cacheKey, unique);
        return unique;
    };

    for (const share of shares) {
        if (isDeadlineExceeded()) {
            deadlineReached = true;
            return null;
        }

        const authHeader = 'Basic ' + Buffer.from(`${share.token}:${share.password || SPOT_CLOUD_PASSWORD}`).toString('base64');

        const getShareBasePaths = async () => {
            if (spotCloudShareRootsCache.has(share.token)) {
                const roots = spotCloudShareRootsCache.get(share.token);
                const matched = SPOT_CLOUD_IMAGES_BASE_PATHS.filter((basePath) => {
                    const root = basePath.replace(/^\/+/, '').split('/')[0];
                    return roots.has(root);
                });
                return matched.length ? matched : SPOT_CLOUD_IMAGES_BASE_PATHS;
            }

            const webdavRootUrl = `${share.origin}${SPOT_CLOUD_WEBDAV_BASE.replace(/\/+$/, '')}/`;
            try {
                const rootResponse = await fetchWithRetry(webdavRootUrl, {
                    method: 'PROPFIND',
                    headers: {
                        Authorization: authHeader,
                        Depth: '1'
                    }
                }, { timeoutMs: 3500, retries: 0 });

                if (rootResponse.status !== 207) {
                    return SPOT_CLOUD_IMAGES_BASE_PATHS;
                }

                const xml = await rootResponse.text();
                const hrefs = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/gi)]
                    .map((m) => decodeURIComponent(m[1] || ''));
                const prefix = `${SPOT_CLOUD_WEBDAV_BASE.replace(/\/+$/, '')}/`;
                const roots = new Set(
                    hrefs
                        .filter((href) => href.startsWith(prefix) && href !== prefix)
                        .map((href) => href.slice(prefix.length))
                        .map((href) => href.split('/')[0])
                        .filter(Boolean)
                );

                spotCloudShareRootsCache.set(share.token, roots);

                const matched = SPOT_CLOUD_IMAGES_BASE_PATHS.filter((basePath) => {
                    const root = basePath.replace(/^\/+/, '').split('/')[0];
                    return roots.has(root);
                });

                return matched.length ? matched : SPOT_CLOUD_IMAGES_BASE_PATHS;
            } catch {
                return SPOT_CLOUD_IMAGES_BASE_PATHS;
            }
        };

        const shareBasePaths = await getShareBasePaths();

        for (const candidateRef of refCandidates) {
            if (isDeadlineExceeded()) {
                deadlineReached = true;
                return null;
            }

            for (const basePathRaw of shareBasePaths) {
                if (isDeadlineExceeded()) {
                    deadlineReached = true;
                    return null;
                }

                const basePath = basePathRaw.replace(/\/+$/, '');
                const folderPath = `${SPOT_CLOUD_WEBDAV_BASE}${basePath}/${candidateRef}`;

                // Fast path: many Spot files already match the exact filename from API.
                const directDownloadUrl = `${share.origin}${encodeURI(`${folderPath}/${fileName}`)}`;
                try {
                    const directResponse = await fetchWithRetry(directDownloadUrl, {
                        method: 'GET',
                        headers: {
                            Authorization: authHeader
                        }
                    }, { timeoutMs: 2500, retries: 0 });

                    const directContentType = directResponse.headers.get('content-type') || '';
                    if (directResponse.ok && directContentType.startsWith('image/')) {
                        const directBuffer = Buffer.from(await directResponse.arrayBuffer());
                        setCacheValue(spotCloudResolvedCache, cacheKey, {
                            downloadUrl: directDownloadUrl,
                            authHeader
                        }, SPOT_CACHE_SUCCESS_TTL_MS);
                        return { buffer: directBuffer, contentType: directContentType };
                    }
                } catch {
                    // Fallback to folder listing strategy.
                }

                const folderFiles = await listFolderFiles(share.origin, authHeader, folderPath);
                if (!folderFiles.length) {
                    continue;
                }

                const stem = fileName.replace(/\.[^.]+$/, '').toLowerCase();
                const preferred = folderFiles.find((name) => name.toLowerCase() === fileName.toLowerCase())
                    || folderFiles.find((name) => name.toLowerCase().startsWith(stem))
                    || folderFiles.find((name) => name.toLowerCase().startsWith(`${candidateRef}_`))
                    || folderFiles[0];

                if (!preferred) {
                    continue;
                }

                const downloadUrl = `${share.origin}${encodeURI(`${folderPath}/${preferred}`)}`;
                let response;
                try {
                    response = await fetchWithRetry(downloadUrl, {
                        method: 'GET',
                        headers: {
                            Authorization: authHeader
                        }
                    }, { timeoutMs: 6000, retries: 0 });
                } catch {
                    continue;
                }

                if (!response.ok || !(response.headers.get('content-type') || '').startsWith('image/')) {
                    continue;
                }

                const contentType = response.headers.get('content-type') || '';
                const buffer = Buffer.from(await response.arrayBuffer());
                setCacheValue(spotCloudResolvedCache, cacheKey, {
                    downloadUrl,
                    authHeader
                }, SPOT_CACHE_SUCCESS_TTL_MS);
                return { buffer, contentType };
            }
        }
    }

    if (!deadlineReached) {
        setCacheValue(spotCloudMissCache, cacheKey, true, SPOT_CACHE_MISS_TTL_MS);
    }

    return null;
}

function buildPlaceholderSvg(label) {
    const safeLabel = String(label || 'Imagem').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#f3f4f6" />
  <rect x="40" y="40" width="520" height="320" rx="24" fill="#ffffff" stroke="#d1d5db" stroke-width="2" />
  <circle cx="300" cy="180" r="92" fill="#e5e7eb" />
  <path d="M220 260c20-48 60-72 80-72s60 24 80 72" fill="#d1d5db" />
  <text x="300" y="332" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#374151">${safeLabel}</text>
</svg>`;
}

function findLocalImageFile(index, token) {
    const raw = String(token || '').trim();
    if (!raw) return null;

    const clean = raw.split(/[\\/]/).pop().replace(/[?#].*$/, '');
    const baseName = clean.replace(/\.[^.]+$/, '');
    const candidates = [
        clean,
        clean.toLowerCase(),
        baseName,
        baseName.toLowerCase(),
        `${baseName}.png`,
        `${baseName}.jpg`,
        `${baseName}.jpeg`,
        `${baseName}.webp`
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const exact = index.exact.get(candidate.toLowerCase());
        if (exact) return exact;
    }

    const digits = (raw.match(/\d+/g) || []).map(String);
    const codeCandidates = [
        raw,
        raw.replace(/\D+/g, ''),
        digits[0] || '',
        digits.join('') || '',
        digits.slice(0, 2).join('') || ''
    ].filter(Boolean);

    for (const codeCandidate of codeCandidates) {
        if (index.refs.has(codeCandidate)) {
            return index.refs.get(codeCandidate);
        }
    }

    for (const codeCandidate of codeCandidates) {
        const prefixMatch = Array.from(index.refs.entries()).find(([ref]) => ref.startsWith(codeCandidate));
        if (prefixMatch) {
            return prefixMatch[1];
        }
    }

    return null;
}

async function getLocalImageIndex() {
    if (localImageIndexPromise) {
        return localImageIndexPromise;
    }

    localImageIndexPromise = fs.promises.readdir(LOCAL_PRODUCTS_IMAGE_DIR)
        .then((files) => {
            const imageFiles = files
                .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
                .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

            const exact = new Map();
            const refs = new Map();
            for (const file of imageFiles) {
                const lower = file.toLowerCase();
                exact.set(lower, file);

                const match = String(file).match(/^(\d+)_/);
                if (!match) continue;
                const ref = match[1];
                if (!refs.has(ref)) {
                    refs.set(ref, file);
                }
            }

            return { exact, refs };
        })
        .catch(() => ({ exact: new Map(), refs: new Map() }));

    return localImageIndexPromise;
}

function createApp() {
    const app = express();
    const ORDER_ADMIN_KEY = String(process.env.ORDER_ADMIN_KEY || '').trim();
    const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const sanitizeQuery = (query) => {
        const q = { ...(query || {}) };
        delete q.token;
        delete q.lang;
        return q;
    };

    const requireOrderAdmin = (req, res, next) => {
        if (!ORDER_ADMIN_KEY) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (req.get('X-Order-Admin-Key') !== ORDER_ADMIN_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        next();
    };

    app.use(express.json({ limit: '10mb' }));
    app.use((req, res, next) => {
        const origin = req.get('Origin');
        if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Vary', 'Origin');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Accept-Language, SessionToken, X-Order-Admin-Key');
            res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        }
        res.header('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    const SPOT_BASE = process.env.SPOT_BASE || 'https://ws.spotgifts.com.br/api/v1SSL/';

    if (!ACCESS_KEY) {
        console.warn('Warning: ACCESS_KEY not set in environment. Add to .env');
    }

    const client = new SpotClient({ baseUrl: SPOT_BASE, accessKey: ACCESS_KEY });
    const getProductsPayload = async (lang = 'PT', query = {}) => {
        const cacheKey = buildCatalogCacheKey(lang, query);
        if (productsInFlight.has(cacheKey)) {
            return productsInFlight.get(cacheKey);
        }

        const request = (async () => {
            const firstPayload = await client.request('products', {
                method: 'GET',
                params: query,
                language: lang,
                timeoutMs: Number(process.env.SPOT_PRODUCTS_TIMEOUT_MS) || 45000,
                retries: Number(process.env.SPOT_PRODUCTS_RETRIES) || 2
            });
            if (Number(firstPayload?.ErrorCode) !== 16) {
                return firstPayload;
            }

            await new Promise((resolve) => setTimeout(resolve, 1500));
            return client.request('products', {
                method: 'GET',
                params: query,
                language: lang,
                timeoutMs: Number(process.env.SPOT_PRODUCTS_TIMEOUT_MS) || 45000,
                retries: Number(process.env.SPOT_PRODUCTS_RETRIES) || 2
            });
        })()
            .finally(() => productsInFlight.delete(cacheKey));
        productsInFlight.set(cacheKey, request);
        return request;
    };
    const getStocksPayload = async (lang = 'PT') => {
        const startedAt = Date.now();
        const cacheKey = String(lang || 'PT').toUpperCase();
        const cached = getCacheValue(stocksByLangCache, cacheKey);
        if (cached) {
            logSpotPerf('stocks cache-hit', startedAt, `lang=${cacheKey}`);
            return cached;
        }

        if (stocksInFlight.has(cacheKey)) {
            const payload = await stocksInFlight.get(cacheKey);
            logSpotPerf('stocks coalesced', startedAt, `lang=${cacheKey}`);
            return payload;
        }

        const request = client.request('stocks', { method: 'GET', language: cacheKey })
            .then((payload) => {
                setCacheValue(stocksByLangCache, cacheKey, payload, STOCKS_CACHE_TTL_MS);
                return payload;
            })
            .finally(() => stocksInFlight.delete(cacheKey));
        stocksInFlight.set(cacheKey, request);

        const payload = await request;
        logSpotPerf('stocks upstream', startedAt, `lang=${cacheKey}`);
        return payload;
    };
    const warmImagesForProducts = async (products) => {
        if (!Array.isArray(products) || !products.length) return;

        const extractRef = (entry) => {
            const raw = String(entry?.ProdReference || entry?.ProductReference || entry?.Reference || entry?.InternalReference || entry?.Code || '').trim();
            if (!raw) return '';
            return (raw.match(/\d+/) || [])[0] || raw;
        };

        const queue = products
            .slice(0, 10)
            .map((product) => {
                const raw = String(product?.MainImage || product?.Image || product?.Photo || product?.ImageURL || '').trim();
                if (!raw) return null;
                const safeFile = raw.replace(/^\/+/, '').split('/').pop();
                if (!safeFile) return null;
                const ref = extractRef(product);
                const related = String(product?.RelatedReferences || '').trim();
                const fallbackRefs = [ref, ...related.split(',').map((v) => v.trim()).filter(Boolean)].filter(Boolean);
                const imageCacheKey = `${safeFile}|${fallbackRefs.join(',')}`;
                return { safeFile, fallbackRefs, imageCacheKey };
            })
            .filter(Boolean);

        const maxConcurrency = 2;
        const workers = Array.from({ length: maxConcurrency }, async () => {
            while (queue.length) {
                const next = queue.shift();
                if (!next) break;

                if (getCacheValue(imageBinaryCache, next.imageCacheKey)) continue;
                if (imageWarmupInFlight.has(next.imageCacheKey)) continue;

                imageWarmupInFlight.add(next.imageCacheKey);
                try {
                    const resolved = await fetchImageFromSpotCloud(next.safeFile, next.fallbackRefs);
                    if (resolved) {
                        setCacheValue(imageBinaryCache, next.imageCacheKey, resolved, IMAGE_BINARY_TTL_MS);
                    }
                } catch {
                    // keep warm-up silent
                } finally {
                    imageWarmupInFlight.delete(next.imageCacheKey);
                }
            }
        });

        await Promise.all(workers);
    };

    const warmProductsCache = async (lang = 'PT') => {
        try {
            const cacheKey = buildCatalogCacheKey(lang, {});
            const data = await getProductsPayload(lang);
            if (isProductsPayloadUsable(data)) {
                setCacheValue(productsApiCache, cacheKey, data, PRODUCTS_API_TTL_MS);
                saveSpotProductsSnapshot(cacheKey, data);
                setTimeout(() => {
                    warmImagesForProducts(data.Products || []);
                }, 10);
            }
        } catch {
            // Keep warm-up silent to avoid noisy logs.
        }
    };

    // Warm cache only while the public Spot catalog is enabled.
    if (SPOT_CATALOG_ENABLED) {
        setTimeout(() => { warmProductsCache('PT'); }, 100);
        setTimeout(() => { getStocksPayload('PT').catch(() => {}); }, 100);
        setInterval(() => { warmProductsCache('PT'); }, 4 * 60 * 1000);
        setInterval(() => { getStocksPayload('PT').catch(() => {}); }, STOCKS_CACHE_TTL_MS);
    }

    const evaluateCapability = (data) => {
        if (typeof data === 'string') {
            return { ok: false, reason: 'Non-JSON response' };
        }

        if (!data || typeof data !== 'object') {
            return { ok: false, reason: 'Empty response' };
        }

        if (typeof data.type === 'string' && data.type.includes('cloudflare')) {
            return { ok: false, reason: 'Upstream Cloudflare error' };
        }

        const errorCode = Number(data.ErrorCode);
        if (Number.isFinite(errorCode) && errorCode > 0) {
            return { ok: false, reason: data.ErrorMessage || `ErrorCode ${errorCode}` };
        }

        if (data.error) {
            return { ok: false, reason: String(data.error) };
        }

        return { ok: true, reason: null };
    };


    // Basic health
    app.get('/api/spot/health', (req, res) => res.json({ ok: true, catalogEnabled: SPOT_CATALOG_ENABLED }));

    app.get('/api/spot/auth', (req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    app.get('/api/catalog/products', (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json({ source: 'local', Products: LOCAL_CATALOG_PRODUCTS_NORMALIZED });
    });

    app.get('/api/catalog/brindes', (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json({ source: 'local', Products: LOCAL_BRINDES_PRODUCTS_NORMALIZED });
    });

    app.get('/api/catalog/products/:code/images', (req, res) => {
        const code = String(req.params.code || '').trim();
        const images = getLocalCatalogImageFiles(code);
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json({ code, images });
    });

    app.get('/api/spot/capabilities', async (req, res) => {
        const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
        const checks = [
            { key: 'products', endpoint: 'products', includeLanguageParam: true },
            { key: 'productsTree', endpoint: 'productsTree', includeLanguageParam: true },
            { key: 'optionals', endpoint: 'optionals', includeLanguageParam: true },
            { key: 'optionalsPrice', endpoint: 'optionalsPrice', includeLanguageParam: true },
            { key: 'optionalsComplete', endpoint: 'optionalsComplete', includeLanguageParam: true },
            { key: 'customizationOptions', endpoint: 'customizationOptions', includeLanguageParam: true },
            { key: 'customizationTables', endpoint: 'customizationTables', includeLanguageParam: true },
            { key: 'stocks', endpoint: 'stocks', includeLanguageParam: true },
            { key: 'colors', endpoint: 'colors', includeLanguageParam: true },
            { key: 'productTypes', endpoint: 'productTypes', includeLanguageParam: true },
            { key: 'catalogPrices', endpoint: 'catalogPrices', includeLanguageParam: false },
            { key: 'canceledProducts', endpoint: 'canceledProducts', includeLanguageParam: false }
        ];

        try {
            const results = await Promise.all(checks.map(async (check) => {
                try {
                    const data = await client.request(check.endpoint, {
                        method: 'GET',
                        language: lang,
                        includeLanguageParam: check.includeLanguageParam
                    });
                    const verdict = evaluateCapability(data);
                    return {
                        key: check.key,
                        endpoint: check.endpoint,
                        ok: verdict.ok,
                        reason: verdict.reason,
                        sample: data && typeof data === 'object' ? Object.keys(data).slice(0, 5) : []
                    };
                } catch (error) {
                    return {
                        key: check.key,
                        endpoint: check.endpoint,
                        ok: false,
                        reason: error.message,
                        sample: []
                    };
                }
            }));

            const okCount = results.filter((item) => item.ok).length;
            return res.json({
                ok: okCount > 0,
                language: lang,
                total: results.length,
                okCount,
                failCount: results.length - okCount,
                results
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/spot/products', async (req, res) => {
        if (!SPOT_CATALOG_ENABLED) {
            return sendSpotCatalogDisabled(res);
        }

        const q = sanitizeQuery(req.query);
        const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
        const cacheKey = buildCatalogCacheKey(lang, q);
        if (!ACCESS_KEY || ACCESS_KEY === 'your_access_key_here') {
            return res.status(503).json({
                error: 'Spot credentials not configured',
                message: 'Configure ACCESS_KEY and SPOT_BASE in the environment to load real products.'
            });
        }

        try {
            const cached = getCacheValue(productsApiCache, cacheKey);
            if (cached) {
                res.setHeader('Cache-Control', 'public, max-age=120');
                return res.json(cached);
            }

            const staleEntry = productsApiCache.get(cacheKey);
            const staleCached = staleEntry && staleEntry.value ? staleEntry.value : null;

            const data = await getProductsPayload(lang, q);
            if (isProductsPayloadUsable(data)) {
                setCacheValue(productsApiCache, cacheKey, data, PRODUCTS_API_TTL_MS);
                setTimeout(() => {
                    warmImagesForProducts(data.Products || []);
                }, 10);
                res.setHeader('Cache-Control', 'public, max-age=120');
                return res.json(data);
            }

            if (staleCached && isProductsPayloadUsable(staleCached)) {
                res.setHeader('Cache-Control', 'public, max-age=60');
                return res.json(staleCached);
            }

            const persistentCached = readSpotProductsSnapshot(cacheKey);
            if (persistentCached) {
                res.setHeader('Cache-Control', 'public, max-age=60');
                res.setHeader('X-Spot-Cache', 'DISK-STALE');
                return res.json(persistentCached);
            }

            const errorCode = Number(data?.ErrorCode);
            const message = data?.ErrorMessage || (Number.isFinite(errorCode) ? `Spot ErrorCode ${errorCode}` : 'Spot returned an empty product catalog');
            return res.status(502).json({ error: message });
        } catch (err) {
            console.error('Spot products error:', err.message);
            const staleEntry = productsApiCache.get(cacheKey);
            const staleCached = staleEntry && staleEntry.value ? staleEntry.value : null;
            if (staleCached && isProductsPayloadUsable(staleCached)) {
                res.setHeader('Cache-Control', 'public, max-age=60');
                return res.json(staleCached);
            }
            const persistentCached = readSpotProductsSnapshot(cacheKey);
            if (persistentCached) {
                res.setHeader('Cache-Control', 'public, max-age=60');
                res.setHeader('X-Spot-Cache', 'DISK-STALE');
                return res.json(persistentCached);
            }
            return res.status(502).json({ error: err.message });
        }
    });

    app.get('/api/spot/catalog-content', async (req, res) => {
        if (!SPOT_CATALOG_ENABLED) {
            return sendSpotCatalogDisabled(res);
        }

        const q = sanitizeQuery(req.query);
        const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
        const includeProducts = String(req.query?.includeProducts || 'true').toLowerCase() !== 'false';
        const defaultSections = includeProducts ? 'stocks,prices,optionals,customization' : 'stocks,prices';
        const requestedSections = new Set(String(req.query?.sections || defaultSections)
            .split(',')
            .map((section) => section.trim().toLowerCase())
            .filter(Boolean));
        delete q.includeProducts;
        delete q.sections;
        const cacheKey = `${buildCatalogCacheKey(lang, q)}|products:${includeProducts}|sections:${[...requestedSections].sort().join(',')}`;

        const toArray = (value) => Array.isArray(value) ? value : [];
        const extractRef = (entry) => {
            const raw = String(entry?.ProdReference || entry?.Sku || entry?.WebSku || '').trim();
            if (!raw) return '';
            const firstChunk = raw.split('-')[0];
            const numeric = (firstChunk.match(/\d+/) || [])[0];
            return numeric || firstChunk;
        };

        try {
            const cached = getCacheValue(catalogContentCache, cacheKey);
            if (cached) {
                res.setHeader('Cache-Control', 'public, max-age=30');
                return res.json(cached);
            }

            const staleEntry = catalogContentCache.get(cacheKey);
            const staleCached = staleEntry && staleEntry.value ? staleEntry.value : null;

            const [
                productsResult,
                stocksResult,
                pricesResult,
                optionalsResult,
                customizationResult
            ] = await Promise.allSettled([
                includeProducts
                    ? client.request('products', { method: 'GET', params: q, language: lang })
                    : Promise.resolve({ Products: [] }),
                requestedSections.has('stocks')
                    ? getStocksPayload(lang)
                    : Promise.resolve({ Stocks: [] }),
                requestedSections.has('prices')
                    ? client.request('catalogPrices', { method: 'GET', params: q, includeLanguageParam: false })
                    : Promise.resolve({ CatalogPrices: [] }),
                requestedSections.has('optionals')
                    ? client.request('optionalsComplete', { method: 'GET', params: q, language: lang })
                    : Promise.resolve({ OptionalsComplete: [] }),
                requestedSections.has('customization')
                    ? client.request('customizationOptions', { method: 'GET', params: q, language: lang })
                    : Promise.resolve({ CustomizationOptions: [] })
            ]);

            const productsPayload = productsResult.status === 'fulfilled' ? productsResult.value : {};
            const stocksPayload = stocksResult.status === 'fulfilled' ? stocksResult.value : {};
            const pricesPayload = pricesResult.status === 'fulfilled' ? pricesResult.value : {};
            const optionalsPayload = optionalsResult.status === 'fulfilled' ? optionalsResult.value : {};
            const customizationPayload = customizationResult.status === 'fulfilled' ? customizationResult.value : {};

            const products = toArray(productsPayload?.Products);
            const stocks = toArray(stocksPayload?.Stocks);
            const catalogPrices = toArray(pricesPayload?.CatalogPrices);
            const optionalsComplete = toArray(optionalsPayload?.OptionalsComplete);
            const customizationOptions = toArray(customizationPayload?.CustomizationOptions);

            const errors = {};
            if (productsResult.status === 'rejected') errors.products = productsResult.reason?.message || 'products failed';
            if (requestedSections.has('stocks') && stocksResult.status === 'rejected') errors.stocks = stocksResult.reason?.message || 'stocks failed';
            if (requestedSections.has('prices') && pricesResult.status === 'rejected') errors.catalogPrices = pricesResult.reason?.message || 'catalogPrices failed';
            if (requestedSections.has('optionals') && optionalsResult.status === 'rejected') errors.optionalsComplete = optionalsResult.reason?.message || 'optionalsComplete failed';
            if (requestedSections.has('customization') && customizationResult.status === 'rejected') errors.customizationOptions = customizationResult.reason?.message || 'customizationOptions failed';

            const refsWithImages = products
                .map((product) => extractRef(product))
                .filter(Boolean)
                .slice(0, 2000);

            const responsePayload = {
                Language: lang,
                Products: products,
                CatalogPrices: catalogPrices,
                OptionalsComplete: optionalsComplete,
                CustomizationOptions: customizationOptions,
                Stocks: stocks,
                ImageResolver: '/api/spot/image/:file',
                RefsWithImages: refsWithImages,
                Summary: {
                    products: products.length,
                    catalogPrices: catalogPrices.length,
                    optionalsComplete: optionalsComplete.length,
                    customizationOptions: customizationOptions.length,
                    stocks: stocks.length,
                    hasErrors: Object.keys(errors).length > 0
                },
                Errors: errors
            };

            const productsFailed = Boolean(errors.products);
            const hasProducts = products.length > 0;

            if (hasProducts || !productsFailed) {
                setCacheValue(catalogContentCache, cacheKey, responsePayload, CATALOG_CONTENT_TTL_MS);
            } else if (staleCached && Array.isArray(staleCached.Products) && staleCached.Products.length > 0) {
                res.setHeader('Cache-Control', 'public, max-age=30');
                return res.json({
                    ...staleCached,
                    Errors: {
                        ...(staleCached.Errors || {}),
                        stale: 'Serving stale catalog cache due to upstream products failure',
                        products: errors.products
                    },
                    Summary: {
                        ...(staleCached.Summary || {}),
                        isStaleCache: true
                    }
                });
            }

            res.setHeader('Cache-Control', 'public, max-age=30');
            return res.json(responsePayload);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/spot/products-tree', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('productsTree', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/spot/image/:file', async (req, res) => {
        const file = String(req.params.file || '').trim();
        if (!file) {
            return res.status(400).json({ error: 'Missing image filename' });
        }

        const safeFile = file.replace(/^\/+/, '');
        const refQuery = String(req.query.ref || '').trim();
        const relatedQuery = String(req.query.related || '').trim();
        const relatedRefs = relatedQuery
            ? relatedQuery.split(',').map((value) => value.trim()).filter(Boolean)
            : [];
        const fallbackRefs = [refQuery, ...relatedRefs].filter(Boolean);
        const imageCacheKey = `${safeFile}|${fallbackRefs.join(',')}`;

        const cachedImage = getCacheValue(imageBinaryCache, imageCacheKey);
        if (cachedImage) {
            res.setHeader('Content-Type', cachedImage.contentType);
            res.setHeader('Cache-Control', 'public, max-age=1800');
            res.setHeader('X-Image-Cache', 'HIT');
            return res.send(cachedImage.buffer);
        }

        if (imageInFlight.has(imageCacheKey)) {
            try {
                const shared = await imageInFlight.get(imageCacheKey);
                if (shared) {
                    res.setHeader('Content-Type', shared.contentType);
                    res.setHeader('Cache-Control', 'public, max-age=1800');
                    res.setHeader('X-Image-Cache', 'COALESCE');
                    return res.send(shared.buffer);
                }
            } catch {
                // continue normal flow
            }
        }

        const resolveImagePromise = (async () => {
            try {
                const cloudImage = await fetchImageFromSpotCloud(safeFile, fallbackRefs);
                if (cloudImage) {
                    setCacheValue(imageBinaryCache, imageCacheKey, cloudImage, IMAGE_BINARY_TTL_MS);
                    return cloudImage;
                }
            } catch {
                // Continue with fallback Spot hosts
            }

            const customBase = process.env.SPOT_IMAGE_BASE ? process.env.SPOT_IMAGE_BASE.replace(/\/+$/, '') + '/' : null;
            const candidates = [
                customBase,
                'https://www.spotgifts.com/images/',
                'https://www.spotgifts.com/media/catalog/product/',
                'https://www.spotgifts.com.br/images/',
                'https://www.spotgifts.com.br/media/catalog/product/',
                'https://ws.spotgifts.com.br/images/'
            ].filter(Boolean);

            for (const base of candidates) {
                const url = base + safeFile;
                try {
                    const upstream = await fetch(url, { method: 'GET' });
                    const contentType = upstream.headers.get('content-type') || '';
                    if (!upstream.ok || !contentType.startsWith('image/')) {
                        continue;
                    }

                    const buffer = Buffer.from(await upstream.arrayBuffer());
                    const payload = { buffer, contentType };
                    setCacheValue(imageBinaryCache, imageCacheKey, payload, IMAGE_BINARY_TTL_MS);
                    return payload;
                } catch {
                    // keep trying next candidate
                }
            }

            return null;
        })();

        imageInFlight.set(imageCacheKey, resolveImagePromise);
        try {
            const resolved = await resolveImagePromise;
            if (resolved) {
                res.setHeader('Content-Type', resolved.contentType);
                res.setHeader('Cache-Control', 'public, max-age=1800');
                res.setHeader('X-Image-Cache', 'MISS');
                return res.send(resolved.buffer);
            }
        } finally {
            imageInFlight.delete(imageCacheKey);
        }

        return res.status(404).json({ error: 'Spot image not found', file: safeFile });
    });

    app.get('/api/spot/product-images/:ref', async (req, res) => {
        const startedAt = Date.now();
        const mainRef = normalizeRefToken(req.params.ref);
        const mainFile = String(req.query.main || '').trim().split('/').pop().replace(/[?#].*$/, '');
        const refs = [mainRef].filter(Boolean);

        if (!refs.length) {
            return res.status(400).json({ error: 'Missing product reference' });
        }

        try {
            const listed = await listSpotCloudImagesByRefs(refs, { timeoutMs: 14000 });
            const files = [];
            const seen = new Set();

            if (mainFile) {
                const key = mainFile.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    files.push(mainFile);
                }
            }

            for (const entry of listed) {
                const file = String(entry?.file || '').trim();
                if (!file) continue;
                const key = file.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                files.push(file);
            }

            const images = files.map((file) => {
                const qs = new URLSearchParams();
                qs.set('ref', refs[0]);

                return {
                    file,
                    url: `/api/spot/image/${encodeURIComponent(file)}?${qs.toString()}`
                };
            });

            res.setHeader('Cache-Control', 'public, max-age=600');
            logSpotPerf('product-images response', startedAt, `ref=${mainRef} images=${images.length}`);
            return res.json({
                ref: refs[0],
                refs,
                count: images.length,
                images
            });
        } catch (error) {
            logSpotPerf('product-images error', startedAt, `ref=${mainRef} error=${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/spot/local-image/:prodRef', async (req, res) => {
        const rawRef = String(req.params.prodRef || '').trim();

        if (!rawRef) {
            return res.status(400).json({ error: 'Missing product reference' });
        }

        try {
            const index = await getLocalImageIndex();
            const file = findLocalImageFile(index, rawRef);

            if (!file) {
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.type('image/svg+xml');
                return res.send(buildPlaceholderSvg(rawRef));
            }

            const fullPath = path.join(LOCAL_PRODUCTS_IMAGE_DIR, file);
            if (!fullPath.startsWith(LOCAL_PRODUCTS_IMAGE_DIR)) {
                return res.status(400).json({ error: 'Invalid image path' });
            }

            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.sendFile(fullPath);
        } catch (err) {
            console.error('Local image error:', err.message);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.type('image/svg+xml');
            return res.send(buildPlaceholderSvg(rawRef));
        }
    });

    app.get('/api/spot/optionals', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('optionals', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/optionals-price', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('optionalsPrice', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/optionals-complete', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('optionalsComplete', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/customization-options', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('customizationOptions', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/customization-tables', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('customizationTables', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/stocks', async (req, res) => {
        try {
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await getStocksPayload(lang);
            res.setHeader('Cache-Control', 'public, max-age=30');
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/stock/:ref', async (req, res) => {
        try {
            const ref = normalizeRefToken(req.params.ref);
            if (!ref) {
                return res.status(400).json({ error: 'Missing product reference' });
            }

            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const payload = await getStocksPayload(lang);
            const list = Array.isArray(payload?.Stocks) ? payload.Stocks : [];

            const quantity = list
                .filter((entry) => getStockRefFromEntry(entry) === ref)
                .reduce((sum, entry) => {
                    const value = Number(entry?.Quantity);
                    return Number.isFinite(value) ? sum + value : sum;
                }, 0);

            res.setHeader('Cache-Control', 'public, max-age=30');
            return res.json({
                ref,
                quantity,
                found: list.some((entry) => getStockRefFromEntry(entry) === ref),
                source: 'stocks'
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/spot/colors', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('colors', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/product-types', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const lang = String((req.query && req.query.lang) || 'PT').toUpperCase();
            const data = await client.request('productTypes', { method: 'GET', params: q, language: lang });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/catalog-prices', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const data = await client.request('catalogPrices', { method: 'GET', params: q, includeLanguageParam: false });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/canceled-products', async (req, res) => {
        try {
            const q = sanitizeQuery(req.query);
            const data = await client.request('canceledProducts', { method: 'GET', params: q, includeLanguageParam: false });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/spot/orders', requireOrderAdmin, async (req, res) => {
        try {
            const body = req.body;
            const data = await client.request('Orders', { method: 'POST', body });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/api/spot/orders/:stamp', requireOrderAdmin, async (req, res) => {
        try {
            const stamp = req.params.stamp;
            const data = await client.request('OrderStatus', { method: 'GET', params: { OrderStamp: stamp } });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.post('/api/spot/orders/:stamp/cancel', requireOrderAdmin, async (req, res) => {
        try {
            const stamp = req.params.stamp;
            const reason = req.body.Reason || req.body.reason || 'Cancel requested by client';
            const data = await client.request('CancelOrder', { method: 'POST', body: { OrderStamp: stamp, Reason: reason } });
            res.json(data);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    app.get('/downloads/catalogo-completo', (req, res) => {
        res.download(path.join(CATALOG_DOWNLOAD_DIR, COMPLETE_CATALOG_FILE), 'Catalogo-Brucs-2026.pdf');
    });

    app.get('/downloads/catalogo-kits', (req, res) => {
        res.download(path.join(CATALOG_DOWNLOAD_DIR, KITS_CATALOG_FILE), 'Catalogo-Brucs-Kits.pdf');
    });

    app.get('/downloads/catalogo-brindes', (req, res) => {
        res.download(BRINDES_CATALOG_FILE, 'Catalogo-BRUCS-2026-27.pdf');
    });

    // Serve static site optionally
    app.use('/', express.static(path.join(__dirname, '..')));

    return app;
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3001;

function listenOnPort(port) {
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`Spot proxy running on http://localhost:${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < 8100) {
            console.warn(`Port ${port} is busy, trying ${port + 1}...`);
            server.close(() => listenOnPort(port + 1));
            return;
        }
        throw err;
    });
}

if (require.main === module) {
    listenOnPort(PORT);
}

module.exports = { app, createApp };
