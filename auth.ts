import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as DBUser } from "./shared-schema";
import { generateVerificationCode, sendVerificationEmail, sendPasswordResetEmail, sendUsernameEmail, sendPasswordChangeConfirmationEmail } from "./email";
import crypto from "crypto";
import rateLimit from 'express-rate-limit';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

declare global {
  namespace Express {
    interface User extends DBUser {}
  }
}

// Utility to remove sensitive fields from user objects
function sanitizeUser(user: any) {
  if (!user) return user;
  const {
    password,
    verificationCode,
    verificationExpiry,
    passwordResetToken,
    passwordResetTokenExpiry,
    ...safeUser
  } = user;
  return safeUser;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "sweet-treats-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await storage.comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  // Add Google OAuth strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/auth/google/callback"
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      let user = await storage.getUserByEmail(profile.emails[0].value);
      if (!user) {
        user = await storage.createUser({
          username: profile.displayName,
          email: profile.emails[0].value,
          password: '',
          isVerified: false,
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Rate limiters
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: { message: 'Too many attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to sensitive endpoints
  app.post('/api/login', authLimiter);
  app.post('/api/register', authLimiter);
  app.post('/api/forgot-password', authLimiter);

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt for:", req.body.email);
      
      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingUser || existingEmail) {
        if (existingUser) console.warn(`Registration attempt with existing username: ${req.body.username}`);
        if (existingEmail) console.warn(`Registration attempt with existing email: ${req.body.email}`);
        return res.status(400).json({ message: "Registration failed. Please check your details and try again." });
      }

      // Validate admin registration
      if (req.body.isAdmin) {
        const adminCode = req.body.adminCode;
        if (adminCode !== "7575MG") {
          return res.status(400).json({ message: "Invalid admin code" });
        }
        console.log(`Admin registration attempt for: ${req.body.email}`);
      }

      // Hash password
      const hashedPassword = await storage.hashPassword(req.body.password);

      // Generate verification code
      const verificationCode = generateVerificationCode();
      
      // Set expiry time (30 minutes from now)
      const verificationExpiry = new Date();
      verificationExpiry.setMinutes(verificationExpiry.getMinutes() + 30);

      console.log(`Generated verification code: ${verificationCode} for ${req.body.email}`);

      // Create user with verification data
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        isVerified: false,
        verificationCode,
        verificationExpiry,
      });

      console.log(`User created successfully with ID: ${user.id}`);

      // Send verification email
      console.log(`Attempting to send verification email to: ${user.email}`);
      const emailSent = await sendVerificationEmail(user.email, verificationCode);
      
      if (!emailSent) {
        console.error(`Failed to send verification email to ${user.email}`);
        // Still create the user but inform them about the email issue
        const userWithoutSensitiveData = sanitizeUser(user);
        
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json({
            ...userWithoutSensitiveData,
            message: "Account created successfully, but verification email could not be sent. Please contact support."
          });
        });
        return;
      }

      console.log(`Verification email sent successfully to ${user.email}`);

      // Remove password from response
      const userWithoutSensitiveData = sanitizeUser(user);

      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({
          ...userWithoutSensitiveData,
          message: "Account created successfully! Please check your email for verification code."
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error creating account" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: Error, user: DBUser, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // If user is not verified, generate and send a new verification code
        if (!user.isVerified) {
          const verificationCode = generateVerificationCode();
          const verificationExpiry = new Date();
          verificationExpiry.setMinutes(verificationExpiry.getMinutes() + 30);
          await storage.updateUser(user.id, {
            verificationCode,
            verificationExpiry
          });
          await sendVerificationEmail(user.email, verificationCode);
        }
        // Remove password from response
        const userWithoutPassword = sanitizeUser(user);
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout error" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Remove password from response
    if (req.user) {
      const userWithoutPassword = sanitizeUser(req.user);
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  });

  // PUT /api/user - Update user profile
  app.put("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const userData = req.body; // Data to update: username, fullName, phone, address

      // Prevent updating sensitive fields like email, isAdmin, password via this route
      const { email, isAdmin, password, ...updatableData } = userData;

      console.log(`Attempting to update user ${userId} with data:`, updatableData);

      const updatedUser = await storage.updateUser(userId, updatableData);

      if (!updatedUser) {
        console.error(`User with ID ${userId} not found during update.`);
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Successfully updated user ${userId}.`);
      // Remove password from response
      const userWithoutPassword = sanitizeUser(updatedUser);
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Error updating profile" });
    }
  });

  // Verify email with verification code
  app.post("/api/verify-email", async (req, res) => {
    const { code } = req.body;
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.id;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.isVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }
      
      if (!user.verificationCode || !user.verificationExpiry) {
        return res.status(400).json({ message: "No verification code found. Please request a new code." });
      }
      
      // Check if code is correct
      if (user.verificationCode !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      
      // Check if code is expired
      const now = new Date();
      if (user.verificationExpiry && now > new Date(user.verificationExpiry)) {
        return res.status(400).json({ message: "Verification code expired. Please request a new code." });
      }
      
      // Mark user as verified
      const updatedUser = await storage.updateUser(userId, {
        isVerified: true,
        verificationCode: null,
        verificationExpiry: null
      });
      
      // Remove sensitive data from response
      const userWithoutPassword = sanitizeUser(updatedUser);
      
      res.status(200).json({ 
        message: "Email verified successfully", 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ message: "Error verifying email" });
    }
  });
  
  // Resend verification code
  app.post("/api/resend-verification", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.id;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.isVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }
      
      console.log(`Resending verification code for user: ${user.email}`);
      
      // Generate new verification code
      const verificationCode = generateVerificationCode();
      
      // Set expiry time (30 minutes from now)
      const verificationExpiry = new Date();
      verificationExpiry.setMinutes(verificationExpiry.getMinutes() + 30);
      
      console.log(`Generated new verification code: ${verificationCode} for ${user.email}`);
      
      // Update user with new verification code
      await storage.updateUser(userId, {
        verificationCode,
        verificationExpiry
      });
      
      // Send verification email
      console.log(`Attempting to send verification email to: ${user.email}`);
      const emailSent = await sendVerificationEmail(user.email, verificationCode);
      
      if (!emailSent) {
        console.error(`Failed to send verification email to ${user.email}`);
        return res.status(500).json({ 
          message: "Failed to send verification code. Please try again later or contact support." 
        });
      }
      
      console.log(`Verification email sent successfully to ${user.email}`);
      res.status(200).json({ message: "Verification code sent to your email" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Error sending verification code" });
    }
  });

  // Get user orders
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orders = await storage.getOrdersByUserId(req.user.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  // Forgot Password
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Explicitly notify if the user does not exist
        return res.status(404).json({ message: "No account found with that email address." });
      }

      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Set token expiry (1 hour from now)
      const passwordResetTokenExpiry = new Date();
      passwordResetTokenExpiry.setHours(passwordResetTokenExpiry.getHours() + 1);

      // Save the hashed token and expiry to the user
      await storage.updateUser(user.id, {
        passwordResetToken,
        passwordResetTokenExpiry,
      });

      // Send the email with the unhashed token
      await sendPasswordResetEmail(user.email, resetToken);
      
      res.status(200).json({ message: "A password reset link has been sent to your email address." });

    } catch (error) {
      console.error("Forgot password error:", error);
      // Generic error message for the client
      res.status(500).json({ message: "An internal error occurred while processing your request." });
    }
  });

  // Reset Password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and new password are required." });
      }
      
      // Hash the token from the user to match the one in the DB
      const passwordResetToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await storage.getUserByPasswordResetToken(passwordResetToken);

      if (!user || !user.passwordResetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired password reset token." });
      }

      // Check if token is expired
      const now = new Date();
      if (now > new Date(user.passwordResetTokenExpiry)) {
        return res.status(400).json({ message: "Invalid or expired password reset token." });
      }
      
      // Hash the new password
      const hashedPassword = await storage.hashPassword(password);
      
      // Update user's password and clear reset token fields
      await storage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      });

      // Send password change confirmation email
      await sendPasswordChangeConfirmationEmail(user.email);
      
      res.status(200).json({ message: "Password has been reset successfully." });

    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "An internal error occurred." });
    }
  });

  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isMatch = await storage.comparePasswords(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }
      // Prevent using the same password
      const isSamePassword = await storage.comparePasswords(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ message: "New password cannot be the same as the old password." });
      }
      const hashedPassword = await storage.hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });
      // Send password change confirmation email
      await sendPasswordChangeConfirmationEmail(user.email);
      res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "An error occurred while changing password." });
    }
  });

  app.delete("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const success = await storage.deleteUser(req.user.id);
      if (!success) return res.status(404).json({ message: "User not found" });
      req.logout(() => {}); // Log out the user after deleting
      res.status(200).json({ message: "Account deleted successfully." });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "An error occurred while deleting account." });
    }
  });
}