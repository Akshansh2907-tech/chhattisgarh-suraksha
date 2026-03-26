import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, auth } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';

const Login = () => {
  const navigate = useNavigate();
  
  // Check if user is already logged in
  React.useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (auth.isLoggedIn()) {
        try {
          await authAPI.verifyToken();
          if (mounted) navigate('/environmental-dashboard', { replace: true });
        } catch (err) {
          // Token invalid — cleared by API layer
        }
      }
    };
    check();
    return () => { mounted = false; };
  }, [navigate]);

  const [step, setStep] = useState(1); // 1: Phone input, 2: OTP verification
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshProfile } = useAuth();

  const handlePhoneSubmit = async (e) => {
    console.log('Form submitted!'); // Basic check
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    console.log('Attempting to send OTP to:', phoneNumber);
    try {
      console.log('Making API call to send OTP...');
      const response = await authAPI.sendOTP(phoneNumber);
      console.log('API Response:', response);
      console.log('OTP sent successfully:', response.data);
      setStep(2);
    } catch (err) {
      console.error('Failed to send OTP. Full error:', err);
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!phoneNumber || !otp) {
        throw new Error('Phone number and OTP are required');
      }

      // Verify OTP and get user data
      const data = await authAPI.verifyOTP(phoneNumber, otp);
      
      // Use API auth manager to set token and headers
      if (data.token) {
        auth.setToken(data.token);
        if (data.userId) {
          localStorage.setItem('user_id', data.userId);
        }

        // Refresh profile in AuthContext so the app knows user is logged in
        if (typeof refreshProfile === 'function') {
          await refreshProfile();
        }
      }

      // Only new users should be redirected to signup
      if (data.isNewUser) {
        // Pass the phone number to the signup page to continue registration
        navigate('/signup', { 
          replace: true,
          state: { 
            phoneNumber,
            isNewUser: true
          }
        });
      } else {
        // Existing users go to dashboard, even if profile is incomplete
        // They can complete their profile later from the user profile page
        navigate('/environmental-dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Failed to verify OTP:', err);
      
  // Clear any invalid auth data via token manager
  auth.clearToken();
  localStorage.removeItem('user_id');
      
      // Handle specific error cases
      if (err.message.includes('expired')) {
        setError('OTP has expired. Please request a new one.');
        setStep(1); // Go back to phone number input
      } else if (err.message.includes('Invalid OTP')) {
        setError('Invalid OTP. Please check and try again.');
      } else {
        setError(err.message || 'Failed to verify OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    // TODO: Call backend API to resend OTP
    alert('OTP resent successfully!');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome Back
          </h2>
          <p className="text-muted-foreground">
            Sign in to continue to Chhattisgarh Suraksha
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg flex items-center">
            <Icon name="AlertTriangle" size={16} className="mr-2" />
            {error}
          </div>
        )}

        {/* Phone Number Input Step */}
        {step === 1 && (
          <form 
            onSubmit={(e) => {
              console.log('Form submit event triggered');
              handlePhoneSubmit(e);
            }} 
            className="space-y-6"
          >
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your phone number"
                pattern="[0-9]{10}"
                value={phoneNumber}
                onChange={(e) => {
                  console.log('Phone input change:', e.target.value);
                  setPhoneNumber(e.target.value);
                }}
                required
                className="w-full"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                We'll send you an OTP for verification
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={phoneNumber.length !== 10 || isLoading}
              onClick={(e) => {
                console.log('Button clicked');
                if (phoneNumber.length === 10) {
                  console.log('Phone number is valid, submitting form');
                } else {
                  console.log('Phone number is invalid:', phoneNumber);
                }
              }}
            >
              {isLoading ? (
                <Icon name="Loader2" className="mr-2 animate-spin" />
              ) : (
                <Icon name="Send" size={16} className="mr-2" />
              )}
              Get OTP
            </Button>
          </form>
        )}

        {/* OTP Verification Step */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-foreground mb-2">
                Enter OTP
              </label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                pattern="[0-9]{6}"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="w-full text-center text-2xl tracking-wider"
                maxLength={6}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                OTP sent to +91 {phoneNumber}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-2 text-primary hover:underline"
                >
                  Change
                </button>
              </p>
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={otp.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <Icon name="Loader2" className="mr-2 animate-spin" />
                ) : (
                  <Icon name="LogIn" size={16} className="mr-2" />
                )}
                Verify & Login
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleResendOtp}
              >
                <Icon name="RefreshCw" size={16} className="mr-2" />
                Resend OTP
              </Button>
            </div>
          </form>
        )}

        {/* Sign Up Link */}
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;