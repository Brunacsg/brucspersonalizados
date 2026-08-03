# Configurações - Brucs Personalizados

## Variáveis de Ambiente

As seguintes variáveis podem ser configuradas:

### Contato
```
WHATSAPP_NUMBER=5511999999999
EMAIL_CONTACT=contato@brucspersonalizados.com.br
PHONE_CONTACT=+55 11 9 9999-9999
```

### Redes Sociais
```
INSTAGRAM_URL=https://instagram.com/brucspersonalizados
FACEBOOK_URL=https://facebook.com/brucspersonalizados
LINKEDIN_URL=https://linkedin.com/company/brucs-personalizados
```

### Analytics
```
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
GOOGLE_SEARCH_CONSOLE_ID=xxxxxxxxxxxx
FACEBOOK_PIXEL_ID=xxxxxxxxxxxx
```

### SEO
```
SITE_URL=https://www.brucspersonalizados.com.br
SITE_NAME=Brucs Personalizados
SITE_DESCRIPTION=Brindes corporativos e personalizados de qualidade premium
```

### Email (se usar backend)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
FROM_EMAIL=contato@brucspersonalizados.com.br
FROM_NAME=Brucs Personalizados
```

### Captcha (opcional)
```
RECAPTCHA_SITE_KEY=xxxxxxxxxxxx
RECAPTCHA_SECRET_KEY=xxxxxxxxxxxx
```

---

## Estrutura de Banco de Dados (se implementar backend)

### Tabela: Orcamentos
```sql
CREATE TABLE orcamentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(150) NOT NULL,
    empresa VARCHAR(150),
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(150) NOT NULL,
    produto VARCHAR(150) NOT NULL,
    quantidade INT NOT NULL,
    descricao TEXT,
    status ENUM('novo', 'em_análise', 'enviado', 'convertido', 'perdido') DEFAULT 'novo',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabela: Clientes
```sql
CREATE TABLE clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(150) NOT NULL,
    empresa VARCHAR(150),
    email VARCHAR(150) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT
);
```

### Tabela: Produtos
```sql
CREATE TABLE produtos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(100),
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints (Exemplo de Backend)

### POST /api/orcamento
Criar novo orçamento

**Request:**
```json
{
    "nome": "João Silva",
    "empresa": "Tech Company",
    "telefone": "11999999999",
    "email": "joao@empresa.com.br",
    "produto": "Garrafas Personalizadas",
    "quantidade": 500,
    "descricao": "Brindes para evento corporativo"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Orçamento criado com sucesso",
    "orcamento_id": 123,
    "whatsapp_link": "https://wa.me/5511999999999?text=..."
}
```

### GET /api/orcamentos
Listar orçamentos (requer autenticação)

### GET /api/orcamento/:id
Obter detalhes de um orçamento

### PUT /api/orcamento/:id
Atualizar status de um orçamento

### DELETE /api/orcamento/:id
Deletar um orçamento

---

## Implementação Backend - Exemplo Node.js/Express

```javascript
// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configurar conexão MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// POST /api/orcamento
app.post('/api/orcamento', async (req, res) => {
    try {
        const { nome, empresa, telefone, email, produto, quantidade, descricao } = req.body;
        
        // Validar dados
        if (!nome || !email || !telefone) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando' });
        }
        
        const connection = await pool.getConnection();
        
        // Inserir no banco
        const [result] = await connection.query(
            'INSERT INTO orcamentos (nome, empresa, telefone, email, produto, quantidade, descricao) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nome, empresa, telefone, email, produto, quantidade, descricao]
        );
        
        // Enviar email
        const emailContent = `
            <h2>Novo Orçamento Recebido</h2>
            <p><strong>Nome:</strong> ${nome}</p>
            <p><strong>Empresa:</strong> ${empresa}</p>
            <p><strong>Telefone:</strong> ${telefone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Produto:</strong> ${produto}</p>
            <p><strong>Quantidade:</strong> ${quantidade}</p>
            <p><strong>Descrição:</strong>${descricao}</p>
        `;
        
        await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: process.env.CONTACT_EMAIL,
            subject: `Novo Orçamento - ${nome}`,
            html: emailContent
        });
        
        connection.release();
        
        res.json({
            success: true,
            message: 'Orçamento criado com sucesso',
            orcamento_id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erro ao criar orçamento' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
```

---

## Docker Compose (Opcional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: brucs_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DB_HOST: db
      DB_USER: root
      DB_PASS: root_password
      DB_NAME: brucs_db
    depends_on:
      - db
    volumes:
      - ./backend:/app

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend:/usr/share/nginx/html
    depends_on:
      - backend

volumes:
  mysql_data:
```

---

## Nginx Configuration (Exemplo)

```nginx
# nginx.conf
upstream backend {
    server backend:3000;
}

server {
  listen 80;
  server_name brucspersonalizados.com.br www.brucspersonalizados.com.br;

  return 301 https://www.brucspersonalizados.com.br$request_uri;
}

server {
    listen 443 ssl http2;
  server_name brucspersonalizados.com.br;

  ssl_certificate /etc/letsencrypt/live/www.brucspersonalizados.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.brucspersonalizados.com.br/privkey.pem;

  return 301 https://www.brucspersonalizados.com.br$request_uri;
}

server {
  listen 443 ssl http2;
  server_name www.brucspersonalizados.com.br;

  ssl_certificate /etc/letsencrypt/live/www.brucspersonalizados.com.br/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.brucspersonalizados.com.br/privkey.pem;

    # Frontend
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache estático
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
}
```

---

## GitHub Actions CI/CD (Exemplo)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Build
      run: |
        npm install
        npm run build
    
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

---

**Configuração Versão:** 1.0.0  
**Último Update:** Junho 2024
