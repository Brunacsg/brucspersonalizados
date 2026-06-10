# Brucs Personalizados - Website Profissional

Um website moderno, responsivo e otimizado para SEO, desenvolvido para captar clientes e gerar orçamentos de brindes personalizados.

## 📋 Características

✅ **Design Moderno e Premium**
- Paleta de cores profissional (azul escuro, branco, dourado)
- Interface elegante e moderna
- Totalmente responsivo (mobile-first)

✅ **Seções Completas**
- Hero Section com call-to-action
- Diferenciais da empresa
- Catálogo de 11 categorias de produtos
- Processo "Como Funciona"
- Galeria de exemplos
- Depoimentos de clientes
- Seção Sobre
- Formulário de orçamento
- Footer com informações de contato

✅ **Funcionalidades**
- Menu hamburguer responsivo
- Integração com WhatsApp (botão flutuante e formulário)
- Formulário de orçamento interativo
- Validação de formulário
- Scroll suave
- Animações elegantes
- Lazy loading de imagens

✅ **SEO Otimizado**
- Meta tags descritivas
- Palavras-chave relevantes
- Estrutura semântica HTML5
- Schema markup pronto
- Sitemap XML

## 📁 Estrutura de Arquivos

```
brucs/
├── index.html          # Página principal
├── css/
│   └── style.css       # Estilos globais e responsivos
├── js/
│   └── script.js       # Funcionalidades JavaScript
├── assets/             # Imagens e recursos (pasta vazia, pronto para adicionar)
└── README.md           # Este arquivo
```

## 🚀 Como Usar

### 1. Instalação
Simplesmente abra o arquivo `index.html` em um navegador web. Não há dependências externas.

### 2. Personalizações Necessárias

#### WhatsApp
Edite o número do WhatsApp em dois lugares:

**Em `js/script.js` (linhas 36 e 63):**
```javascript
const numero = '5511999999999'; // Alterar com o número da empresa
```

Exemplo: `const numero = '5521999887766';`

#### E-mail
**Em `index.html` (no footer):**
```html
<a href="mailto:contato@brucspersonalizados.com.br">
```

Altere para o e-mail real da empresa.

#### Redes Sociais
**Em `index.html` (no footer):**
```html
<a href="#" title="Instagram">Instagram</a>
<a href="#" title="Facebook">Facebook</a>
<a href="#" title="LinkedIn">LinkedIn</a>
```

Substitua os `#` pelos links reais:
```html
<a href="https://instagram.com/brucspersonalizados" title="Instagram">Instagram</a>
```

#### Logo e Branding
- Você pode substituir o logo de texto "BRUCS." por uma imagem
- Edite o CSS em `css/style.css` na seção `.logo`

### 3. Adicionar Imagens

Coloque suas imagens reais na pasta `assets/` e substitua os SVG placeholders por tags `<img>`:

```html
<!-- Antes -->
<div class="produto-image">
    <svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
        <!-- SVG -->
    </svg>
</div>

<!-- Depois -->
<div class="produto-image">
    <img src="assets/garrafa-personalizada.jpg" alt="Garrafas Personalizadas">
</div>
```

### 4. Implementar Backend para Formulário

Atualmente, o formulário envia os dados direto para WhatsApp. Para integrar com um backend:

**Edite `js/script.js` e modifique a função `enviarParaWhatsApp()`:**

```javascript
function enviarParaWhatsApp(data) {
    // Opção 1: Enviar para um servidor backend
    fetch('/api/orcamento', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Sucesso:', result);
        mostrarMensagemSucesso();
    })
    .catch(error => console.error('Erro:', error));
}
```

### 5. Analytics

Para adicionar Google Analytics, descomente e atualize em `js/script.js`:

```javascript
gtag('config', 'G-XXXXXXXXXX'); // Substitua pelo seu ID
```

## 🎨 Cores e Tema

**Cores Padrão:**
- Azul Escuro: `#1e3a5f`
- Azul Claro: `#2d5a8c`
- Dourado: `#d4af37`
- Branco: `#ffffff`
- Cinza Claro: `#f0f4f8`

Para alterar o tema, edite as variáveis CSS no topo de `css/style.css`:

```css
:root {
    --primary-dark: #1e3a5f;
    --primary-light: #2d5a8c;
    --accent-gold: #d4af37;
    /* ... outras cores ... */
}
```

## 📱 Responsividade

O site é totalmente responsivo e testado para:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (até 767px)

Breakpoints no CSS:
- `@media (max-width: 768px)` - Tablet
- `@media (max-width: 480px)` - Mobile

## 🔍 SEO

### Palavras-chave Otimizadas
- brindes corporativos
- brindes personalizados
- brindes para empresas
- brindes para eventos
- squeeze personalizada
- garrafa personalizada
- brindes promocionais
- brindes para feiras
- brindes personalizados em São Paulo

### Meta Tags
As meta tags estão configuradas em `index.html` com:
- Título descritivo
- Descrição
- Keywords
- Open Graph tags

## 📝 Checklist de Implementação

- [ ] Alterar número do WhatsApp
- [ ] Adicionar e-mail real
- [ ] Configurar links de redes sociais
- [ ] Adicionar imagens reais dos produtos
- [ ] Personalizar depoimentos de clientes
- [ ] Configurar Google Analytics
- [ ] Implementar formulário backend (opcional)
- [ ] Testar em diferentes dispositivos
- [ ] Publicar domínio/hosting
- [ ] Submeter sitemap aos search engines

## 🌐 Deploy/Hospedagem

### Opções Recomendadas:
1. **Netlify** - Deployment automático via Git, gratuito
2. **Vercel** - Ideal para sites estáticos
3. **GitHub Pages** - Gratuito, integrado com GitHub
4. **Hostinger/GoDaddy** - Hospedagem tradicional com domínio
5. **Heroku** - Se implementar backend

## ⚙️ Configurações Adicionais

### DNS e Domínio
1. Compre um domínio (Ex: brucspersonalizados.com.br)
2. Configure os DNS apontando para seu hosting
3. Configure SSL (HTTPS)

### Email
Para funcionalidade completa de e-mail de orçamento, implemente um backend com:
- Node.js + Express
- Python + Flask
- PHP
- Integração com serviços como SendGrid ou Mailgun

## 🐛 Troubleshooting

**Problema:** WhatsApp não abre
- Verifique se o número tem o código do país (Ex: +55)
- Teste em um dispositivo com WhatsApp instalado

**Problema:** Formulário não funciona
- Verifique o console do navegador (F12)
- Confirme que o WhatsApp está acessível

**Problema:** Site não responsivo
- Limpe o cache do navegador (Ctrl+F5)
- Verifique se `css/style.css` está carregado corretamente

## 📞 Suporte e Contato

Para dúvidas sobre implementação:
- Email: contato@brucspersonalizados.com.br
- WhatsApp: +55 11 9 9999-9999

## 📄 Licença

Este website foi desenvolvido como solução profissional para Brucs Personalizados. Todos os direitos reservados.

---

**Versão:** 1.0.0  
**Data de Criação:** 2024  
**Última Atualização:** Junho 2024
