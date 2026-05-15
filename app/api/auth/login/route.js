import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

    await connectDB();
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

    const session = await getSession();
    session.userId   = user._id.toString();
    session.username = user.username;
    await session.save();

    return NextResponse.json({ username: user.username });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
