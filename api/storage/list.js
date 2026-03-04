import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'uploads';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const folder = req.query.folder || '';

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Sertakan public URL untuk setiap file
  const files = (data || []).map((item) => {
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`${folder ? folder + '/' : ''}${item.name}`);
    return {
      name: item.name,
      size: item.metadata?.size ?? null,
      created_at: item.created_at,
      url: urlData?.publicUrl ?? null,
    };
  });

  return res.status(200).json({ files });
}
