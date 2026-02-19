import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.query.id !== '1') {
    return res.status(400).send('Invalid parameter');
  }

  const filePath = path.join(process.cwd(), 'payload.sh');

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Payload not found');
  }

  const content = fs.readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="payload.sh"');
  res.send(content);
}
