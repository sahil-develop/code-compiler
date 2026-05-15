import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    if (password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });

    await connectDB();
    const exists = await User.findOne({ username: username.trim().toLowerCase() });
    if (exists) return NextResponse.json({ error: 'Username already taken' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.trim().toLowerCase(), passwordHash });

    const session = await getSession();
    session.userId   = user._id.toString();
    session.username = user.username;
    await session.save();

    return NextResponse.json({ username: user.username });
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
