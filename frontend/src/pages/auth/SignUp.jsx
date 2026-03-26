import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI, auth } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Start at step 3 only if coming from login with verified phone number
  const initialStep = location.state?.phoneNumber ? 3 : 1;
  
  const [step, setStep] = useState(initialStep);
  const [formData, setFormData] = useState({
    phoneNumber: location.state?.phoneNumber || '',
    otp: '',
    fullName: '',
    email: '',
    address: '',
    role: 'citizen', // 'citizen' or 'municipality'
    employeeId: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { refreshProfile } = useAuth();

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authAPI.sendOTP(formData.phoneNumber);
      console.log('OTP sent successfully to:', formData.phoneNumber);
      setStep(2);
    } catch (err) {
      console.error('Failed to send OTP:', err);
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
      const data = await authAPI.verifyOTP(formData.phoneNumber, formData.otp);
      console.log('OTP verification response:', data);
      
      // Use the API token manager to set token and headers
      if (data.token) {
        auth.setToken(data.token);
        if (data.userId) {
          localStorage.setItem('user_id', data.userId);
        }

        // Refresh profile in context so UI knows user is logged in
        if (typeof refreshProfile === 'function') {
          await refreshProfile();
        }
      }

      if (data.isNewUser || !data.isProfileComplete) {
        // Proceed to profile completion
        setStep(3);
      } else {
        // User exists and profile is complete, redirect to dashboard
        navigate('/environmental-dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Failed to verify OTP:', err);
      if (err.message.includes('expired')) {
        setError('OTP has expired. Please request a new one.');
        setStep(1); // Go back to phone number input
      } else {
        setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await authAPI.register(formData);
      console.log('Registration successful:', data);
      
      if (data.token) {
        // Use API token manager to set token and headers
        auth.setToken(data.token);
        if (data.userId) {
          localStorage.setItem('user_id', data.userId);
        }

        // Refresh profile in context so UI knows user is logged in
        if (typeof refreshProfile === 'function') {
          await refreshProfile();
        }

        // Redirect to environmental dashboard
        navigate('/environmental-dashboard', { replace: true });
      } else {
        throw new Error('No authentication token received after registration');
      }
    } catch (err) {
      console.error('Failed to register:', err);
      setError(err.response?.data?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleResendOtp = async () => {
    setError('');
    setIsLoading(true);
    try {
      await authAPI.sendOTP(formData.phoneNumber);
      console.log('OTP resent successfully to:', formData.phoneNumber);
    } catch (err) {
      console.error('Failed to resend OTP:', err);
      setError(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Create Account
          </h2>
          <p className="text-muted-foreground">
            Join Chhattisgarh Suraksha to report and track environmental issues
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg flex items-center">
            <Icon name="AlertTriangle" size={16} className="mr-2" />
            {error}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepNumber < step ? 'bg-primary text-primary-foreground' :
                stepNumber === step ? 'bg-primary/20 text-primary border-2 border-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {stepNumber < step ? (
                  <Icon name="Check" size={14} />
                ) : (
                  stepNumber
                )}
              </div>
              {stepNumber < 3 && (
                <div className={`w-full h-1 mx-2 ${
                  stepNumber < step ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Phone Number Step */}
        {step === 1 && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                placeholder="Enter your phone number"
                pattern="[0-9]{10}"
                value={formData.phoneNumber}
                onChange={handleChange}
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
              disabled={formData.phoneNumber.length !== 10 || isLoading}
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
                name="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                pattern="[0-9]{6}"
                value={formData.otp}
                onChange={handleChange}
                required
                className="w-full text-center text-2xl tracking-wider"
                maxLength={6}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                OTP sent to +91 {formData.phoneNumber}
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
                disabled={formData.otp.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <Icon name="Loader2" className="mr-2 animate-spin" />
                ) : (
                  <Icon name="ArrowRight" size={16} className="mr-2" />
                )}
                Verify & Continue
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

        {/* User Details Step */}
        {step === 3 && (
          <form onSubmit={handleDetailsSubmit} className="space-y-6">
            {/* Role selector: Citizen or Municipality Employee */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Account Type</label>
              <div className="flex items-center space-x-4">
                <label className={`inline-flex items-center space-x-2 cursor-pointer` }>
                  <input
                    type="radio"
                    name="role"
                    value="citizen"
                    checked={formData.role === 'citizen'}
                    onChange={handleChange}
                    className="form-radio"
                  />
                  <span>Citizen</span>
                </label>

                <label className={`inline-flex items-center space-x-2 cursor-pointer` }>
                  <input
                    type="radio"
                    name="role"
                    value="municipality"
                    checked={formData.role === 'municipality'}
                    onChange={handleChange}
                    className="form-radio"
                  />
                  <span>Municipality Employee</span>
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-foreground mb-2">
                Address
              </label>
              <Input
                id="address"
                name="address"
                type="text"
                placeholder="Enter your address"
                value={formData.address}
                onChange={handleChange}
                required
                className="w-full"
              />
            </div>

            {/* Employee ID shown only for municipality employees */}
            {formData.role === 'municipality' && (
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-foreground mb-2">
                  Employee ID
                </label>
                <Input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  placeholder="Enter your municipal employee ID"
                  value={formData.employeeId}
                  onChange={handleChange}
                  required={formData.role === 'municipality'}
                  className="w-full"
                />
                <p className="mt-2 text-sm text-muted-foreground">Only required for Municipality Employees.</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!formData.fullName || !formData.email || !formData.address || (formData.role === 'municipality' && !formData.employeeId) || isLoading}
            >
              {isLoading ? (
                <Icon name="Loader2" className="mr-2 animate-spin" />
              ) : (
                <Icon name="UserPlus" size={16} className="mr-2" />
              )}
              Create Account
            </Button>
          </form>
        )}

        {/* Login Link */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;