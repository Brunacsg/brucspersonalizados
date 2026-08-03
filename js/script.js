/* ================================
   FUNCIONALIDADES JAVASCRIPT
   ================================ */

// Menu Hamburguer
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const quoteCartStorageKey = 'catalogQuoteCartV1';

function updateQuoteCartNavigation() {
    let totalItems = 0;

    try {
        const items = JSON.parse(localStorage.getItem(quoteCartStorageKey) || '[]');
        totalItems = Array.isArray(items)
            ? items.reduce((sum, item) => sum + Math.max(0, Number(item?.qty) || 0), 0)
            : 0;
    } catch {
        totalItems = 0;
    }

    document.querySelectorAll('[data-quote-cart-nav]').forEach((item) => {
        item.hidden = totalItems <= 0;
    });

    document.querySelectorAll('[data-quote-cart-link]').forEach((link) => {
        const label = totalItems === 1
            ? 'Visualizar orçamento (1 item)'
            : `Visualizar orçamento (${totalItems} itens)`;
        link.textContent = label;
        link.setAttribute('aria-label', label);
    });
}

updateQuoteCartNavigation();
window.addEventListener('quote-cart-changed', updateQuoteCartNavigation);
window.addEventListener('storage', (event) => {
    if (event.key === quoteCartStorageKey) updateQuoteCartNavigation();
});

document.querySelectorAll('[data-quote-cart-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
        if (!document.getElementById('quoteCartPanel')) return;
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('open-quote-cart'));
    });
});

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        const menuOpen = navMenu.classList.toggle('show');
        hamburger.classList.toggle('active', menuOpen);
        hamburger.setAttribute('aria-expanded', menuOpen);
        
        // Animar hamburguer
        const spans = hamburger.querySelectorAll('span');
        spans.forEach((span, index) => {
            if (menuOpen) {
                if (index === 0) span.style.transform = 'rotate(45deg) translate(10px, 10px)';
                if (index === 1) span.style.opacity = '0';
                if (index === 2) span.style.transform = 'rotate(-45deg) translate(7px, -7px)';
            } else {
                span.style.transform = 'none';
                span.style.opacity = '1';
            }
        });
    });

    // keyboard support (Enter / Space)
    hamburger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            hamburger.click();
        }
    });
}

// Fechar menu ao clicar em um link
const navLinks = document.querySelectorAll('.nav-menu a');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu) {
            navMenu.classList.remove('show');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            const spans = hamburger.querySelectorAll('span');
            spans.forEach(span => {
                span.style.transform = 'none';
                span.style.opacity = '1';
            });
        }
    });
});

// Função para abrir WhatsApp
function abrirWhatsApp() {
    const numero = '5511930226736'; // Número atualizado da empresa
    const mensagem = 'Olá! Gostaria de solicitar um orçamento para brindes personalizados.';
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// Animar números quando a seção fica visível
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observar cards e elementos
const cards = document.querySelectorAll('.card-diferencial, .produto-card, .galeria-item');
cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.6s ease';
    observer.observe(card);
});

// Validação de entrada de telefone
const inputTelefone = document.getElementById('telefone');
if (inputTelefone) {
    inputTelefone.addEventListener('input', (e) => {
        let valor = e.target.value.replace(/\D/g, '');
        
        if (valor.length > 0) {
            if (valor.length <= 2) {
                valor = `(${valor}`;
            } else if (valor.length <= 7) {
                valor = `(${valor.slice(0, 2)}) ${valor.slice(2)}`;
            } else {
                valor = `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7, 11)}`;
            }
        }
        
        e.target.value = valor;
    });
}

// Validação de entrada de quantidade
const inputQuantidade = document.getElementById('quantidade');
if (inputQuantidade) {
    inputQuantidade.addEventListener('input', (e) => {
        if (e.target.value < 1 && e.target.value !== '') {
            e.target.value = 1;
        }
    });
}

// Scroll suave para links internos (melhorador)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && document.querySelector(href)) {
            e.preventDefault();
            const target = document.querySelector(href);
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Lazy loading para imagens (quando implementado)
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// Google Analytics ou tracking (personalizar com ID real)
// Comentado por padrão - descomenta quando tiver ID
/*
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'GA_MEASUREMENT_ID');
*/

// Log de console para debug
console.log('Brucs Personalizados - Site Carregado com Sucesso! 🎉');
console.log('Versão: 1.0.0');
console.log('Entre em contato: contato@brucspersonalizados.com.br');
