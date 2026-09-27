const NOTE_TAG = '三豚界隈';
const NOTE_API_URL = `https://note.com/api/v3/hashtags/${encodeURIComponent(NOTE_TAG)}/notes`;
const PAGE_SIZE = 100;

function toArticle(note) {
  const userName = note.user?.urlname;
  const key = note.key;
  if (typeof userName !== 'string' || typeof key !== 'string') {
    return null;
  }

  const publishedAt = typeof note.publish_at === 'string' ? note.publish_at.slice(0, 10) : '';
  const excerpt = (note.description || note.body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  return {
    title: typeof note.name === 'string' && note.name ? note.name : '無題',
    excerpt,
    date: publishedAt.replace(/-/g, '.'),
    img: note.eyecatch_url || note.thumbnail_external_url || '',
    url: `https://note.com/${encodeURIComponent(userName)}/n/${encodeURIComponent(key)}`,
    cat: NOTE_TAG,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    const articles = [];
    let page = 1;

    while (true) {
      const url = new URL(NOTE_API_URL);
      url.searchParams.set('size', String(PAGE_SIZE));
      url.searchParams.set('page', String(page));

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`note API returned ${response.status}`);
      }

      const payload = await response.json();
      const data = payload?.data;
      if (!Array.isArray(data?.notes) || typeof data.is_last_page !== 'boolean') {
        throw new Error('note API returned an invalid response');
      }

      for (const note of data.notes) {
        const article = toArticle(note);
        if (article) articles.push(article);
      }

      if (data.is_last_page) break;
      if (!Number.isInteger(data.next_page) || data.next_page <= page) {
        throw new Error('note API returned an invalid next page');
      }
      page = data.next_page;
    }

    return res.status(200).json({
      articles,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch note hashtag articles:', error);
    return res.status(502).json({ error: 'タグ記事を取得できませんでした' });
  }
};
