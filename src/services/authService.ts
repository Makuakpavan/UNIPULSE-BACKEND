import User from '../models/User';
import { IUser, TokenPayload, UserRole } from '../types';
import { generateAccessToken, generateRefreshToken, generateRandomToken } from '../utils/helpers';
import { env } from '../config/env';
import { redis } from '../config/redis';
import speakeasy from 'speakeasy';

export class AuthService {
  static async register(userData: Partial<IUser>) {
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const user = await User.create(userData);
    return user;
  }

  static async login(email: string, password: string, ipAddress?: string) {
    const user = await User.findOne({ email }).select('+password +refreshTokens +twoFactorSecret');

    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return {
        requires2FA: true,
        userId: user._id.toString(),
      };
    }

    const tokens = await this.generateTokens(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      requires2FA: false,
    };
  }

  static async verify2FA(userId: string, token: string) {
    const user = await User.findById(userId).select('+twoFactorSecret');

    if (!user || !user.twoFactorSecret) {
      throw new Error('Invalid 2FA setup');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    const tokens = await this.generateTokens(user);
    user.lastLogin = new Date();
    await user.save();

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  static async setup2FA(userId: string) {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) throw new Error('User not found');

    const secret = speakeasy.generateSecret({
      name: `${env.totpIssuer} (${user.email})`,
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  static async enable2FA(userId: string, token: string) {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) throw new Error('2FA not set up');

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) throw new Error('Invalid 2FA code');

    user.twoFactorEnabled = true;
    await user.save();

    return { message: '2FA enabled successfully' };
  }

  static async disable2FA(userId: string, password: string) {
    const user = await User.findById(userId).select('+password +twoFactorSecret');
    if (!user) throw new Error('User not found');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new Error('Invalid password');

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    return { message: '2FA disabled successfully' };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const { verifyRefreshToken } = await import('../utils/helpers.js');
      const decoded = verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.userId).select('+refreshTokens');
      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      const tokenExists = user.refreshTokens.some(
        (rt) => rt.token === refreshToken && rt.expiresAt > new Date()
      );

      if (!tokenExists) {
        throw new Error('Invalid refresh token');
      }

      // Rotate refresh token
      const tokens = await this.generateTokens(user);

      // Remove old refresh token
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
      await user.save();

      return tokens;
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  static async logout(userId: string, refreshToken: string) {
    const user = await User.findById(userId).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
      await user.save();
    }

    // Also blacklist in Redis
    await redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, '1');

    return { message: 'Logged out successfully' };
  }

  static async logoutAll(userId: string) {
    const user = await User.findById(userId).select('+refreshTokens');
    if (user) {
      // Blacklist all refresh tokens
      for (const rt of user.refreshTokens) {
        await redis.setex(`blacklist:${rt.token}`, 7 * 24 * 60 * 60, '1');
      }
      user.refreshTokens = [];
      await user.save();
    }

    return { message: 'Logged out from all devices' };
  }

  static async generateTokensForUser(user: IUser) {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      institutionId: user.institution?.toString(),
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ token: refreshToken, expiresAt });

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    return { accessToken, refreshToken };
  }

  private static async generateTokens(user: IUser) {
    return this.generateTokensForUser(user);
  }

  private static sanitizeUser(user: IUser) {
    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      phone: user.phone,
      role: user.role,
      institution: user.institution,
      department: user.department,
      level: user.level,
      matricNumber: user.matricNumber,
      profileVisibility: user.profileVisibility,
      isEmailVerified: user.isEmailVerified,
      isVerifiedStudent: user.isVerifiedStudent,
      twoFactorEnabled: user.twoFactorEnabled,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      createdAt: user.createdAt,
    };
  }
}
