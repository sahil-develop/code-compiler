import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Snippet } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await connectDB();
  const snippets = await Snippet.find({ userId: session.userId })
    .sort({ updatedAt: -1 })
    .select('title language updatedAt');
  return NextResponse.json(snippets);
}

export async function POST(req) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await connectDB();
  const { title, language, code } = await req.json();
  const s = await Snippet.create({ userId: session.userId, title, language, code });
  return NextResponse.json(s);
}
