export default function robots() {
  const base = process.env.PUBLIC_URL || 'https://coderunner.vercel.app';
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${base}/sitemap.xml`,
  };
}
