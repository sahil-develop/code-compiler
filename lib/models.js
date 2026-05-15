import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 32 },
  passwordHash: { type: String, required: true },
  createdAt:    { type: Date, default: Date.now },
});

const SnippetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:     { type: String, default: 'Untitled' },
  language:  { type: String, enum: ['python', 'javascript', 'typescript'], default: 'javascript' },
  code:      String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const User    = mongoose.models.User    || mongoose.model('User', UserSchema);
export const Snippet = mongoose.models.Snippet || mongoose.model('Snippet', SnippetSchema);
