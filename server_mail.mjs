import express from 'express';
import cors from 'cors';
import path from 'path'; // パス操作用
import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

const app = express();
app.use(cors()); // HTML（ブラウザ）からのアクセスを許可
app.use(express.json());

app.use(express.static('.')); 

// 1. 実績のある学校・施設のプロキシURLをマッピング
const PROXY_SERVER_URL = 'http://10.1.1.5:8080'; 
const proxyEndpoint = new URL(PROXY_SERVER_URL);
const agent = new HttpsProxyAgent(proxyEndpoint);

// 2. OpenAIの通信機能を強制的に上書きするカスタムFetch関数
const customFetch = (url, options) => {
  return fetch(url, {
    ...options,
    agent: agent
  });
};

// 3. OpenAIの初期化（プロキシ仕様）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ターミナルから設定するか、直接文字列で書いてもOK
  fetch: customFetch 
});

// HTML側から叩かれる中継APIエンドポイント
app.post('/api/generate-mail', async (req, res) => {
    try {
        const { prompt } = req.body;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: '高度に訓練されたビジネスアシスタントです。指示された本文のコア以外は一切出力しないでください。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3
        });

        const aiText = completion.choices[0].message.content.trim();
        res.json({ text: aiText });

    } catch (error) {
        console.error("中継サーバー内部エラー:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ローカルの3000番ポートで待機
app.listen(3000, () => {
    console.log("🚀 プロキシ壁突破用・中継サーバーがポート3000で起動しました！");
    console.log("👉 HTMLからの通信をOpenAIへ安全に中継します。");
});
