import User from '../models/User';
import Institution from '../models/Institution';
import { IUser, InstitutionStatus, TokenPayload } from '../types';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
  pick,
} from '../utils/helpers';
import { env } from '../config/env';
import { redis } from '../config/redis';
import speakeasy from 'speakeasy';

/**
 * The only fields a self-registering user may set. Everything else (role,
 * isVerifiedStudent, isActive, isEmailVerified, refreshTokens, followers, ...)
 * is left to the schema defaults or to an administrator.
 */
const REGISTRATION_FIELDS = [
  'email',
  'password',
  'firstName',
  'lastName',
  'username',
  'institution',
  'department',
  'level',
  'matricNumber',
  'phone',
];

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const blacklistKey = (token: string) => `${env.keyPrefix}blacklist:${token}`;

export class AuthService {
  static async register(userData: Partial<IUser>) {
    const safeData = pick<IUser>(userData, REGISTRATION_FIELDS);

    // `isMongoId()` in the validator only checks the shape. Mongoose does not
    // verify that a `ref` target exists either, so without this a well-formed
    // but unknown id produced a user stranded in an institution of one: empty
    // feed, no events, nobody to message, and no visible error.
    const institution = await Institution.findById(safeData.institution);

    if (!institution) {
      throw new Error('Selected university does not exist');
    }

    if (institution.status === InstitutionStatus.REJECTED || !institution.isActive) {
      // A PENDING institution is deliberately allowed through — a student who
      // just submitted their university must be able to finish signing up.
      if (institution.status !== InstitutionStatus.PENDING) {
        throw new Error('Selected university is not accepting registrations');
      }
    }

    const existingUser = await User.findOne({
      $or: [{ email: safeData.email }, { username: safeData.username }],
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const user = await User.create(safeData);
    return user;
  }

  static async login(email: string, password: string) {
    const user = await User.findOne({ email }).select('+password +refreshTokens +twoFactorSecret');

    if (!user || !user.isActive) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Check if 2FA is enabled. The client gets a short-lived challenge token
    // rather than a bare user id, so /2fa/verify cannot be pointed at an
    // arbitrary account without first proving knowledge of that account's
    // password.
    if (user.twoFactorEnabled) {
      return {
        requires2FA: true,
        challengeToken: generateTwoFactorChallengeToken(user._id.toString()),
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

  static async verify2FA(challengeToken: string, token: string) {
    const userId = verifyTwoFactorChallengeToken(challengeToken);
    const user = await User.findById(userId).select('+twoFactorSecret');

    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
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

  /** Returns true if the token was explicitly revoked via logout/logout-all. */
  private static async isBlacklisted(token: string): Promise<boolean> {
    try {
      return (await redis.get(blacklistKey(token))) !== null;
    } catch {
      // Redis unavailable: fall back to the persisted refreshTokens list, which
      // is the authoritative store. Do not fail open on a cache outage alone.
      return false;
    }
  }

  private static async blacklist(token: string): Promise<void> {
    try {
      await redis.setex(blacklistKey(token), REFRESH_TOKEN_TTL_SECONDS, '1');
    } catch {
      // Revocation is still enforced by removing the token from the user doc.
    }
  }

  static async refreshToken(refreshToken: string) {
    const { verifyRefreshToken } = await import('../utils/helpers.js');

    let decoded: TokenPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error('Invalid refresh token');
    }

    if (await this.isBlacklisted(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

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

    // Rotate: drop the presented token first so a single save persists both the
    // removal and the replacement.
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
    const tokens = await this.generateTokens(user);
    await this.blacklist(refreshToken);

    return tokens;
  }

  static async logout(userId: string, refreshToken: string) {
    if (!refreshToken) {
      throw new Error('Refresh token required');
    }

    const user = await User.findById(userId).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
      await user.save();
    }

    await this.blacklist(refreshToken);

    return { message: 'Logged out successfully' };
  }

  static async logoutAll(userId: string) {
    const user = await User.findById(userId).select('+refreshTokens');
    if (user) {
      await Promise.all(user.refreshTokens.map((rt) => this.blacklist(rt.token)));
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
