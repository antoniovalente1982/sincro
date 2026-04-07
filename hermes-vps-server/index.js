const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8643;
const AUTH_KEY = process.env.HERMES_API_KEY || 'AdPilotikHermesSecure2026!';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Custom logging stream to save logs into memory (last 100 lines) and console
let recentLogs = [];
const logToMemory = (message) => {
    console.log(message);
    recentLogs.push(message);
    if (recentLogs.length > 200) {
        recentLogs.shift();
    }
};

// Override console.log for simple capturing
const originalLog = console.log;
console.log = function() {
    const formattedMessage = Array.from(arguments).join(' ');
    originalLog.apply(console, arguments);
    recentLogs.push(formattedMessage);
    if (recentLogs.length > 200) recentLogs.shift();
};

const originalError = console.error;
console.error = function() {
    const formattedMessage = Array.from(arguments).join(' ');
    originalError.apply(console, arguments);
    recentLogs.push(`[ERROR] ${formattedMessage}`);
    if (recentLogs.length > 200) recentLogs.shift();
};

// Middleware: Authentication
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_KEY}`) {
        console.error(`Unauthorized request from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Logs Endpoint (Used by Sincro Dashboard)
app.get('/v1/logs', (req, res) => {
    const lines = parseInt(req.query.lines) || 50;
    res.json({ logs: recentLogs.slice(-lines) });
});

// Health Endpoint (Used by Sincro Dashboard)
app.get('/v1/models', (req, res) => {
    res.json({ data: [{ id: 'hermes-agent', object: 'model' }] });
});

// Main Chat Completions Endpoint
app.post('/v1/chat/completions', async (req, res) => {
    const { model, messages, user } = req.body;
    
    // Determine the role for logging
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    let agentRole = 'Orchestrator';
    if (systemMessage.includes('MEDIA-BUYER')) agentRole = 'MediaBuyer';
    else if (systemMessage.includes('CRM-TRIAGE')) agentRole = 'CRMTriage';
    
    console.log(`[${agentRole}] Received task payload for execution.`);
    
    // Load playbook if applicable 
    // In our shell script we created promts/ in root, but here we can just use the provided system messages
    
    try {
        const targetModel = model || 'xiaomi/mimo-v2-pro';
        console.log(`[System] Routing reasoning to OpenRouter (${targetModel})...`);
        
        const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://adpilotik.com',
                'X-Title': 'Sincro Hermes VPS'
            },
            body: JSON.stringify({
                model: targetModel,
                messages: messages,
            })
        });

        if (!orResponse.ok) {
            const errorText = await orResponse.text();
            console.error(`[System] OpenRouter connection failed: ${errorText}`);
            return res.status(502).json({ error: 'OpenRouter connection failed' });
        }

        const data = await orResponse.json();
        console.log(`[${agentRole}] Task processed successfully. Dispatching JSON...`);
        res.json(data);
    } catch (error) {
        console.error(`[System] Exception during Orchestrator execution: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[System] Hermes Gateway Node server listening on 0.0.0.0:${PORT}`);
});
