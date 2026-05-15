import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Snippet } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function GET(_req, { params }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await connectDB();
  const s = await Snippet.findOne({ _id: params.id, userId: session.userId });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(s);
}

export async function PUT(req, { params }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await connectDB();
  const { title, language, code } = await req.json();
  const s = await Snippet.findOneAndUpdate(
    { _id: params.id, userId: session.userId },
    { title, language, code, updatedAt: new Date() },
    { new: true }
  );
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(s);
}

export async function DELETE(_req, { params }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await connectDB();
  await Snippet.findOneAndDelete({ _id: params.id, userId: session.userId });
  return NextResponse.json({ ok: true });
}
