require('dotenv').config();
const express = require('express');
const SpotClient = require('./spot-client');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const SPOT_BASE = process.env.SPOT_BASE || 'https://ws.spotgifts.com.br/api/v1SSL/';
const ACCESS_KEY = process.env.ACCESS_KEY;

if (!ACCESS_KEY) {
    console.warn('Warning: ACCESS_KEY not set in environment. Add to .env');
}

const client = new SpotClient({ baseUrl: SPOT_BASE, accessKey: ACCESS_KEY });

const sampleProducts = [
    {
        InternalReference: 'BRU001',
        Name: 'Squeeze Personalizado',
        ProductTypeName: 'Squeezes',
        MainImage: 'https://via.placeholder.com/600x450?text=Squeeze',
        Price: 'R$ 29,90'
    },
    {
        InternalReference: 'BRU002',
        Name: 'Caneca Personalizada',
        ProductTypeName: 'Canecas',
        MainImage: 'https://via.placeholder.com/600x450?text=Caneca',
        Price: 'R$ 34,90'
    },
    {
        InternalReference: 'BRU003',
        Name: 'Caderno Personalizado',
        ProductTypeName: 'Cadernos',
        MainImage: 'https://via.placeholder.com/600x450?text=Caderno',
        Price: 'R$ 39,90'
    }
];

// Basic health
app.get('/api/spot/health', (req, res) => res.json({ ok: true }));

app.get('/api/spot/auth', async (req, res) => {
    try {
        const token = await client.authenticate();
        res.json({ SessionToken: token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/spot/products', async (req, res) => {
    const q = req.query || {};
    if (!ACCESS_KEY || ACCESS_KEY === 'your_access_key_here') {
        return res.json(sampleProducts);
    }

    try {
        const data = await client.request('Products', { method: 'GET', params: q, language: q.lang || 'PT' });
        res.json(data);
    } catch (err) {
        console.error('Spot products error:', err.message);
        if (!ACCESS_KEY) {
            return res.json(sampleProducts);
        }
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/spot/optionals', async (req, res) => {
    try {
        const q = req.query || {};
        const data = await client.request('OptionalsComplete', { method: 'GET', params: q });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/spot/stocks', async (req, res) => {
    try {
        const q = req.query || {};
        const data = await client.request('Stocks', { method: 'GET', params: q });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/spot/colors', async (req, res) => {
    try {
        const data = await client.request('Colors', { method: 'GET' });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/spot/orders', async (req, res) => {
    try {
        const body = req.body;
        const data = await client.request('Orders', { method: 'POST', body });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/spot/orders/:stamp', async (req, res) => {
    try {
        const stamp = req.params.stamp;
        const data = await client.request('OrderStatus', { method: 'GET', params: { OrderStamp: stamp } });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/spot/orders/:stamp/cancel', async (req, res) => {
    try {
        const stamp = req.params.stamp;
        const reason = req.body.Reason || req.body.reason || 'Cancel requested by client';
        const data = await client.request('CancelOrder', { method: 'POST', body: { OrderStamp: stamp, Reason: reason } });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve static site optionally
app.use('/', express.static(path.join(__dirname, '..')));

app.listen(PORT, () => console.log(`Spot proxy running on http://localhost:${PORT}`));
