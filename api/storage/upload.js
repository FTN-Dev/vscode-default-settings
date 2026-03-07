import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

// Matikan body parser bawaan Vercel agar formidable bisa baca stream multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'uploads';

// -------------------------------------------------------------------
// Helper: parse multipart/form-data menggunakan formidable
// -------------------------------------------------------------------
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 }); // max 50 MB
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

// -------------------------------------------------------------------
// Helper: baca raw body dari request stream
// -------------------------------------------------------------------
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// -------------------------------------------------------------------
// Handler utama
// -------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const contentType = req.headers['content-type'] || '';

  try {
    let fileBuffer;
    let filename;

    // ------------------------------------------------------------------
    // MODE 1: multipart/form-data  →  curl -F "file=@/path/to/file.txt"
    // ------------------------------------------------------------------
    if (contentType.includes('multipart/form-data')) {
      const { files } = await parseMultipart(req);

      const uploadedFile = files.file?.[0] ?? files.file;
      if (!uploadedFile) {
        return res.status(400).json({ error: 'Field "file" tidak ditemukan dalam form.' });
      }

      filename = uploadedFile.originalFilename || uploadedFile.newFilename || 'upload';
      fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // ------------------------------------------------------------------
    // MODE 2: application/octet-stream  →  curl --data-binary @file.txt ?filename=file.txt
    // ------------------------------------------------------------------
    } else if (contentType.includes('application/octet-stream')) {
      filename = req.query.filename || `upload_${Date.now()}`;
      fileBuffer = await readRawBody(req);

    // ------------------------------------------------------------------
    // MODE 3: application/json  →  { "filename": "...", "data": "<base64>" }
    // ------------------------------------------------------------------
    } else if (contentType.includes('application/json')) {
      const rawBody = await readRawBody(req);
      const body = JSON.parse(rawBody.toString());

      if (!body.filename || !body.data) {
        return res.status(400).json({ error: 'JSON harus berisi "filename" dan "data" (base64).' });
      }

      filename = body.filename;
      fileBuffer = Buffer.from(body.data, 'base64');

    } else {
      return res.status(415).json({
        error: 'Content-Type tidak didukung.',
        supported: [
          'multipart/form-data',
          'application/octet-stream',
          'application/json'
        ]
      });
    }

    // Dapatkan IP asal pengirim (Vercel mengirimkan ini di header)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] 
                     || req.headers['x-real-ip'] 
                     || req.socket.remoteAddress 
                     || 'unknown-ip';

    // Format waktu spesifik WIB (Asia/Jakarta)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    // sv-SE format string: "YYYY-MM-DD HH:mm:ss"
    const [dateStr, rawTimeStr] = formatter.format(now).split(' ');
    const timeStr = rawTimeStr.replace(/:/g, '-'); // HH-mm-ss

    // Format final path: YYYY-MM-DD/HH-mm-ss_ip-192.168.1.1/filename
    const storagePath = `${dateStr}/${timeStr}_ip-${clientIp}/${filename}`;

    // Upload ke Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        upsert: true,
        contentType: 'application/octet-stream',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Buat public URL (hanya jika bucket bersifat public)
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    return res.status(200).json({
      success: true,
      path: storagePath,
      url: urlData?.publicUrl ?? null,
      size_bytes: fileBuffer.length,
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
