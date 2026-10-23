import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { Client } from 'basic-ftp';

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });
const port = Number(process.env.PORT || 3000);
const remoteDir = process.env.FTP_REMOTE_DIR || '/videos';

function required(name) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name} in video-api/.env`); return value; }
async function withFtp(work) {
  const client = new Client(30_000);
  try {
    await client.access({ host: required('FTP_HOST'), port: Number(process.env.FTP_PORT || 21), user: required('FTP_USER'), password: required('FTP_PASSWORD'), secure: process.env.FTP_SECURE === 'true' ? true : 'explicit' });
    await client.ensureDir(remoteDir);
    return await work(client);
  } finally { client.close(); }
}

app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'ftp-video-api' }));
app.get('/api/videos', async (_req, res, next) => {
  try { const files = await withFtp((client) => client.list()); res.json(files.filter((file) => file.isFile).map((file) => ({ name: file.name, size: file.size, modifiedAt: file.modifiedAt }))); }
  catch (error) { next(error); }
});
app.post('/api/videos/upload', upload.single('video'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'video file is required' });
  const remoteName = path.basename(req.body.name || req.file.originalname);
  try { await withFtp((client) => client.uploadFrom(req.file.path, remoteName)); res.status(201).json({ name: remoteName, path: `${remoteDir}/${remoteName}`, size: req.file.size }); }
  catch (error) { next(error); }
  finally { fs.rm(req.file.path, { force: true }, () => undefined); }
});
app.get('/api/videos/:name', async (req, res, next) => {
  const fileName = path.basename(req.params.name); const temporary = path.join('uploads', `download-${Date.now()}-${fileName}`);
  try { await withFtp((client) => client.downloadTo(temporary, fileName)); res.download(temporary, fileName, () => fs.rm(temporary, { force: true }, () => undefined)); }
  catch (error) { fs.rm(temporary, { force: true }, () => undefined); next(error); }
});
app.delete('/api/videos/:name', async (req, res, next) => {
  try { await withFtp((client) => client.remove(path.basename(req.params.name))); res.sendStatus(204); } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: error?.message || 'FTP video API error' }); });
app.listen(port, () => console.log(`FTP video API listening on http://localhost:${port}`));
