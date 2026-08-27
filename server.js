const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const uploadDir = path.join(dataDir, 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    callback(null, allowed.includes(file.mimetype));
  }
});

async function appendJson(fileName, entry) {
  const filePath = path.join(dataDir, fileName);
  let entries = [];
  try {
    entries = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  entries.push(entry);
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2));
}

app.use(express.json({ limit: '100kb' }));
app.use('/data', (_req, res) => res.sendStatus(404));
app.use(express.static(rootDir, { extensions: ['html'] }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/applications', async (req, res) => {
  const { fullName, email, programme, level, statement } = req.body;
  if (![fullName, email, programme, level, statement].every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const id = crypto.randomUUID();
    await appendJson('applications.json', {
      id,
      fullName: fullName.trim(),
      email: email.trim(),
      programme: programme.trim(),
      level: level.trim(),
      statement: statement.trim(),
      createdAt: new Date().toISOString()
    });
    res.status(201).json({ id, message: 'Candidatura recebida.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível guardar a candidatura.' });
  }
});

app.post('/api/messages', async (req, res) => {
  const { name, email, message } = req.body;
  if (![name, email, message].every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const id = crypto.randomUUID();
    await appendJson('messages.json', {
      id,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString()
    });
    res.status(201).json({ id, message: 'Mensagem recebida.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível guardar a mensagem.' });
  }
});

app.post('/api/documents', upload.array('documents', 4), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos um documento válido.' });
  }
  res.status(201).json({
    message: 'Documentos recebidos.',
    files: req.files.map(file => ({ name: file.originalname, size: file.size }))
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError || error.message === 'File type not allowed') {
    return res.status(400).json({ error: 'Use PDF, JPG ou PNG com até 10 MB por arquivo.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

async function start() {
  await fs.mkdir(uploadDir, { recursive: true });
  app.listen(port, () => console.log(`DONZA HUB running at http://localhost:${port}`));
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
