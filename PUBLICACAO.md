# GUIA DE PUBLICAÇÃO - Brucs Personalizados

## Requisito do Catálogo

O catálogo local depende do servidor Node em `server/index.js` para servir produtos e imagens locais. Publique em uma hospedagem que execute `npm start`. Não publique apenas os arquivos estáticos em GitHub Pages, Netlify ou Vercel sem adaptar o backend.

Para produção, configure também `CORS_ALLOWED_ORIGINS` com o domínio público. As rotas administrativas de pedidos ficam desativadas até que `ORDER_ADMIN_KEY` seja definido; essa chave não pode ser enviada ao navegador.

### Checklist Obrigatório Antes do DNS

1. Escolha uma hospedagem com Node.js persistente e defina o comando de inicialização como `npm start`.
2. Configure no painel da hospedagem: `SPOT_CATALOG_ENABLED=false`, `CORS_ALLOWED_ORIGINS=https://www.brucspersonalizados.com.br` e, apenas se as rotas administrativas de pedidos forem utilizadas, uma `ORDER_ADMIN_KEY` longa e aleatória.
3. Aponte `www.brucspersonalizados.com.br` para essa hospedagem e mantenha o redirecionamento do domínio sem `www` para `https://www.brucspersonalizados.com.br`.
4. Depois do deploy, valide no navegador: `/`, `/produtos.html`, `/api/spot/health`, `/api/catalog/products` e uma imagem de produto, por exemplo `/KT-90581-1.jpg`. As rotas do catálogo local devem responder `200`; a saúde deve informar `catalogEnabled: false`.
5. Não exponha `.env`, `ACCESS_KEY` ou `ORDER_ADMIN_KEY` em arquivos públicos, variáveis de frontend ou repositórios.

## 🚀 Como Publicar o Site

### Opção 1: NETLIFY (Recomendado - Grátis)

**Vantagens:**
- ✅ Deploy automático via Git
- ✅ SSL gratuito
- ✅ CDN global
- ✅ Muito fácil

**Passo a Passo:**

1. Criar conta em [netlify.com](https://www.netlify.com)
2. Conectar repositório GitHub
3. Configurar build settings
4. Deploy automático a cada push

**Comandos:**
```bash
# Clonar repositório
git clone https://github.com/seu-usuario/brucs.git
cd brucs

# Fazer deploy via CLI
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

---

### Opção 2: VERCEL (Muito Bom - Grátis)

**Vantagens:**
- ✅ Performance excelente
- ✅ Deploy em segundos
- ✅ Integração GitHub automática
- ✅ Serverless functions

**Passo a Passo:**

1. Ir em [vercel.com](https://vercel.com)
2. Fazer login com GitHub
3. Importar projeto
4. Deploy automático

```bash
# Ou via CLI
npm install -g vercel
vercel --prod
```

---

### Opção 3: GITHUB PAGES (Gratuito)

**Vantagens:**
- ✅ Totalmente gratuito
- ✅ GitHub integrado
- ✅ Simples

**Passo a Passo:**

1. Criar repositório: `brucs-personalizados`
2. Push do código
3. Settings → Pages → Source: Main branch
4. Site publicado em `seu-usuario.github.io/brucs`

---

### Opção 4: HOSTINGER/GODADDY (Hosting Tradicional)

**Vantagens:**
- ✅ Domínio próprio
- ✅ Email corporativo
- ✅ Suporte técnico

**Passo a Passo:**

1. Comprar plano (a partir de R$10/mês)
2. Contratar domínio: `www.brucspersonalizados.com.br`
3. Fazer upload via FTP
4. Configurar DNS

**Via FTP:**
```bash
# Usar FileZilla ou similar
Host: ftp.seudominio.com.br
Usuário: seu-usuario
Senha: sua-senha
Pasta: /public_html/
```

---

### Opção 5: AWS/AZURE/GOOGLE CLOUD (Enterprise)

Para implementação com backend completo.

---

## 🎯 ESCOLHER DOMÍNIO

### Domínios Recomendados
- ✅ brucspersonalizados.com.br
- ✅ brucsbrindes.com.br
- ✅ brindesbrucs.com.br

### Onde Comprar
- [NameCheap](https://www.namecheap.com) - Bom preço
- [GoDaddy](https://www.godaddy.com) - Conhecido
- [Registro.br](https://www.registro.br) - Domínios .br
- [Hostinger](https://www.hostinger.com.br) - Hosting + Domínio

### Preço Médio
- .com.br: R$ 25-50/ano
- .com: $10-15/ano

---

## 📋 CHECKLIST PRÉ-PUBLICAÇÃO

### Conteúdo
- [ ] Verificar todos os textos (sem erros)
- [ ] Substituir placeholders por conteúdo real
- [ ] Adicionar imagens reais
- [ ] Verificar links internos
- [ ] Testar formulário
- [ ] Verificar WhatsApp

### Técnico
- [ ] Favicon configurado
- [ ] Sitemap.xml presente
- [ ] Robots.txt configurado
- [ ] Meta tags preenchidas
- [ ] Google Analytics ID pronto
- [ ] HTTPS ativado
- [ ] Gzip compression

### Performance
- [ ] Testar velocidade (PageSpeed)
- [ ] Comprimir imagens
- [ ] Minificar CSS/JS
- [ ] Verificar Core Web Vitals

### Compatibilidade
- [ ] Testar em Chrome, Firefox, Safari, Edge
- [ ] Testar em iPhone, Android, iPad
- [ ] Teste de acessibilidade (wave.webaim.org)

### SEO
- [ ] Meta title + description
- [ ] H1, H2, H3 bem estruturados
- [ ] Alt text em imagens
- [ ] Keywords nos textos
- [ ] URL amigável

---

## 🔧 SCRIPT DE DEPLOYMENT AUTOMÁTICO

### GitHub Actions (CI/CD)

Criar arquivo: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Build
      run: |
        # Para sites estáticos, não precisa de build
        echo "Site pronto para deploy"
    
    - name: Deploy
      run: netlify deploy --dir=. --prod
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 🌐 CONFIGURAÇÃO DE DOMÍNIO

### DNS Apontamento para Netlify

1. Ir em Registradora de Domínio
2. Configurar Name Servers para:
   - dns1.netlify.com
   - dns2.netlify.com
   - dns3.netlify.com

Ou configure registros A:
- Type: A
- Name: @
- Value: [IP do Netlify]

### SSL/HTTPS
- ✅ Netlify: Automático com Let's Encrypt
- ✅ Vercel: Automático
- ✅ GitHub Pages: Automático
- ⚠️ Hosting Tradicional: Pode precisar de certificado pago

---

## 🔐 CONFIGURAR REDIRECIONAMENTOS

### Não-www para www

```
# Em _redirects (Netlify)
https://brucspersonalizados.com.br/* https://www.brucspersonalizados.com.br/:splat 301
```

### Redirecionamentos de URLs antigas

Se tiver site antigo:
```
/antiga-pagina /nova-pagina 301
/produto /produtos#garrafas 301
```

---

## 📊 MONITORAR APÓS PUBLICAÇÃO

### Ferramentas Essenciais

1. **Google Analytics**
   - Configurar e acompanhar tráfego
   - [analytics.google.com](https://analytics.google.com)

2. **Google Search Console**
   - Monitorar indexação
   - Ver erros
   - [search.google.com/search-console](https://search.google.com/search-console)

3. **Google PageSpeed Insights**
   - Medir performance
   - Ver sugestões de otimização
   - [pagespeed.web.dev](https://pagespeed.web.dev)

4. **Uptime Robot**
   - Monitorar se site está online
   - [uptimerobot.com](https://uptimerobot.com)

5. **Hotjar**
   - Mapas de calor
   - Gravar sessões de usuários
   - [hotjar.com](https://hotjar.com)

---

## 📱 TESTAR DEPOIS DE PUBLICAR

### Google Mobile-Friendly Test
```
https://search.google.com/test/mobile-friendly
```

### Lighthouse
```
Chrome DevTools → Lighthouse → Analyze page load
```

### Testes Funcionais
- [ ] Testar em computador
- [ ] Testar em mobile
- [ ] Testar em tablet
- [ ] Clicar em todos os links
- [ ] Testar formulário completo
- [ ] Testar WhatsApp
- [ ] Testar navegação

---

## 🚨 TROUBLESHOOTING

### Site não aparece em Google
**Solução:**
1. Ir em Google Search Console
2. Submeter sitemap.xml
3. Solicitar indexação
4. Aguardar 24-48 horas

### Site muito lento
**Solução:**
1. Comprimir imagens (tinypng.com)
2. Minificar CSS/JS
3. Usar CDN
4. Ativar gzip
5. Cache do navegador

### Formulário não funciona
**Solução:**
1. Verificar console (F12)
2. Verificar backend (se houver)
3. Testar WhatsApp separado
4. Verificar permissões do formulário

### Email não chega
**Solução:**
1. Se usar backend, verificar SMTP
2. Testar com Mailtrap.io
3. Verificar pasta Spam
4. Confirmar configurações de email

---

## 📈 PÓS-PUBLICAÇÃO

### Primeira Semana
- [ ] Submeter ao Google Search Console
- [ ] Submeter ao Bing Webmaster Tools
- [ ] Configurar Google Analytics 4
- [ ] Testar em todos dispositivos
- [ ] Monitorar performance

### Primeiro Mês
- [ ] Lançar primeira campanha de ads
- [ ] Começar a postar nas redes
- [ ] Acompanhar primeiros orçamentos
- [ ] Coletar feedback
- [ ] Fazer primeiros ajustes

### Contínuo
- [ ] Atualizar conteúdo regularmente
- [ ] Postar blog/notícias
- [ ] Responder comentários
- [ ] Monitorar analytics
- [ ] A/B testing
- [ ] Otimização contínua

---

## 💰 INVESTIMENTO RECOMENDADO

### Custos Mensais Mínimos

| Item | Custo Mensal |
|------|-------------|
| Domínio | ~R$ 2 |
| Hosting (Netlify/Vercel) | R$ 0 (gratuito) |
| Email corporativo | R$ 0-50 |
| Analytics | R$ 0 (gratuito) |
| **Total** | **R$ 2-52** |

### Custos Mensais Recomendados

| Item | Custo Mensal |
|------|-------------|
| Domínio .com.br | ~R$ 2 |
| Hosting (Hostinger) | ~R$ 20 |
| Email corporativo | ~R$ 25 |
| Google Ads | R$ 500+ |
| **Total** | **~R$ 547+** |

---

## 🎓 PRÓXIMAS AÇÕES

**Imediatas (Hoje):**
1. Escolher hosting/domínio
2. Reservar domínio
3. Fazer primeiro deploy

**Curto Prazo (Semana 1):**
1. Configurar Google Analytics
2. Submeter ao Search Console
3. Fazer primeira campanha de ads

**Médio Prazo (Mês 1):**
1. Monitorar resultados
2. Fazer otimizações
3. Lançar estratégia de marketing

**Longo Prazo:**
1. Crescimento orgânico
2. Mais funcionalidades
3. Escalabilidade

---

**Versão:** 1.0.0  
**Último Update:** Junho 2024  
**Status:** ✅ Pronto para Deploy

---

## 📞 SUPORTE

Em caso de dúvidas:
- Documentação Netlify: [docs.netlify.com](https://docs.netlify.com)
- Documentação Vercel: [vercel.com/docs](https://vercel.com/docs)
- Google Search Console Help: [support.google.com/webmasters](https://support.google.com/webmasters)

**Email de Contato Brucs:** contato@brucspersonalizados.com.br
