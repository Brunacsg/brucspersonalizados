const productsGrid = document.getElementById('productsGrid');
const productsStatus = document.getElementById('productsStatus');
const refreshButton = document.getElementById('refreshProducts');
const catalogFallbackImage = 'assets/images/kits-corporativos.jpeg';

async function fetchProducts() {
    productsStatus.textContent = 'Carregando catálogo...';
    productsGrid.innerHTML = '';
    try {
        const response = await fetch('data/local-products.json');
        if (!response.ok) {
            throw new Error(`Erro ao buscar produtos: ${response.status}`);
        }
        const data = await response.json();
        renderProducts(data);
        productsStatus.textContent = `Produtos carregados: ${Array.isArray(data) ? data.length : 'sem registros'}`;
    } catch (error) {
        productsStatus.textContent = `Falha ao carregar catálogo: ${error.message}`;
    }
}

function renderProducts(data) {
    let products = data;

    // Caso a API responda com objeto contendo lista em diferentes formatos
    if (!Array.isArray(products) && products) {
        products = products.Products || products.Data || products.List || products.Items || products.products || products.data || products.items || products.Products?.Product || products.Products?.Items;
    }

    if (!Array.isArray(products) && products && Array.isArray(products.Products?.Product)) {
        products = products.Products.Product;
    }

    if (!Array.isArray(products) || products.length === 0) {
        productsGrid.innerHTML = '<p class="section-description">Nenhum produto encontrado.</p>';
        return;
    }

    const normalizeArray = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') return value.split(/\s*,\s*/).filter(Boolean);
        return [value];
    };

    productsGrid.innerHTML = products.map(product => {
        const code = product.InternalReference || product.ProductCode || product.Code || product.codigo || product.ID || product.id || '---';
        const name = product.Name || product.Title || product.ProductName || product.nome || product.Description || 'Produto sem nome';
        const category = product.ProductTypeName || product.Category || product.ProductType || 'Categoria não informada';
        const image = product.MainImage || product.Image || product.Photo || product.ImageURL || catalogFallbackImage;
        const price = product.Price || product.UnitPrice || product.SalePrice || product.Preco || product.preco || '';
        const description = product.Description || product.ProductDescription || product.ShortDescription || product.Text || '';
        const capacity = product.Capacity || product.Volume || product.Size || product.Tamanho || '';
        const colors = normalizeArray(product.Colors || product.Color || product.ProductColors || product.Cores);
        const sizes = normalizeArray(product.Sizes || product.Size || product.Tamanhos || product.ProductSizes);
        const personalizations = normalizeArray(product.CustomizationAreas || product.Personalization || product.Optionals || product.Opcoes);

        const badges = [];
        if (capacity) badges.push(`Capacidade: ${capacity}`);
        if (colors.length) badges.push(`Cores: ${colors.join(', ')}`);
        if (sizes.length) badges.push(`Tamanhos: ${sizes.join(', ')}`);
        if (personalizations.length) badges.push(`Personalização: ${personalizations.join(', ')}`);

        const badgeHtml = badges.length ? `<div class="product-badges">${badges.map(b => `<span>${b}</span>`).join('')}</div>` : '';

        return `
            <article class="product-card">
                <div class="product-card-image">
                    <img src="${image}" alt="${name}">
                </div>
                <div class="product-card-body">
                    <h3>${name}</h3>
                    <p class="product-meta">Código: ${code}</p>
                    <p class="product-meta">Categoria: ${category}</p>
                    ${description ? `<p class="product-description">${description}</p>` : ''}
                    ${badgeHtml}
                    ${price ? `<p class="product-price">Preço: ${price}</p>` : ''}
                    <a class="add-quote-btn" href="produto.html?code=${encodeURIComponent(code)}">Ver detalhes</a>
                </div>
            </article>
        `;
    }).join('');
}

refreshButton.addEventListener('click', fetchProducts);
fetchProducts();
