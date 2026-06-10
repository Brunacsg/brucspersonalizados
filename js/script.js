/* ================================
   FUNCIONALIDADES JAVASCRIPT
   ================================ */

// Menu Hamburguer
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
        hamburger.setAttribute('aria-expanded', navMenu.style.display === 'flex');
        
        // Animar hamburguer
        const spans = hamburger.querySelectorAll('span');
        spans.forEach((span, index) => {
            if (navMenu.style.display === 'flex') {
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
            navMenu.style.display = 'none';
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

// Formulário de Orçamento
const formOrcamento = document.getElementById('formOrcamento');

if (formOrcamento) {
    formOrcamento.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Coletar dados do formulário
        const formData = new FormData(formOrcamento);
        const data = {
            nome: formData.get('nome'),
            empresa: formData.get('empresa'),
            telefone: formData.get('telefone'),
            email: formData.get('email'),
            produto: formData.get('produto'),
            quantidade: formData.get('quantidade'),
            descricao: formData.get('descricao')
        };
        
        // Validar dados
        if (!data.nome || !data.email || !data.telefone) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }
        
        // Enviar para WhatsApp (alternativa: backend)
        enviarParaWhatsApp(data);
        
        // Limpar formulário
        formOrcamento.reset();
    });
}

// Função para enviar dados para WhatsApp
function enviarParaWhatsApp(data) {
    const numero = '5511930226736'; // Número atualizado da empresa
    
    const mensagem = `
*SOLICITAÇÃO DE ORÇAMENTO - BRUCS PERSONALIZADOS*

*Nome:* ${data.nome}
*Empresa:* ${data.empresa}
*Telefone:* ${data.telefone}
*E-mail:* ${data.email}
*Produto:* ${data.produto}
*Quantidade:* ${data.quantidade}

*Descrição do Projeto:*
${data.descricao}

---
Mensagem enviada através do site brucs.com.br
    `.trim();
    
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
    
    // Mostrar mensagem de sucesso
    mostrarMensagemSucesso();
}

// Função para mostrar mensagem de sucesso
function mostrarMensagemSucesso() {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #25d366;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-weight: 600;
        ">
            ✓ Orçamento enviado com sucesso! Você será redirecionado para o WhatsApp.
        </div>
    `;
    
    document.body.appendChild(notificacao);
    
    // Remover notificação após 4 segundos
    setTimeout(() => {
        notificacao.remove();
    }, 4000);
}

// Adicionar estilos de animação
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

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
