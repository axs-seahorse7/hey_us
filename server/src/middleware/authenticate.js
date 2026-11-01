import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function authenticate(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ message: 'Authentication is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return response.status(401).json({ message: 'Your account no longer exists.' });
    request.user = user;
    next();
  } catch {
    return response.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
}
