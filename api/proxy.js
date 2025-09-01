// proxy.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vmvjgwnnlpyucwsvpsso.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtdmpnd25ubHB5dWNsc..."; // نفس المفتاح الي عندك
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { unique, username } = req.query;

  if (!unique) {
    return res.status(400).json({ error: "يرجى إدخال الرقم الموحد." });
  }

  try {
    // تسجيل نشاط البحث بالمستخدم في Supabase
    if (username) {
      await supabase.from('search_logs').insert([
        { username: username, search_term: unique, created_at: new Date().toISOString() }
      ]);
    }

    const response = await fetch(`http://176.241.95.201:8092/id?unique=${encodeURIComponent(unique)}`, {
      method: 'GET',
      headers: {
        Authorization: 'Basic YWRtaW46MjQxMDY3ODkw',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `السيرفر رد بحالة ${response.status}` });
    }

    const data = await response.json();

    // الآن نحتفظ بصور السونار إذا موجودة (لا نحذفها)
    if (data.trips && Array.isArray(data.trips)) {
      data.trips.forEach(trip => {
        // تأكد من وجود sonarData
        if (trip.sonarData && trip.sonarData.manifests) {
          trip.sonarData.manifests.forEach(manifest => {
            // نترك sonar_image_url كما هو
          });
        }
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: "خطأ في الاتصال بالسيرفر الخارجي", details: err.message });
  }
}
