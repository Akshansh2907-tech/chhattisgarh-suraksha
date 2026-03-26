import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { query } from '../config/database.js';

// Initialize Twilio client safely. In environments where Twilio credentials
// are not provided (e.g., local dev without SMS), we should not throw and
// instead disable SMS send functionality. Twilio requires an accountSid
// that starts with "AC"; guard against invalid/missing values.
let twilioClient = null;
try {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && sid.startsWith('AC') && token) {
    twilioClient = twilio(sid, token);
  } else {
    console.warn('Twilio credentials missing or invalid; SMS functionality disabled');
  }
} catch (e) {
  console.warn('Failed to initialize Twilio client:', e && e.message ? e.message : e);
  twilioClient = null;
}

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
export const sendOtp = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    // Save OTP in database
    await query(
      'INSERT INTO otps (phone_number, otp_code, expires_at) VALUES ($1, $2, $3)',
      [phoneNumber, otp, expiresAt]
    );

    // In development, just log the OTP instead of sending it
    console.log('\n==================================');
    console.log(`🔐 OTP for ${phoneNumber}: ${otp}`);
    console.log('==================================\n');
    // If Twilio client is initialized and enabled, attempt to send SMS.
    // Use explicit ENABLE_TWILIO=true to opt-in to sending in non-production environments.
    const normalizePhone = (p) => {
      if (!p) return p;
      const trimmed = String(p).trim();
      if (trimmed.startsWith('+')) return trimmed;
      // treat 10-digit numbers as Indian numbers and prefix +91
      const digits = trimmed.replace(/[^0-9]/g, '');
      if (digits.length === 10) return `+91${digits}`;
      if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
      // fallback: return with a plus if it looks like international without plus
      if (digits.length > 10) return `+${digits}`;
      return trimmed;
    };

    let smsSent = false;
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER && (process.env.ENABLE_TWILIO === 'true' || process.env.NODE_ENV === 'production')) {
      try {
        const to = normalizePhone(phoneNumber);
        const from = normalizePhone(process.env.TWILIO_PHONE_NUMBER);
        console.log('Attempting Twilio send from', from, 'to', to);
        const msg = await twilioClient.messages.create({
          body: `Your Chhattisgarh Suraksha verification code is: ${otp}`,
          from,
          to
        });
        console.log('Twilio SMS sent:', msg.sid);
        smsSent = true;
      } catch (smsErr) {
        console.warn('Twilio SMS send failed:', smsErr?.message || smsErr);
        smsSent = false;
      }
    } else {
      console.log('Twilio not enabled or missing credentials; SMS not sent. To enable set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER and ENABLE_TWILIO=true');
    }

    // Return success but indicate whether SMS was dispatched. The OTP is always stored in DB so it can be verified.
    res.status(200).json({ message: 'OTP generated', smsSent });
  } catch (error) {
    next(error);
  }
};

// Verify OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    // Check if OTP exists and is valid
    const otpResult = await query(
      'SELECT * FROM otps WHERE phone_number = $1 AND otp_code = $2 AND expires_at > NOW() AND NOT is_verified ORDER BY created_at DESC LIMIT 1',
      [phoneNumber, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark OTP as verified
    await query(
      'UPDATE otps SET is_verified = true WHERE id = $1',
      [otpResult.rows[0].id]
    );

    // Check if user exists and get their profile status
    const userResult = await query(
      'SELECT id, full_name, email, address FROM users WHERE phone_number = $1',
      [phoneNumber]
    );

    const token = jwt.sign(
      { phoneNumber, userId: userResult.rows[0]?.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Check if user exists and has completed their profile
    const isProfileComplete = userResult.rows.length > 0 && 
      userResult.rows[0].full_name && 
      userResult.rows[0].email && 
      userResult.rows[0].address;

    const response = {
      message: 'OTP verified successfully',
      token,
      isNewUser: userResult.rows.length === 0,
      isProfileComplete: isProfileComplete,
      userId: userResult.rows[0]?.id,
      user: userResult.rows[0] || null
    };
    console.log('\n==================================');
    console.log('✅ OTP Verification Success:');
    console.log(response);
    console.log('==================================\n');
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Register new user
export const registerUser = async (req, res, next) => {
  try {
    console.log('\n==================================');
    console.log('📝 Registration Request:', req.body);
    console.log('==================================\n');

    // Accept optional role and employeeId (for municipality employees)
    const { phoneNumber, fullName, email, address, role } = req.body;
    // employeeId may be sent when role === 'municipality'
    const employeeId = req.body.employeeId || null;

    if (!phoneNumber || !fullName) {
      console.log('❌ Validation Error: Missing required fields');
      return res.status(400).json({ 
        message: 'Phone number and full name are required',
        details: {
          phoneNumber: !phoneNumber ? 'Phone number is required' : null,
          fullName: !fullName ? 'Full name is required' : null
        }
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id, full_name FROM users WHERE phone_number = $1',
      [phoneNumber]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️ User already exists:', existingUser.rows[0]);
      return res.status(200).json({ 
        message: 'User already registered',
        userId: existingUser.rows[0].id,
        token: jwt.sign(
          { phoneNumber, userId: existingUser.rows[0].id },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        )
      });
    }

    // Create new user (keep users table schema unchanged)
    const result = await query(
      'INSERT INTO users (phone_number, full_name, email, address) VALUES ($1, $2, $3, $4) RETURNING id',
      [phoneNumber, fullName, email || null, address || null]
    );

    // If this is a municipality employee, create an employees record
    if (role === 'municipality' && employeeId) {
      try {
        await query(
          'INSERT INTO employees (user_id, employee_id, metadata) VALUES ($1, $2, $3)',
          [result.rows[0].id, employeeId, JSON.stringify({ created_by: 'self' })]
        );
        console.log('✅ Municipality employee record created for user', result.rows[0].id);
      } catch (e) {
        console.warn('Failed to create employee record:', e.message || e);
        // don't fail entire registration on employee table issues; just warn
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { phoneNumber, userId: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const response = {
      message: 'User registered successfully',
      userId: result.rows[0].id,
      token,
      isProfileComplete: true,
      shouldRedirect: true,
      redirectTo: '/environmental-dashboard'
    };
    
    console.log('\n==================================');
    console.log('✅ User Registration Success:');
    console.log('User:', { phoneNumber, fullName, email });
    console.log('Response:', response);
    console.log('==================================\n');
    
    res.status(201).json(response);
  } catch (error) {
    console.log('\n==================================');
    console.log('❌ Registration Error:', error);
    console.log('==================================\n');

    // Handle database unique constraint violations
    if (error.code === '23505') {
      if (error.constraint === 'users_phone_number_key') {
        return res.status(409).json({ 
          message: 'Phone number already registered',
          field: 'phoneNumber'
        });
      }
      if (error.constraint === 'users_email_key') {
        return res.status(409).json({ 
          message: 'Email already registered',
          field: 'email'
        });
      }
    }

    // Handle database connection errors
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        message: 'Database connection error',
        details: 'Unable to connect to the database'
      });
    }

    next(error);
  }
};