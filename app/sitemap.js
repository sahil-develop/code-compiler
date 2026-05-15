export default function sitemap() {
  const base = process.env.PUBLIC_URL || 'https://coderunner.vercel.app';
  return [{ url: `${base}/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 }];
}
