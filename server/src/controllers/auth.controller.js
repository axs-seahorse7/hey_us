import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(request, response, next) {
  try {
    const name = request.body.name?.trim();
    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;

    if (!name || !emailPattern.test(email) || typeof password !== 'string' || password.length < 8) {
      return response.status(400).json({ message: 'Enter a name, valid email, and password of at least 8 characters.' });
    }
    if (await User.exists({ email })) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    return response.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    return next(error);
  }
}

export async function login(request, response, next) {
  try {
    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ message: 'Email or password is incorrect.' });
    }
    
    return response.json({ token: issueToken(user), user: user.toJSON() });
  } catch (error) {
    console.log("ERROR IN LOGIN:", error.message)
    return next(error);
  }
  
}

export function getCurrentUser(request, response) {
  response.json({ user: request.user });
}
